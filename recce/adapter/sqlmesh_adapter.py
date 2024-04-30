from dataclasses import dataclass
from typing import Optional

import pandas as pd
from sqlglot import parse_one
from sqlglot.optimizer import traverse_scope
from sqlmesh.core.context import Context as SqlmeshContext
from sqlmesh.core.state_sync import StateReader

from recce.adapter.base import BaseAdapter
from recce.state import ArtifactsRoot


@dataclass
class SqlmeshAdapter(BaseAdapter):
    context: SqlmeshContext

    def get_lineage(self, base: Optional[bool] = False):
        state_reader: StateReader = self.context.state_reader

        environments = state_reader.get_environments()
        print("envs", [e.name for e in environments])

        environment = state_reader.get_environment('prod' if base else 'dev')
        nodes = {}
        parent_map = {}

        for snapshot in state_reader.get_snapshots(environment.snapshots, hydrate_seeds=True).values():

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
    def load(cls, artifacts: ArtifactsRoot = None, **kwargs):
        context = SqlmeshContext()
        return cls(context=context)

    def fetchdf(self, sql, env: Optional[str] = None) -> pd.DataFrame:
        expression = parse_one(sql)

        if env is not None:
            for scope in traverse_scope(expression):
                for table in scope.tables:
                    table.args['db'] = f"{table.args['db']}__{env}"

        return self.context.fetchdf(expression)
