import json
from typing import TypedDict, Optional, List

import pandas as pd

from recce.dbt import default_dbt_context
from .core import Task
from ..exceptions import RecceException


class ValueDiffParams(TypedDict):
    primary_key: str
    model: str
    exclude_columns: Optional[List[str]]


class ValueDiffTask(Task):

    def __init__(self, params: ValueDiffParams):
        super().__init__()
        self.params = params

    def execute(self):
        dbt_context = default_dbt_context()
        adapter = dbt_context.adapter

        with adapter.connection_named("valuediff"):
            primary_key: str = self.params['primary_key']
            model: str = self.params['model']

            self._verify_audit_helper(dbt_context)
            self.check_cancel()

            self._verify_primary_key(dbt_context, primary_key, model)
            self.check_cancel()

            return self._query_value_diff(dbt_context, primary_key, model)

    def _query_value_diff(self, dbt_context, primary_key: str, model: str):
        column_groups = {}

        def log_callback(data, info=False):

            if isinstance(data, tuple) and len(data) == 4:
                # data example:
                # ('COLUMN_NAME', 'MATCH_STATUS', 'COUNT_RECORDS', 'PERCENT_OF_TOTAL')
                # ('EVENT_ID', '✅: perfect match', 158601510, Decimal('100.00'))
                column_name, column_state, row_count, total_rate = data
                if 'column_name' == data[0].lower():
                    # skip column names
                    return

                # sample data like this:
                # case
                #     when a_query.{{ column_to_compare }} = b_query.{{ column_to_compare }} then '✅: perfect match' -- -> matched
                #     when a_query.{{ column_to_compare }} is null and b_query.{{ column_to_compare }} is null then '✅: both are null' -- -> matched
                #     when a_query.{{ primary_key }} is null then '🤷: ‍missing from a' -- -> row added
                #     when b_query.{{ primary_key }} is null then '🤷: missing from b'    -- -> row removed
                #     when a_query.{{ column_to_compare }} is null then '🤷: value is null in a only' -- -> mismatched
                #     when b_query.{{ column_to_compare }} is null then '🤷: value is null in b only' -- -> mismatched
                #     when a_query.{{ column_to_compare }} != b_query.{{ column_to_compare }} then '🙅: ‍values do not match' -- -> mismatched
                #     else 'unknown' -- this should never happen
                # end as match_status,

                if column_name not in column_groups:
                    column_groups[column_name] = dict(matched=0, added=0, removed=0, mismatched=0, raw=[])
                if 'perfect match' in column_state:
                    column_groups[column_name]['matched'] += row_count
                if 'both are null' in column_state:
                    column_groups[column_name]['matched'] += row_count
                if 'missing from a' in column_state:
                    column_groups[column_name]['added'] += row_count
                if 'missing from b' in column_state:
                    column_groups[column_name]['removed'] += row_count
                if 'value is null in a only' in column_state:
                    column_groups[column_name]['mismatched'] += row_count
                if 'value is null in b only' in column_state:
                    column_groups[column_name]['mismatched'] += row_count
                if 'values do not match' in column_state:
                    column_groups[column_name]['mismatched'] += row_count
                column_groups[column_name]['raw'].append((column_state, row_count))

        def pick_columns_to_compare(c1, c2):
            stat = {}
            for c in c1 + c2:
                if c.name not in stat:
                    stat[c.name] = 1
                else:
                    stat[c.name] = stat[c.name] + 1

            # only check the column both existing
            for c in c1 + c2:
                if c.name not in stat:
                    continue

                both_existing = stat[c.name] == 2
                del stat[c.name]
                if both_existing:
                    yield c
                else:
                    continue

        sql_template = r"""
        {%- set columns_to_compare=pick_columns_to_compare(
            adapter.get_columns_in_relation(ref(model)), adapter.get_columns_in_relation(base_relation))
        -%}

        {% set old_etl_relation_query %}
            select * from {{ base_relation }}
        {% endset %}

        {% set new_etl_relation_query %}
            select * from {{ ref(model) }}
        {% endset %}

        {% if execute %}
            {% for column in columns_to_compare %}
                {{ log_callback('Comparing column "' ~ column.name ~'"', info=True) }}
                {% set audit_query = audit_helper.compare_column_values(
                        a_query=old_etl_relation_query,
                        b_query=new_etl_relation_query,
                        primary_key=primary_key,
                        column_to_compare=column.name
                ) %}

                {% set audit_results = run_query(audit_query) %}

                {% do log_callback(audit_results.column_names, info=True) %}
                    {% for row in audit_results.rows %}
                          {% do log_callback(row.values(), info=True) %}
                    {% endfor %}
            {% endfor %}
        {% endif %}
        """

        dbt_context.generate_sql(sql_template, False,
                                 dict(
                                     model=model,
                                     primary_key=primary_key,
                                     log_callback=log_callback,
                                     base_relation=dbt_context.get_base_relation(model),
                                     pick_columns_to_compare=pick_columns_to_compare)
                                 )

        data = []
        for k, v in column_groups.items():
            matched = v['matched']
            mismatched = v['mismatched']
            rate_base = matched + mismatched
            rate = None if rate_base == 0 else 100 * (matched / rate_base)
            record = [k, matched, rate]
            data.append(record)

        pk = [v for k, v in column_groups.items() if k.lower() == primary_key.lower()][0]
        added = pk['added']
        removed = pk['removed']
        total = pk['matched'] + added + removed

        columns = ['Column', 'Matched', 'Matched %']
        df = pd.DataFrame(data, columns=columns)

        result = dict(
            summary=dict(total=total, added=added, removed=removed),
            data=json.loads(df.to_json(orient='table', index=False)),
            raw=column_groups,
            errors=None
        )
        return result

    def _verify_primary_key(self, dbt_context, primary_key: str, model: str):

        def callback(check_name, executor, sql, is_base: bool):
            table = executor(sql)
            invalids = len(table.rows)
            if invalids == 1:
                values = [r.values() for r in table.rows][0]
                if values != (0,):
                    raise RecceException(
                        f"Invalid primary key: {primary_key}. The column should be not null and unique")
            else:
                # it will never happen unless we use a wrong check sql
                raise BaseException('Cannot verify primary key')

        not_null_query = r"""
        {% set test_not_null_query %}
            SELECT COUNT(*) AS INVALIDS FROM ({{ adapter.dispatch('test_not_null', 'dbt')(ref(model), column_name) }})
        {% endset %}
        {{ callback(check_name, run_query, test_not_null_query, base) }}
        """

        unique_query = r"""
        {% set test_unique_query %}
            SELECT COUNT(*) AS INVALIDS FROM ({{ adapter.dispatch('test_unique', 'dbt')(ref(model), column_name) }})
        {% endset %}
        {{ callback(check_name, run_query, test_unique_query, base) }}
        """

        # check primary keys
        for base in [True, False]:
            for check_name, query in [('not_null', not_null_query), ('unique', unique_query)]:
                context = dict(
                    model=model,
                    column_name=primary_key,
                    base_relation=dbt_context.get_base_relation(model),
                    callback=callback,
                    base=base,
                    check_name=check_name
                )

                dbt_context.generate_sql(query, base, context)

    def _verify_audit_helper(self, dbt_context):
        # Check if compare_column_values macro exists
        for macro_name, macro in dbt_context.manifest.macros.items():
            if 'compare_column_values' in macro_name:
                break
        else:
            raise RecceException(f"Cannot find macro compare_column_values")
