from decimal import Decimal
from typing import TypedDict

from recce.dbt import default_dbt_context
from recce.tasks import Task
from recce.tasks.query import QueryMixin


def generate_top_k_sql(node, column, k):
    return f"""
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


def generate_selected_values_sql(node, column, values):
    def formalize(value):
        if value is None:
            return 'NULL'
        if isinstance(value, Decimal):
            return str(value)
        return f"'{value}'"

    value_list = ', '.join([formalize(v) for v in values])
    order_seq = ', '.join(str(i + 1) for i in range(len(values)))
    return f"""
WITH value_list AS (
    SELECT unnest(ARRAY[{value_list}]) AS {column}, -- Replace these with your specific values
    unnest(ARRAY[{order_seq}]) AS order_seq
),
aggregated_data AS (
    SELECT
        {column},
        COUNT(*) AS frequency
    FROM {{{{ ref("{node}") }}}}
    WHERE {column} IN ({', '.join([formalize(v) for v in values])}) -- This ensures the aggregation only considers your values
    GROUP BY {column}
)

SELECT
    vl.{column},
    COALESCE(ad.frequency, 0) AS frequency
FROM value_list vl
LEFT JOIN aggregated_data ad ON vl.{column} = ad.{column}
ORDER BY vl.order_seq
"""


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
            sql_top_k_query = generate_top_k_sql(node, column, k)
            valid_counts_query = f"""
                    SELECT COUNT(*) as valid_counts
                    FROM {{{{ ref("{node}") }}}}
                    WHERE {column} IS NOT NULL
                    """

            try:
                curr = self.execute_sql(sql_top_k_query, base=False)
                curr_valid_counts = self.execute_sql(valid_counts_query, base=False)
            except Exception as e:
                print('Failed to query the CURRENT top-k result', e)
                curr = None
            self.check_cancel()

            current_catalogs = None
            if curr is not None:
                current_catalogs = [row[0] for row in curr.rows]
                result['current'] = {
                    'values': current_catalogs,
                    'counts': [(row[1]) for row in curr.rows],
                    'valids': curr_valid_counts.rows[0][0] if curr_valid_counts is not None else 0
                }

            if current_catalogs is not None:
                try:
                    sql_selected_values_query = generate_selected_values_sql(node, column, current_catalogs)
                    base = self.execute_sql(sql_selected_values_query, base=True)
                    base_valid_counts = self.execute_sql(valid_counts_query, base=True)
                except Exception as e:
                    print('Failed to query the BASE top-k result', e)
                    result = None
                self.check_cancel()

                if base is not None:
                    result['base'] = {
                        'values': [(row[0]) for row in base.rows],
                        'counts': [(row[1]) for row in base.rows],
                        'valids': base_valid_counts.rows[0][0] if base_valid_counts is not None else 0
                    }
            else:
                result = None

        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
