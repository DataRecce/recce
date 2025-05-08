from typing import List, Literal, Optional, Union

from pydantic import BaseModel

from recce.core import default_context
from recce.models import Check
from recce.tasks import Task
from recce.tasks.core import CheckValidator, TaskResultDiffer
from recce.tasks.query import QueryMixin


class RowCountParams(BaseModel):
    node_names: Optional[list[str]] = None
    node_ids: Optional[list[str]] = None


class RowCountTask(Task, QueryMixin):
    def __init__(self, params: dict):
        super().__init__()
        self.params = RowCountParams(**params) if params is not None else RowCountParams()
        self.connection = None

    def _query_row_count(self, dbt_adapter, model_name, base=False):
        node = dbt_adapter.find_node_by_name(model_name, base=base)
        if node is None:
            return None

        if node.resource_type != "model" and node.resource_type != "snapshot":
            return None

        if node.config and node.config.materialized not in ["table", "view", "incremental", "snapshot"]:
            return None

        relation = dbt_adapter.create_relation(model_name, base=base)
        if relation is None:
            return None

        sql_template = r"select count(*) from {{ relation }}"
        sql = dbt_adapter.generate_sql(sql_template, context=dict(relation=relation))
        _, table = dbt_adapter.execute(sql, fetch=True)
        return int(table[0][0]) if table[0][0] is not None else 0

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

                row_count = self._query_row_count(dbt_adapter, node, base=False)
                self.check_cancel()
                result[node] = {
                    "curr": row_count,
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

    def _query_row_count(self, dbt_adapter, model_name, base=False):
        node = dbt_adapter.find_node_by_name(model_name, base=base)
        if node is None:
            return None

        if node.resource_type != "model" and node.resource_type != "snapshot":
            return None

        if node.config and node.config.materialized not in ["table", "view", "incremental", "snapshot"]:
            return None

        relation = dbt_adapter.create_relation(model_name, base=base)
        if relation is None:
            return None

        sql_template = r"select count(*) from {{ relation }}"
        sql = dbt_adapter.generate_sql(sql_template, context=dict(relation=relation))
        _, table = dbt_adapter.execute(sql, fetch=True)
        return int(table[0][0]) if table[0][0] is not None else 0

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

                base_row_count = self._query_row_count(dbt_adapter, node, base=True)
                self.check_cancel()
                curr_row_count = self._query_row_count(dbt_adapter, node, base=False)
                self.check_cancel()
                result[node] = {
                    "base": base_row_count,
                    "curr": curr_row_count,
                }
                completed += 1

        return result

    def execute_sqlmesh(self):
        result = {}

        query_candidates = []

        for node_id in self.node_ids or []:
            query_candidates.append(node_id)
        for node_name in self.params.node_names or []:
            query_candidates.append(node_name)

        from recce.adapter.sqlmesh_adapter import SqlmeshAdapter

        sqlmesh_adapter: SqlmeshAdapter = default_context().adapter

        for name in query_candidates:
            base_row_count = None
            curr_row_count = None

            try:
                df, _ = sqlmesh_adapter.fetchdf_with_limit(f"select count(*) from {name}", base=True)
                base_row_count = int(df.iloc[0, 0])
            except Exception:
                pass
            self.check_cancel()

            try:
                df, _ = sqlmesh_adapter.fetchdf_with_limit(f"select count(*) from {name}", base=False)
                curr_row_count = int(df.iloc[0, 0])
            except Exception:
                pass
            self.check_cancel()
            result[name] = {
                "base": base_row_count,
                "curr": curr_row_count,
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
            return self.changes.affected_root_keys.items


class RowCountDiffCheckValidator(CheckValidator):
    def validate_check(self, check: Check):
        try:
            RowCountDiffParams(**check.params)
        except Exception as e:
            raise ValueError(f"Invalid params: str{e}")
