import json
from typing import TypedDict, Optional, List

import pandas as pd

from recce.dbt import default_dbt_context, DBTContext
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
        self.connection = None

    def _verify_audit_helper(self, dbt_context):
        # Check if compare_column_values macro exists
        for macro_name, macro in dbt_context.manifest.macros.items():
            if 'compare_column_values' in macro_name:
                break
        else:
            raise RecceException(f"Cannot find macro compare_column_values")

    def _verify_primary_key(self, dbt_context: DBTContext, primary_key: str, model: str):
        query = r"""
            SELECT COUNT(*) AS INVALIDS FROM (
                {{ adapter.dispatch('test_unique_combination_of_columns', 'dbt_utils')(
                     relation,
                     combination_of_columns=[column_name]
                   )
                }}
            )
        """

        # check primary keys
        for base in [True, False]:
            self.update_progress(f"Verify primary key: {primary_key} for {'base' if base is True else 'current'}")

            relation = dbt_context.create_relation(model, base)
            context = dict(
                relation=relation,
                column_name=primary_key,
            )

            sql = dbt_context.generate_sql(query, base=False, context=context)
            response, table = dbt_context.adapter.execute(sql, fetch=True)
            for row in table.rows:
                invalids = row[0]
                if invalids > 0:
                    raise RecceException(
                        f"Invalid primary key: {primary_key}. The column should be unique")
                break
            else:
                # it will never happen unless we use a wrong check sql
                raise RecceException('Cannot verify primary key')

    def _query_value_diff(self, dbt_context: DBTContext, primary_key: str, model: str):
        column_groups = {}

        base_columns = [column.column for column in dbt_context.get_columns(model, base=True)]
        curr_columns = [column.column for column in dbt_context.get_columns(model, base=False)]
        common_columns = [column for column in base_columns if column in curr_columns]

        for column in common_columns:
            self.update_progress(f"Diff column: {column}")
            sql_template = r"""
            {% set a_query %}
                select * from {{ base_relation }}
            {% endset %}

            {% set b_query %}
                select * from {{ curr_relation }}
            {% endset %}

            {{ audit_helper.compare_column_values(
                a_query=a_query,
                b_query=b_query,
                primary_key=primary_key,
                column_to_compare=column_to_compare
            ) }}
            """
            sql = dbt_context.generate_sql(sql_template, context=dict(
                base_relation=dbt_context.create_relation(model, base=True),
                curr_relation=dbt_context.create_relation(model, base=False),
                primary_key=primary_key,
                column_to_compare=column,
            ))

            _, table = dbt_context.adapter.execute(sql, fetch=True)
            for row in table.rows:
                # data example:
                # ('COLUMN_NAME', 'MATCH_STATUS', 'COUNT_RECORDS', 'PERCENT_OF_TOTAL')
                # ('EVENT_ID', '✅: perfect match', 158601510, Decimal('100.00'))
                column_name, column_state, row_count, total_rate = row
                if 'column_name' == row[0].lower():
                    # skip column names
                    return

                #
                # sample data like this:
                #     https://github.com/dbt-labs/dbt-audit-helper/blob/main/macros/compare_column_values.sql
                #
                #     '✅: perfect match'            -> matched
                #     '✅: both are null'            -> matched
                #     '🤷: missing from a'           -> row added
                #     '🤷: missing from b'           -> row removed
                #     '🤷: value is null in a only'  -> mismatched
                #     '🤷: value is null in b only'  -> mismatched
                #     '🙅: values do not match'      -> mismatched
                #     'unknown'                      -> this should never happen
                # end as match_status,

                if column_name not in column_groups:
                    column_groups[column_name] = dict(added=0, removed=0, mismatched=0, matched=0)
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

                # Cancel as early as possible
                self.check_cancel()

        row = []
        for k, v in column_groups.items():
            matched = v['matched']
            mismatched = v['mismatched']
            rate_base = matched + mismatched
            rate = None if rate_base == 0 else 100 * (matched / rate_base)
            record = [k, matched, rate]
            row.append(record)

        pk = [v for k, v in column_groups.items() if k.lower() == primary_key.lower()][0]
        added = pk['added']
        removed = pk['removed']
        total = pk['matched'] + added + removed

        columns = ['Column', 'Matched', 'Matched %']
        df = pd.DataFrame(row, columns=columns)

        result = dict(
            summary=dict(total=total, added=added, removed=removed),
            data=json.loads(df.to_json(orient='table', index=False)),
            errors=[],
        )
        return result

    def execute(self):
        dbt_context = default_dbt_context()
        adapter = dbt_context.adapter

        with adapter.connection_named("value diff"):
            primary_key: str = self.params['primary_key']
            model: str = self.params['model']

            self._verify_audit_helper(dbt_context)
            self.check_cancel()

            self._verify_primary_key(dbt_context, primary_key, model)
            self.check_cancel()

            return self._query_value_diff(dbt_context, primary_key, model)

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
