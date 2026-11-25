import typing as t
from dataclasses import dataclass
from threading import Lock, RLock
from typing import Dict, Literal, Optional, Set, Type

import pandas as pd
from sqlglot import exp, parse, select
from sqlglot.errors import ParseError, TokenError
from sqlglot.optimizer import traverse_scope
from sqlmesh.core.context import Context as SqlmeshContext
from sqlmesh.core.environment import Environment
from sqlmesh.core.state_sync import StateReader

from recce.adapter.base import BaseAdapter
from recce.adapter.duckdb_security import lock_down_duckdb
from recce.exceptions import (
    DuckDBExternalAccessBlocked,
    RecceException,
    is_duckdb_external_access_blocked,
)
from recce.models import RunType
from recce.tasks import QueryDiffTask, QueryTask, RowCountDiffTask, Task

sqlmesh_supported_registry: Dict[RunType, Type[Task]] = {
    RunType.QUERY: QueryTask,
    RunType.QUERY_DIFF: QueryDiffTask,
    RunType.ROW_COUNT_DIFF: RowCountDiffTask,
}

_pool_lock_guard = Lock()


@dataclass
class SqlmeshAdapter(BaseAdapter):
    context: SqlmeshContext
    base_env: Environment
    curr_env: Environment
    duckdb_external_access: bool = False

    @property
    def _execution_lock(self):
        # SQLMesh can reuse one pool across adapters, and its singleton pool
        # shares a cursor between threads. Every Recce read (including opt-in)
        # must keep verification, execution and result fetching together.
        pool = self.context.engine_adapter._connection_pool
        with _pool_lock_guard:
            if "_recce_execution_lock" not in vars(pool):
                pool._recce_execution_lock = RLock()
            return pool._recce_execution_lock

    def support_tasks(self):
        support_map = {run_type.value: True for run_type in sqlmesh_supported_registry}
        support_map["change_analysis"] = False
        return support_map

    def get_lineage(self, base: Optional[bool] = False):
        state_reader: StateReader = self.context.state_reader
        env = self.base_env if base else self.curr_env
        nodes = {}
        parent_map = {}

        for snapshot in state_reader.get_snapshots(env.snapshots, hydrate_seeds=True).values():

            if snapshot.node_type.lower() != "model":
                continue

            model = snapshot.model
            if not model:
                continue

            node = {
                "unique_id": model.name,
                "name": model.name,
                "resource_type": snapshot.node_type.lower(),
                "checksum": {"checksum": snapshot.fingerprint.data_hash},
            }

            columns = {}
            for column, type in model.columns_to_types.items():
                columns[column] = {"name": column, "type": str(type)}
            node["columns"] = columns
            # SQLMesh has no catalog.json — `columns_to_types` is the
            # authoritative schema. Declare that coverage explicitly, or the
            # canonical classifier reads the missing key as legacy evidence and
            # marks every SQLMesh comparison unchecked.
            node["catalog_status"] = "covered" if columns else "unchecked"

            nodes[snapshot.name] = node
            parents = [snapshotId.name for snapshotId in snapshot.parents]
            parent_map[snapshot.name] = parents

        manifest_metadata = {}
        catalog_metadata = {}

        return dict(
            parent_map=parent_map,
            nodes=nodes,
            manifest_metadata=manifest_metadata,
            catalog_metadata=catalog_metadata,
        )

    def get_model(self, model_id: str, base=False):
        raise NotImplementedError()

    def select_nodes(
        self,
        select: Optional[str] = None,
        exclude: Optional[str] = None,
        packages: Optional[list[str]] = None,
        view_mode: Optional[Literal["all", "changed_models"]] = None,
    ) -> Set[str]:
        raise RecceException("SQLMesh does not support dbt node selectors.")

    def get_node_name_by_id(self, unique_id):
        model = self.context.models.get(unique_id)
        if model is None:
            return None
        return model.name

    @classmethod
    def load(cls, **kwargs):
        sqlmesh_envs = kwargs.get("sqlmesh_envs")
        if sqlmesh_envs is None:
            raise Exception("'--sqlmesh-envs SOURCE:TARGET' is required")

        envs = sqlmesh_envs.split(":")
        if len(envs) != 2:
            raise Exception('sqlmesh_envs must be in the format of "SOURCE:TARGET"')

        sqlmesh_config = kwargs.get("sqlmesh_config", None)
        context = SqlmeshContext(config=sqlmesh_config, load=False)
        if context.engine_adapter.dialect == "duckdb" and not kwargs.get("duckdb_external_access", False):
            # SQLMesh applies connector settings in order on first use. Disable
            # spilling before external access makes path exemptions immutable.
            connection_config = context.connection_config
            connection_config.connector_config = {
                "temp_directory": "",
                **{k: v for k, v in connection_config.connector_config.items() if k != "temp_directory"},
            }
        context.load()
        base_env = context.state_reader.get_environment(envs[0])
        curr_env = context.state_reader.get_environment(envs[1])
        if base_env is None:
            raise Exception(f"Source environment {envs[0]} not found")
        if curr_env is None:
            raise Exception(f"Target environment {envs[1]} not found")

        adapter = cls(
            context=context,
            base_env=base_env,
            curr_env=curr_env,
            duckdb_external_access=kwargs.get("duckdb_external_access", False),
        )
        if adapter._requires_duckdb_sandbox():
            with adapter._execution_lock, context.engine_adapter.transaction():
                cursor = context.engine_adapter.cursor
                lock_down_duckdb(cursor)
                # SQLMesh compares connector values to DuckDB's string readback
                # on every new worker cursor. Retain canonical effective values
                # so equivalent numbers/bools never retry SET after locking.
                cursor.execute("SELECT name, value FROM duckdb_settings()")
                effective_settings = dict(cursor.fetchall())
                for name in context.connection_config.connector_config:
                    if name in effective_settings:
                        context.connection_config.connector_config[name] = effective_settings[name]
        return adapter

    def _requires_duckdb_sandbox(self) -> bool:
        return self.context.engine_adapter.dialect == "duckdb" and not self.duckdb_external_access

    def replace_virtual_tables(self, sql: t.Union[exp.Expression, str], base: bool = None) -> exp.Expression:
        """
        Validate a single read-only query and replace virtual tables for the env.

        Args:
            sql: SQL expression to replace virtual tables
            base: True: replace virtual tables with base env, False: replace virtual tables with current env, None: no replacement
        """
        invalid_query = "SQLMesh requires a single read-only query."
        if isinstance(sql, str):
            try:
                statements = [
                    statement
                    for statement in parse(sql, dialect=self.context.default_dialect)
                    if statement is not None and not isinstance(statement, exp.Semicolon)
                ]
            except (ParseError, TokenError):
                raise RecceException(invalid_query) from None
            if len(statements) != 1:
                raise RecceException(invalid_query)
            expression = statements[0]
        else:
            expression = sql

        # A Query root may contain a write in a CTE or SELECT INTO. Validate
        # descendants too, including ASTs built by query-diff callers.
        disallowed = (
            exp.DDL,
            exp.DML,
            exp.Command,
            exp.Into,
            exp.Lock,
            exp.Block,
            exp.Pragma,
            exp.Set,
            exp.Install,
            exp.LoadData,
        )
        if not isinstance(expression, exp.Query) or any(isinstance(node, disallowed) for node in expression.walk()):
            raise RecceException(invalid_query)
        # Query roots can still mutate database or session state via routines.
        if any(
            isinstance(node, exp.Anonymous) and node.name.lower() in {"nextval", "setseed"}
            for node in expression.walk()
        ):
            raise RecceException(invalid_query)

        if base is not None:
            env = self.base_env if base else self.curr_env
            if env.name != "prod":
                model_names = [model.name for model in self.context.models.values()]
                for scope in traverse_scope(expression):
                    for table in scope.tables:
                        if f"{table.db}.{table.name}" in model_names:
                            table.args["db"] = f"{table.args['db']}__{env.name}"

        return expression

    def fetchdf_with_limit(
        self, sql: t.Union[exp.Expression, str], base: Optional[bool] = None, limit: Optional[int] = None
    ) -> (pd.DataFrame, bool):
        expression = self.replace_virtual_tables(sql, base=base)
        if limit:
            expression = (
                select("*").from_("__QUERY").with_("__QUERY", as_=expression).limit(limit + 1 if limit else None)
            )
        try:
            with self._execution_lock:
                if self._requires_duckdb_sandbox():
                    # SQLMesh may initialize or replace its execution cursor.
                    lock_down_duckdb(self.context.engine_adapter.cursor)
                if self.context.engine_adapter.dialect == "duckdb":
                    # SQLMesh's DuckDB transaction() is a no-op. Enforce read-only
                    # execution in DuckDB itself, including routines inside views
                    # and macros, even when external access is opted in.
                    cursor = self.context.engine_adapter.cursor
                    cursor.execute("BEGIN TRANSACTION READ ONLY")
                    try:
                        df = self.context.fetchdf(expression)
                    finally:
                        cursor.execute("ROLLBACK")
                else:
                    df = self.context.fetchdf(expression)
        except Exception as exc:
            extension_autoload_blocked = False
            if self._requires_duckdb_sandbox():
                from duckdb import CatalogException

                # With autoload disabled, DuckDB reports an extension-backed
                # function as absent rather than an external-access error.
                extension_autoload_blocked = (
                    isinstance(exc, CatalogException)
                    and "is not in the catalog, but it exists in the" in str(exc)
                    and "SET autoload_known_extensions=1" in str(exc)
                )
            if self.context.engine_adapter.dialect == "duckdb" and (
                is_duckdb_external_access_blocked(exc) or extension_autoload_blocked
            ):
                raise DuckDBExternalAccessBlocked() from exc
            raise
        if limit and len(df) > limit:
            df = df.head(limit)
            more = True
        else:
            more = False
        return df, more
