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

    def _query_row_count(self, dbt_context, relation):
        sql_template = r"""
        select count(*) from {{ relation }}
        """
        sql = dbt_context.generate_sql(sql_template, context=dict(
            relation=relation
        ))
        _, table = dbt_context.adapter.execute(sql, fetch=True)
        row_count = table[0][0]
        return int(row_count) if row_count else 0

    def _query_top_k(self, dbt_context, base_relation, cur_relation, column, k):
        sql_template = r"""
        WITH
        BASE_CAT as (
            select
                coalesce(cast({{column}} as VARCHAR), '__null__') as category,
                count(*) as c
            from {{base_relation}}
            group by category
        ),
        CURR_CAT as (
            select
                coalesce(cast({{column}} as VARCHAR), '__null__') as category,
                count(*) as c
            from {{cur_relation}}
            group by category
        )
        select
            coalesce(CURR_CAT.category, BASE_CAT.category) as category,
            coalesce(BASE_CAT.c, 0) as base_count,
            coalesce(CURR_CAT.c, 0) as curr_count
        from CURR_CAT
        full outer join BASE_CAT
        on CURR_CAT.category = BASE_CAT.category
        order by curr_count desc, base_count desc
        limit {{k}}
        """
        sql = dbt_context.generate_sql(sql_template, context=dict(
            base_relation=base_relation,
            cur_relation=cur_relation,
            column=column,
            k=k,
        ))
        _, table = dbt_context.adapter.execute(sql, fetch=True)

        categories = []
        base_counts = []
        curr_counts = []

        for row in table:
            categories.append(row[0] if row[0] != '__null__' else None)
            base_counts.append(int(row[1] if row[1] else 0))
            curr_counts.append(int(row[2] if row[2] else 0))

        return categories, base_counts, curr_counts

    def execute(self):
        from dbt.adapters.sql import SQLAdapter
        dbt_context = default_dbt_context()
        adapter: SQLAdapter = dbt_context.adapter

        with adapter.connection_named("query"):
            self.connection = adapter.connections.get_thread_connection()
            model = self.params['model']
            column = self.params['column_name']
            k = self.params.get('k', 10)

            base_relation = dbt_context.create_relation(model, base=True)
            curr_relation = dbt_context.create_relation(model, base=False)
            self.check_cancel()
            categories, base_counts, curr_counts = self._query_top_k(
                dbt_context,
                base_relation,
                curr_relation,
                column,
                k
            )
            self.check_cancel()
            base_valids = self._query_row_count(dbt_context, base_relation)
            self.check_cancel()
            curr_valids = self._query_row_count(dbt_context, curr_relation)

            result = {
                'base': {
                    'values': categories,
                    'counts': base_counts,
                    'valids': base_valids,
                },
                'current': {
                    'values': categories,
                    'counts': curr_counts,
                    'valids': curr_valids,
                },
            }
            return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
