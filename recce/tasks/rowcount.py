import logging
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel

from recce.core import default_context
from recce.models import Check
from recce.tasks import Task
from recce.tasks.core import CheckValidator, TaskResultDiffer
from recce.tasks.query import QueryMixin

logger = logging.getLogger(__name__)


# Row count result status codes - these are exposed to MCP agents for interpretation
class RowCountStatus(str, Enum):
    """Status codes for row count results.

    Using str, Enum maintains JSON serialization compatibility while adding type safety.

    These codes help agents understand why a row count might be unavailable:
    - ok: Successfully retrieved row count
    - not_in_manifest: Model not found in dbt manifest
    - unsupported_resource_type: Node is not a model or snapshot
    - unsupported_materialization: Materialization type doesn't support row counts (e.g., ephemeral)
    - table_not_found: Table defined in manifest but doesn't exist in database
                       (indicates stale dbt artifacts or environment mismatch)
    - permission_denied: User lacks permission to access the table
    """

    OK = "ok"
    NOT_IN_MANIFEST = "not_in_manifest"
    UNSUPPORTED_RESOURCE_TYPE = "unsupported_resource_type"
    UNSUPPORTED_MATERIALIZATION = "unsupported_materialization"
    TABLE_NOT_FOUND = "table_not_found"
    PERMISSION_DENIED = "permission_denied"


