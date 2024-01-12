import json
from typing import TypedDict, Optional, List

import pandas as pd

from recce.dbt import default_dbt_context
from .core import Task


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
        primary_key: str = self.params['primary_key']
        model: str = self.params['model']

        column_groups = {}
        errors = self.verify_primary_key(primary_key, model)

        if errors:
            columns = ['Column', 'Matched', 'Matched %']
            df = pd.DataFrame([], columns=columns)
            result = dict(
                summary=dict(total=0, added=0, removed=0),
                data=json.loads(df.to_json(orient='table', index=False)),
                raw=column_groups,
                errors=errors
            )
            return result

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

        with adapter.connection_named('test'):
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
                errors=errors
            )
            return result

    def verify_primary_key(self, primary_key: str, model: str):
        dbt_context = default_dbt_context()
        errors = []

        def callback(check_name, executor, sql, is_base: bool):
            table = executor(sql)
            invalids = len(table.rows)
            if invalids == 1:
                values = [r.values() for r in table.rows][0]
                if values != (0,):
                    errors.append(dict(
                        test=check_name,
                        sql=sql,
                        model=model,
                        column_name=primary_key,
                        base=is_base))
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

        def validate_audit_helper():
            check_audit_helper = "{{ audit_helper.compare_column_values }}"

            with dbt_context.adapter.connection_named('test'):
                try:
                    dbt_context.generate_sql(check_audit_helper, False, {})
                except BaseException as e:
                    last_line = str(e).split("\n")[-1].strip()
                    errors.append(dict(
                        test='check_audit_helper',
                        sql=last_line,
                        model='',
                        column_name='',
                        base=False))

        validate_audit_helper()
        if errors:
            return errors

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

                with dbt_context.adapter.connection_named('test'):
                    dbt_context.generate_sql(query, base, context)

        return errors
