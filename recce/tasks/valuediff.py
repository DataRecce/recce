from typing import TypedDict, Optional, List

import agate
from dbt.adapters.sql import SQLAdapter
from pydantic import BaseModel

from recce.dbt import default_dbt_context, DBTContext
from .core import Task
from .dataframe import DataFrame
from ..exceptions import RecceException


class ValueDiffParams(TypedDict):
    primary_key: str
    model: str
    exclude_columns: Optional[List[str]]


class ValueDiffResult(BaseModel):
    class Summary(BaseModel):
        total: int
        added: int
        removed: int

    summary: Summary
    data: DataFrame


class ValueDiffMixin:
    def _verify_audit_helper(self, dbt_context):
        for macro_name, macro in dbt_context.manifest.macros.items():
            if macro.package_name == 'audit_helper':
                break
        else:
            raise RecceException(
                r"Package 'audit_helper' not found. Please refer to the link to install: https://hub.getdbt.com/dbt-labs/audit_helper/")

    def _verify_primary_key(self, dbt_context: DBTContext, primary_key: str, model: str):
        self.update_progress(message=f"Verify primary key: {primary_key}")

        if primary_key is None or len(primary_key) == 0:
            raise RecceException("Primary key cannot be empty")

        # check primary keys
        for base in [True, False]:

            relation = dbt_context.create_relation(model, base)
            context = dict(
                relation=relation,
                column_name=primary_key,
            )

            query = r"""{{ adapter.dispatch('test_unique', 'dbt')(relation, column_name) }}"""
            sql = dbt_context.generate_sql(query, base=False, context=context)
            sql_test = f"""SELECT COUNT(*) AS INVALIDS FROM ({sql}) AS T"""

            response, table = dbt_context.adapter.execute(sql_test, fetch=True)
            for row in table.rows:
                invalids = row[0]
                if invalids > 0:
                    raise RecceException(
                        f"Invalid primary key: {primary_key}. The column should be unique. Please check by this sql: '{sql}'")
                break
            else:
                # it will never happen unless we use a wrong check sql
                raise RecceException('Cannot verify primary key')


class ValueDiffTask(Task, ValueDiffMixin):

    def __init__(self, params: ValueDiffParams):
        super().__init__()
        self.params = params
        self.connection = None

    def _query_value_diff(self, dbt_context: DBTContext, primary_key: str, model: str, columns: List[str] = None):
        column_groups = {}

        if columns is None or len(columns) == 0:
            base_columns = [column.column for column in dbt_context.get_columns(model, base=True)]
            curr_columns = [column.column for column in dbt_context.get_columns(model, base=False)]
            columns = [column for column in base_columns if column in curr_columns]
        completed = 0

        if primary_key not in columns:
            columns.insert(0, primary_key)

        for column in columns:
            self.update_progress(message=f"Diff column: {column}", percentage=completed / len(columns))
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

            completed = completed + 1

        pk = [v for k, v in column_groups.items() if k.lower() == primary_key.lower()][0]
        added = pk['added']
        removed = pk['removed']
        common = pk['matched'] + pk['mismatched']
        total = common + added + removed

        row = []
        for k, v in column_groups.items():
            # This is incorrect when there are one side null
            # https://github.com/dbt-labs/dbt-audit-helper/blob/main/macros/compare_column_values.sql#L20-L23
            # matched = v['matched']
            matched = common - v['mismatched']
            rate = None if common == 0 else matched / common
            record = [k, matched, rate]
            row.append(record)

        column_names = ['column', 'matched', 'matched_p']
        column_types = [agate.Text(), agate.Number(), agate.Number()]
        table = agate.Table(row, column_names=column_names, column_types=column_types)

        return ValueDiffResult(
            summary=ValueDiffResult.Summary(total=total, added=added, removed=removed),
            data=DataFrame.from_agate(table),
        )

    def execute(self):
        dbt_context = default_dbt_context()
        adapter = dbt_context.adapter

        with adapter.connection_named("value diff"):
            self.connection = adapter.connections.get_thread_connection()

            primary_key: str = self.params['primary_key']
            model: str = self.params['model']
            columns: List[str] = self.params.get('columns')

            self._verify_audit_helper(dbt_context)
            self.check_cancel()

            self._verify_primary_key(dbt_context, primary_key, model)
            self.check_cancel()

            return self._query_value_diff(dbt_context, primary_key, model, columns=columns)

    def cancel(self):
        if self.connection:
            adapter: SQLAdapter = default_dbt_context().adapter
            with adapter.connection_named("cancel"):
                adapter.connections.cancel(self.connection)


class ValueDiffDetailParams(TypedDict):
    primary_key: str
    model: str
    columns: List[str]


class ValueDiffDetailResult(DataFrame):
    pass


class ValueDiffDetailTask(Task, ValueDiffMixin):

    def __init__(self, params: ValueDiffParams):
        super().__init__()
        self.params = params
        self.connection = None

    def _query_value_diff(self, dbt_context: DBTContext, primary_key: str, model: str, columns: List[str] = None):
        if columns is None or len(columns) == 0:
            base_columns = [column.column for column in dbt_context.get_columns(model, base=True)]
            curr_columns = [column.column for column in dbt_context.get_columns(model, base=False)]
            columns = [column for column in base_columns if column in curr_columns]

        if primary_key not in columns:
            columns.insert(0, primary_key)

        sql_template = r"""
        {% set col_list %}
            {%- for col in columns %}
                {{ col|trim }}
                {%- if not loop.last %},{{ '\n  ' }}{%- endif -%}
            {%- endfor -%}
        {% endset %}

        {% set a_query %}
            select {{col_list}} from {{ base_relation }}
        {% endset %}

        {% set b_query %}
            select {{col_list}} from {{ curr_relation }}
        {% endset %}

        {{ audit_helper.compare_queries(
            a_query=a_query,
            b_query=b_query,
            primary_key=primary_key,
            summarize=False,
        ) }} limit {{ limit }}
        """
        sql = dbt_context.generate_sql(sql_template, context=dict(
            base_relation=dbt_context.create_relation(model, base=True),
            curr_relation=dbt_context.create_relation(model, base=False),
            primary_key=primary_key,
            columns=columns,
            limit=1000,
        ))

        _, table = dbt_context.adapter.execute(sql, fetch=True)
        self.check_cancel()

        return DataFrame.from_agate(table)

    def execute(self):
        dbt_context = default_dbt_context()
        adapter = dbt_context.adapter

        with adapter.connection_named("value diff"):
            self.connection = adapter.connections.get_thread_connection()

            primary_key: str = self.params['primary_key']
            model: str = self.params['model']
            columns: List[str] = self.params.get('columns')

            self._verify_audit_helper(dbt_context)
            self.check_cancel()

            self._verify_primary_key(dbt_context, primary_key, model)
            self.check_cancel()

            return self._query_value_diff(dbt_context, primary_key, model, columns)

    def cancel(self):
        if self.connection:
            adapter: SQLAdapter = default_dbt_context().adapter
            with adapter.connection_named("cancel"):
                adapter.connections.cancel(self.connection)