def _make_row_count_result(
    count: Optional[int] = None,
    status: RowCountStatus = RowCountStatus.OK,
    message: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a structured row count result with status information.

    Args:
        count: The row count value, or None if unavailable
        status: Status code indicating success or reason for failure
        message: Optional human-readable message explaining the status

    Returns:
        Dict with 'count', 'status', and optionally 'message' keys
    """
    result: Dict[str, Any] = {"count": count, "status": status}
    if message:
        result["message"] = message
    return result


def _query_row_count(dbt_adapter: Any, model_name: str, base: bool = False) -> Dict[str, Any]:
    """Query row count for a model with detailed status information.

    This is a shared helper function used by both RowCountTask and RowCountDiffTask.

    Args:
        dbt_adapter: The dbt adapter instance for database operations
        model_name: Name of the model to query row count for
        base: If True, query the base environment; otherwise query current

    Returns a structured result with count, status, and optional message
    to help agents understand why a count might be unavailable.
    """
    env_name = "base" if base else "current"

    node = dbt_adapter.find_node_by_name(model_name, base=base)
    if node is None:
        return _make_row_count_result(
            status=RowCountStatus.NOT_IN_MANIFEST,
            message=f"Model '{model_name}' not found in {env_name} manifest",
        )

    if node.resource_type not in ("model", "snapshot"):
        return _make_row_count_result(
            status=RowCountStatus.UNSUPPORTED_RESOURCE_TYPE,
            message=f"Resource type '{node.resource_type}' does not support row counts",
        )

    if (
        node.config
        and node.config.materialized is not None
        and node.config.materialized not in ["table", "view", "incremental", "snapshot"]
    ):
        return _make_row_count_result(
            status=RowCountStatus.UNSUPPORTED_MATERIALIZATION,
            message=f"Materialization '{node.config.materialized}' does not support row counts",
        )

    relation = dbt_adapter.create_relation(model_name, base=base)
    if relation is None:
        return _make_row_count_result(
            status=RowCountStatus.NOT_IN_MANIFEST,
            message=f"Could not create relation for model '{model_name}'",
        )

    sql_template = "select count(*) from {{ relation }}"
    sql = dbt_adapter.generate_sql(sql_template, context=dict(relation=relation))

    try:
        _, table = dbt_adapter.execute(sql, fetch=True)
        count = int(table[0][0]) if table[0][0] is not None else 0
        return _make_row_count_result(count=count, status=RowCountStatus.OK)
    except Exception as e:
        error_msg = str(e).upper()

        # Check for permission/authorization errors first (distinct from missing tables)
        if any(
            indicator in error_msg
            for indicator in [
                "NOT AUTHORIZED",
                "PERMISSION DENIED",
                "ACCESS DENIED",
                "INSUFFICIENT PRIVILEGES",
            ]
        ):
            message = (
                f"Permission denied when accessing '{relation}' in {env_name} database. "
                f"The table may exist but the current user lacks permission to query it."
            )
            logger.warning(message)
            return _make_row_count_result(
                status=RowCountStatus.PERMISSION_DENIED,
                message=message,
            )

        # Check for table-not-found errors
        # Note: "DOES NOT EXIST" in a count(*) query context refers to the table, not columns
        if any(
            indicator in error_msg
            for indicator in [
                "DOES NOT EXIST",
                "42S02",  # Snowflake/SQL Server error code for missing table
                "42P01",  # PostgreSQL error code for missing table
                "TABLE OR VIEW NOT FOUND",  # Oracle
                "RELATION DOES NOT EXIST",  # PostgreSQL alternative
                "OBJECT DOES NOT EXIST",  # Snowflake
                "INVALID OBJECT NAME",  # SQL Server
            ]
        ):
            message = (
                f"Table '{relation}' not found in {env_name} database. "
                f"The model is defined in the dbt manifest but the table doesn't exist. "
                f"This may indicate stale dbt artifacts or an environment configuration issue."
            )
            logger.warning(message)
            return _make_row_count_result(
                status=RowCountStatus.TABLE_NOT_FOUND,
                message=message,
            )

        # Re-raise if it's not a recognized error
        raise


def _split_row_count_result(result: Dict[str, Any]) -> tuple:
    """Split a _query_row_count result into (count, meta) for backward-compatible output.

    Returns:
        (count, meta) where count is int or None, and meta is the full status dict.
    """
    count = result.get("count")
    meta = {k: v for k, v in result.items() if k != "count"}
    return count, meta


class RowCountParams(BaseModel):
    node_names: Optional[list[str]] = None
    node_ids: Optional[list[str]] = None


class RowCountTask(Task, QueryMixin):
    """Task for querying row counts (current environment only)."""

    def __init__(self, params: dict):
        super().__init__()
        self.params = RowCountParams(**params) if params is not None else RowCountParams()
        self.connection = None

    def execute(self):
        result = {}

        dbt_adapter = default_context().adapter

        query_candidates = []
        if self.params.node_ids or self.params.node_names:
            for node_id in self.params.node_ids or []:
                name = dbt_adapter.get_node_name_by_id(node_id)
                if name:
                    query_candidates.append(name)
            for node in self.params.node_names or []:
                query_candidates.append(node)
        else:

            def countable(unique_id):
                return unique_id.startswith("model") or unique_id.startswith("snapshot") or unique_id.startswith("seed")

            node_ids = dbt_adapter.select_nodes(
                select=self.params.select,
                exclude=self.params.exclude,
                packages=self.params.packages,
                view_mode=self.params.view_mode,
            )
            node_ids = list(filter(countable, node_ids))
            for node_id in node_ids:
                name = dbt_adapter.get_node_name_by_id(node_id)
                if name:
                    query_candidates.append(name)

        # Query row count for nodes that are not cached
        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()
            completed = 0
            total = len(query_candidates)
            for node in query_candidates:
                self.update_progress(message=f"Query: {node} [{completed}/{total}]", percentage=completed / total)

                curr_count, curr_meta = _split_row_count_result(_query_row_count(dbt_adapter, node, base=False))
                self.check_cancel()
                result[node] = {
                    "curr": curr_count,
                    "curr_meta": curr_meta,
                }
                completed += 1

        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)


class RowCountDiffParams(BaseModel):
    node_names: Optional[list[str]] = None
    node_ids: Optional[list[str]] = None
    select: Optional[str] = None
    exclude: Optional[str] = None
    packages: Optional[list[str]] = None
    view_mode: Optional[Literal["all", "changed_models"]] = None


class RowCountDiffTask(Task, QueryMixin):
    def __init__(self, params: dict):
        super().__init__()
        self.params = RowCountDiffParams(**params) if params is not None else RowCountDiffParams()
        self.connection = None

    def execute_dbt(self):
        result = {}

        dbt_adapter = default_context().adapter

        query_candidates = []
        if self.params.node_ids or self.params.node_names:
            for node_id in self.params.node_ids or []:
                name = dbt_adapter.get_node_name_by_id(node_id)
                if name:
                    query_candidates.append(name)
            for node in self.params.node_names or []:
                query_candidates.append(node)
        else:

            def countable(unique_id):
                return unique_id.startswith("model") or unique_id.startswith("snapshot") or unique_id.startswith("seed")

            node_ids = dbt_adapter.select_nodes(
                select=self.params.select,
                exclude=self.params.exclude,
                packages=self.params.packages,
                view_mode=self.params.view_mode,
            )
            node_ids = list(filter(countable, node_ids))
            for node_id in node_ids:
                name = dbt_adapter.get_node_name_by_id(node_id)
                if name:
                    query_candidates.append(name)

        # Query row count for nodes that are not cached
        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()
            completed = 0
            total = len(query_candidates)
            for node in query_candidates:
                self.update_progress(message=f"Diff: {node} [{completed}/{total}]", percentage=completed / total)

                base_count, base_meta = _split_row_count_result(_query_row_count(dbt_adapter, node, base=True))
                self.check_cancel()
                curr_count, curr_meta = _split_row_count_result(_query_row_count(dbt_adapter, node, base=False))
                self.check_cancel()
                result[node] = {
                    "base": base_count,
                    "curr": curr_count,
                    "base_meta": base_meta,
                    "curr_meta": curr_meta,
                }
                completed += 1

        return result

    def execute_sqlmesh(self):
        result = {}

        query_candidates = []

        for node_id in self.params.node_ids or []:
            query_candidates.append(node_id)
        for node_name in self.params.node_names or []:
            query_candidates.append(node_name)

        from recce.adapter.sqlmesh_adapter import SqlmeshAdapter

        sqlmesh_adapter: SqlmeshAdapter = default_context().adapter

        for name in query_candidates:
            # Query base environment
            try:
                df, _ = sqlmesh_adapter.fetchdf_with_limit(f"select count(*) from {name}", base=True)
                base_count, base_meta = int(df.iloc[0, 0]), {"status": RowCountStatus.OK}
            except Exception:
                base_count, base_meta = None, {
                    "status": RowCountStatus.TABLE_NOT_FOUND,
                    "message": f"Table '{name}' not found in base environment",
                }
            self.check_cancel()

            # Query current environment
            try:
                df, _ = sqlmesh_adapter.fetchdf_with_limit(f"select count(*) from {name}", base=False)
                curr_count, curr_meta = int(df.iloc[0, 0]), {"status": RowCountStatus.OK}
            except Exception:
                curr_count, curr_meta = None, {
                    "status": RowCountStatus.TABLE_NOT_FOUND,
                    "message": f"Table '{name}' not found in current environment",
                }
            self.check_cancel()

            result[name] = {
                "base": base_count,
                "curr": curr_count,
                "base_meta": base_meta,
                "curr_meta": curr_meta,
            }

        return result

    def execute(self):
        context = default_context()
        if context.adapter_type == "dbt":
            return self.execute_dbt()
        else:
            return self.execute_sqlmesh()

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)


class RowCountDiffResultDiffer(TaskResultDiffer):
    def _check_result_changed_fn(self, result):
        base = {}
        current = {}

        for node, row_counts in result.items():
            base[node] = row_counts["base"]
            current[node] = row_counts["curr"]

        return TaskResultDiffer.diff(base, current)

    def _get_related_node_ids(self) -> Union[List[str], None]:
        """
        Get the related node ids.
        Should be implemented by subclass.
        """
        params = self.run.params
        if params.get("model"):
            return [TaskResultDiffer.get_node_id_by_name(params.get("model"))]
        elif params.get("node_names"):
            names = params.get("node_names", [])
            return [TaskResultDiffer.get_node_id_by_name(name) for name in names]
        elif params.get("node_ids"):
            return params.get("node_ids", [])
        else:
            return TaskResultDiffer.get_node_ids_by_selector(
                select=params.get("select"),
                exclude=params.get("exclude"),
                packages=params.get("packages"),
                view_mode=params.get("view_mode"),
            )

    def _get_changed_nodes(self) -> Union[List[str], None]:
        if self.changes:
            # Both affected_root_keys of deepdiff v7 (OrderedSet) and v8 (SetOrdered) are iterable
            # Convert to list directly
            return list(self.changes.affected_root_keys)
        return None


class RowCountDiffCheckValidator(CheckValidator):
    def validate_check(self, check: Check):
        try:
            RowCountDiffParams(**check.params)
        except Exception as e:
            raise ValueError(f"Invalid params: str{e}")
