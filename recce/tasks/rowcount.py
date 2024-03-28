from typing import TypedDict, Optional

from recce.dbt import default_dbt_context, DBTContext
from recce.tasks import Task
from recce.tasks.query import QueryMixin


class RowCountDiffParams(TypedDict, total=False):
    node_names: Optional[list[str]]
    node_ids: Optional[list[str]]


class RowCountDiffTask(Task, QueryMixin):
    def __init__(self, params: RowCountDiffParams):
        super().__init__()
        self.params = params
        self.connection = None

    def _query_row_count(self, dbt_context: DBTContext, model_name, base=False):
        node = dbt_context.find_node_by_name(model_name, base=base)
        if node is None:
            return None

        if node.resource_type != 'model':
            return None

        if node.config and node.config.materialized not in ['table', 'view', 'incremental']:
            return None

        relation = dbt_context.create_relation(model_name, base=base)
        if relation is None:
            return None

        sql_template = r"select count(*) from {{ relation }}"
        sql = dbt_context.generate_sql(sql_template, context=dict(relation=relation))
        _, table = dbt_context.execute(sql, fetch=True)
        return int(table[0][0]) if table[0][0] is not None else 0

    def execute(self):
        result = {}

        from dbt.adapters.sql import SQLAdapter
        dbt_context = default_dbt_context()
        adapter: SQLAdapter = dbt_context.adapter

        query_candidates = []
        for node_id in self.params.get('node_ids', []):
            name = dbt_context.get_node_name_by_id(node_id)
            if name:
                query_candidates.append(name)
        for node in self.params.get('node_names', []):
            query_candidates.append(node)

        # Query row count for nodes that are not cached
        with adapter.connection_named("query"):
            self.connection = adapter.connections.get_thread_connection()
            for node in query_candidates:
                base_row_count = self._query_row_count(dbt_context, node, base=True)
                self.check_cancel()
                curr_row_count = self._query_row_count(dbt_context, node, base=False)
                self.check_cancel()
                result[node] = {
                    'base': base_row_count,
                    'curr': curr_row_count,
                }

        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
