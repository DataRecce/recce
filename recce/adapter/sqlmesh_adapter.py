import typing as t
from dataclasses import dataclass
from typing import Dict, Optional, Type

import pandas as pd
from sqlglot import Expression, parse_one, select
from sqlglot.optimizer import traverse_scope
from sqlmesh.core.context import Context as SqlmeshContext
from sqlmesh.core.environment import Environment
from sqlmesh.core.state_sync import StateReader

from recce.adapter.base import BaseAdapter
from recce.models import RunType
from recce.tasks import QueryDiffTask, QueryTask, RowCountDiffTask, Task

sqlmesh_supported_registry: Dict[RunType, Type[Task]] = {
    RunType.QUERY: QueryTask,
    RunType.QUERY_DIFF: QueryDiffTask,
    RunType.ROW_COUNT_DIFF: RowCountDiffTask,
}


@dataclass
class SqlmeshAdapter(BaseAdapter):
    context: SqlmeshContext
    base_env: Environment
    curr_env: Environment

    def support_tasks(self):
        return {run_type.value: True for run_type in sqlmesh_supported_registry}

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
        context = SqlmeshContext(config=sqlmesh_config)
        base_env = context.state_reader.get_environment(envs[0])
        curr_env = context.state_reader.get_environment(envs[1])
        if base_env is None:
            raise Exception(f"Source environment {envs[0]} not found")
        if curr_env is None:
            raise Exception(f"Target environment {envs[1]} not found")

        return cls(context=context, base_env=base_env, curr_env=curr_env)

    def replace_virtual_tables(self, sql: t.Union[Expression, str], base: bool = None) -> Expression:
        """
        Replace virtual tables based on the env name.

        Args:
            sql: SQL expression to replace virtual tables
            base: True: replace virtual tables with base env, False: replace virtual tables with current env, None: no replacement
        """
        if isinstance(sql, str):
            expression = parse_one(sql, dialect=self.context.default_dialect)
        else:
            expression = sql

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
        self, sql: t.Union[Expression, str], base: Optional[bool] = None, limit: Optional[int] = None
    ) -> (pd.DataFrame, bool):
        expression = self.replace_virtual_tables(sql, base=base)
        if limit:
            expression = (
                select("*").from_("__QUERY").with_("__QUERY", as_=expression).limit(limit + 1 if limit else None)
            )
        df = self.context.fetchdf(expression)
        if limit and len(df) > limit:
            df = df.head(limit)
            more = True
        else:
            more = False
        return df, more
