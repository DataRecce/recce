from typing import TypedDict, Optional

from recce.dbt import default_dbt_context
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
                base_row_count = None
                curr_row_count = None
                sql_query = 'select count(*) as ROW_COUNT from {{ ref("' + node + '") }}'

                try:
                    base = self.execute_sql(sql_query, base=True)
                except Exception as e:
                    print(e)
                    base = None
                self.check_cancel()

                try:
                    curr = self.execute_sql(sql_query, base=False)
                except Exception:
                    curr = None
                self.check_cancel()
                if base is not None:
                    base_row_count = int(base.rows[0][0])
                if curr is not None:
                    curr_row_count = int(curr.rows[0][0])

                # Cache the row_count result
                row_count = dict(base=base_row_count, curr=curr_row_count)
                result[node] = row_count

        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
