from typing import TypedDict

from recce.dbt import default_dbt_context
from recce.tasks import Task
from recce.tasks.query import QueryMixin


class TopKDiffParams(TypedDict):
    model: str
    column_name: str
    column_type: str
    k: int


class TopKDiffTask(Task, QueryMixin):
    def __init__(self, params: TopKDiffParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute(self):
        result = {}
        from dbt.adapters.sql import SQLAdapter
        dbt_context = default_dbt_context()
        adapter: SQLAdapter = dbt_context.adapter

        with adapter.connection_named("query"):
            self.connection = adapter.connections.get_thread_connection()
            node = self.params['model']
            column = self.params['column_name']
            k = self.params.get('k', 10)
            sql_query = f"""
                    WITH frequency_counts AS (
                        SELECT
                            {column} as value,
                            COUNT(*) as frequency
                        FROM {{{{ ref("{node}") }}}}
                        GROUP BY {column}
                        ORDER BY frequency DESC, value ASC
                        LIMIT {k}
                    )

                    SELECT * FROM frequency_counts
                    """
            valid_counts_query = f"""
                    SELECT COUNT(*) as valid_counts
                    FROM {{{{ ref("{node}") }}}}
                    WHERE {column} IS NOT NULL
                    """

            try:
                base = self.execute_sql(sql_query, base=True)
                base_valid_counts = self.execute_sql(valid_counts_query, base=True)
            except Exception as e:
                print(e)
                result = None
            self.check_cancel()

            try:
                curr = self.execute_sql(sql_query, base=False)
                curr_valid_counts = self.execute_sql(valid_counts_query, base=False)
            except Exception:
                curr = None
            self.check_cancel()

            if base is not None:
                result['base'] = {
                    'values': [(row[0]) for row in base.rows],
                    'counts': [(row[1]) for row in base.rows],
                    'valids': base_valid_counts.rows[0][0] if base_valid_counts is not None else 0
                }
            if curr is not None:
                result['current'] = {
                    'values': [(row[0]) for row in curr.rows],
                    'counts': [(row[1]) for row in curr.rows],
                    'valids': curr_valid_counts.rows[0][0] if curr_valid_counts is not None else 0
                }
        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
