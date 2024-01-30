from typing import TypedDict

from recce.dbt import default_dbt_context
from recce.tasks import Task
from recce.tasks.query import QueryMixin


class RowCountDiffParams(TypedDict):
    node_names: list[str]


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
        nodes = self.params.get('node_names')
        for node in nodes:
            cached_row_count = dbt_context.row_count_cache.get(node)
            if cached_row_count is not None:
                result[node] = cached_row_count
            else:
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
                dbt_context.row_count_cache.put(node, row_count)
                result[node] = row_count

        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
