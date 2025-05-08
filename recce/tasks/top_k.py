from typing import Optional

from pydantic import BaseModel

from recce.core import default_context
from recce.models import Check
from recce.tasks import Task
from recce.tasks.core import CheckValidator, TaskResultDiffer
from recce.tasks.query import QueryMixin


class TopKDiffParams(BaseModel):
    model: str
    column_name: str
    k: Optional[int] = 10


class TopKDiffTask(Task, QueryMixin):
    def __init__(self, params):
        super().__init__()
        self.params = TopKDiffParams(**params)
        self.connection = None

    def _query_row_count_diff(self, dbt_adapter, base_relation, curr_relation, column):
        """
        Query the row count of the base and current relations

        :return: [base_total, base_valids, curr_total, curr_valids]
        """

        sql_template = r"""
        select count(*), count({{column}}) from {{ base_relation }}
        UNION ALL
        select count(*), count({{column}}) from {{ curr_relation }}
        """
        sql = dbt_adapter.generate_sql(
            sql_template,
            context=dict(
                base_relation=base_relation,
                curr_relation=curr_relation,
                column=column,
            ),
        )
        _, table = dbt_adapter.execute(sql, fetch=True)

        result = (table[0][0], table[0][1], table[1][0], table[1][1])

        return (int(v) if v is not None else 0 for v in result)

    def _query_top_k(self, dbt_adapter, base_relation, curr_relation, column, k):
        sql_template = r"""
        WITH
        BASE_CAT as (
            select
                coalesce(cast({{column}} as {{ dbt.type_string() }}), '__null__') as category,
                count(*) as c
            from {{base_relation}}
            {% if not include_null %}
            where {{column}} is not null
            {% endif %}
            group by 1
        ),
        CURR_CAT as (
            select
                coalesce(cast({{column}} as {{ dbt.type_string() }}), '__null__') as category,
                count(*) as c
            from {{curr_relation}}
            {% if not include_null %}
            where {{column}} is not null
            {% endif %}
            group by 1
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
        sql = dbt_adapter.generate_sql(
            sql_template,
            context=dict(
                base_relation=base_relation,
                curr_relation=curr_relation,
                column=column,
                k=k,
                include_null=False,
            ),
        )
        _, table = dbt_adapter.execute(sql, fetch=True)

        categories = []
        base_counts = []
        curr_counts = []

        for row in table:
            categories.append(row[0] if row[0] != "__null__" else None)
            base_counts.append(int(row[1] if row[1] else 0))
            curr_counts.append(int(row[2] if row[2] else 0))

        return categories, base_counts, curr_counts

    def execute(self):

        from recce.adapter.dbt_adapter import DbtAdapter

        dbt_adapter: DbtAdapter = default_context().adapter

        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()
            model = self.params.model
            column = self.params.column_name
            k = self.params.k or 10

            base_relation = dbt_adapter.create_relation(model, base=True)
            if base_relation is None:
                raise ValueError(f"Model '{model}' not found in the manifest")

            curr_relation = dbt_adapter.create_relation(model, base=False)
            if curr_relation is None:
                raise ValueError(f"Model '{model}' not found in the manifest")

            self.check_cancel()
            categories, base_counts, curr_counts = self._query_top_k(
                dbt_adapter, base_relation, curr_relation, column, k
            )
            self.check_cancel()

            base_total, base_valids, curr_total, curr_valids = self._query_row_count_diff(
                dbt_adapter, base_relation, curr_relation, column
            )

            result = {
                "base": {
                    "values": categories,
                    "counts": base_counts,
                    "valids": base_valids,
                    "total": base_total,
                },
                "current": {
                    "values": categories,
                    "counts": curr_counts,
                    "valids": curr_valids,
                    "total": curr_total,
                },
            }
            return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)


class TopKDiffTaskResultDiffer(TaskResultDiffer):
    def _check_result_changed_fn(self, result):
        base = result.get("base")
        current = result.get("current")

        return TaskResultDiffer.diff(base, current)


class TopKDiffCheckValidator(CheckValidator):

    def validate_check(self, check: Check):
        try:
            TopKDiffParams(**check.params)
        except Exception as e:
            raise ValueError(f"Invalid check: {str(e)}")
