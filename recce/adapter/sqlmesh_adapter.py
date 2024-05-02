import typing as t
from dataclasses import dataclass
from typing import Optional

import pandas as pd
from sqlglot import parse_one, Expression, select
from sqlglot.optimizer import traverse_scope
from sqlmesh.core.context import Context as SqlmeshContext
from sqlmesh.core.environment import Environment
from sqlmesh.core.state_sync import StateReader

from recce.adapter.base import BaseAdapter


@dataclass
class SqlmeshAdapter(BaseAdapter):
    context: SqlmeshContext
    base_env: Environment
    curr_env: Environment

    def get_lineage(self, base: Optional[bool] = False):
        state_reader: StateReader = self.context.state_reader
        env = self.base_env if base else self.curr_env
        nodes = {}
        parent_map = {}

        for snapshot in state_reader.get_snapshots(env.snapshots, hydrate_seeds=True).values():

            if snapshot.node_type.lower() != 'model':
                continue

            model = snapshot.model
            if not model:
                continue

            node = {
                'unique_id': model.name,
                'name': model.name,
                'resource_type': snapshot.node_type.lower(),
                'checksum': {'checksum': snapshot.fingerprint.data_hash},
            }

            columns = {}
            for column, type in model.columns_to_types.items():
                columns[column] = {'name': column, 'type': str(type)}
            node['columns'] = columns

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

    @classmethod
    def load(cls, **kwargs):
        sqlmesh_envs = kwargs.get('sqlmesh_envs')
        if sqlmesh_envs is None:
            raise Exception('\'--sqlmesh-envs SOURCE:TARGET\' is required')

        envs = sqlmesh_envs.split(':')
        if len(envs) != 2:
            raise Exception('sqlmesh_envs must be in the format of "SOURCE:TARGET"')

        sqlmesh_config = kwargs.get('sqlmesh_config', None)
        context = SqlmeshContext(config=sqlmesh_config)
        base_env = context.state_reader.get_environment(envs[0])
        curr_env = context.state_reader.get_environment(envs[1])
        if base_env is None:
            raise Exception(f"Source environment {envs[0]} not found")
        if curr_env is None:
            raise Exception(f"Target environment {envs[1]} not found")

        return cls(context=context, base_env=base_env, curr_env=curr_env)

    def fetchdf_with_limit(
        self,
        sql: t.Union[Expression, str],
        base: bool = False,
        limit: Optional[int] = None
    ) -> (pd.DataFrame, bool):
        if isinstance(sql, str):
            expression = parse_one(sql, dialect=self.context.default_dialect)
        else:
            expression = sql

        env = self.base_env if base else self.curr_env
        model_names = [model.name for model in self.context.models.values()]
        if env.name != 'prod':
            for scope in traverse_scope(expression):
                for table in scope.tables:
                    if f'{table.db}.{table.name}' in model_names:
                        table.args['db'] = f"{table.args['db']}__{env.name}"

        if limit:
            expression = select(
                '*'
            ).from_(
                '__QUERY'
            ).with_(
                '__QUERY', as_=expression
            ).limit(limit + 1 if limit else None)
        df = self.context.fetchdf(expression)
        if limit and len(df) > limit:
            df = df.head(limit)
            more = True
        else:
            more = False
        return df, more
