from typing import TypedDict, Optional, List, Union

from pydantic import BaseModel

from .core import Task, TaskResultDiffer, CheckValidator
from .dataframe import DataFrame
from ..core import default_context
from ..exceptions import RecceException
from ..models import Check


class ValueDiffParams(BaseModel):
    model: str
    primary_key: Union[str, List[str]]
    columns: Optional[List[str]] = None


class ValueDiffResult(BaseModel):
    class Summary(BaseModel):
        total: int
        added: int
        removed: int

    summary: Summary
    data: DataFrame


class ValueDiffMixin:
    def _verify_dbt_packages_deps(self, dbt_adapter):
        for macro_name, macro in dbt_adapter.manifest.macros.items():
            if macro.package_name == 'audit_helper':
                break
        else:
            raise RecceException(
                r"Package 'audit_helper' not found. Please refer to the link to install: https://hub.getdbt.com/dbt-labs/audit_helper/")

        for macro_name, macro in dbt_adapter.manifest.macros.items():
            if macro.package_name == 'dbt_utils' and macro.name == 'generate_surrogate_key':
                self.legacy_surrogate_key = False
                break

    def _verify_primary_key(self, dbt_adapter, primary_key: Union[str, List[str]], model: str):
        self.update_progress(message=f"Verify primary key: {primary_key}")
        composite = True if isinstance(primary_key, List) else False

        if composite:
            if len(primary_key) == 0:
                raise RecceException("Primary key cannot be empty")
            sql_template = r"""{{ adapter.dispatch('test_unique_combination_of_columns', 'dbt_utils')(relation, primary_key) }}"""
        else:
            if primary_key is None or len(primary_key) == 0:
                raise RecceException("Primary key cannot be empty")
            sql_template = r"""{{ adapter.dispatch('test_unique', 'dbt')(relation, primary_key) }}"""

        # check primary keys
        for base in [True, False]:

            relation = dbt_adapter.create_relation(model, base)
            context = dict(
                relation=relation,
                primary_key=primary_key,
            )

            sql = dbt_adapter.generate_sql(sql_template, context=context)
            sql_test = f"""SELECT COUNT(*) AS INVALIDS FROM ({sql}) AS T"""

            response, table = dbt_adapter.adapter.execute(sql_test, fetch=True)
            for row in table.rows:
                invalids = row[0]
                if invalids > 0:
                    raise RecceException(
                        f"Invalid primary key: \"{primary_key}\". The column should be unique. Please check by this sql: '{sql}'")
                break
            else:
                # it will never happen unless we use a wrong check sql
                raise RecceException('Cannot verify primary key')


class ValueDiffTask(Task, ValueDiffMixin):

    def __init__(self, params):
        super().__init__()
        self.params = ValueDiffParams(**params)
        self.connection = None
        self.legacy_surrogate_key = True

    def _query_value_diff(self, dbt_adpter, primary_key: Union[str, List[str]], model: str,
                          columns: List[str] = None):
        import agate

        column_groups = {}
        composite = True if isinstance(primary_key, List) else False

        if columns is None or len(columns) == 0:
            base_columns = [column.column for column in dbt_adpter.get_columns(model, base=True)]
            curr_columns = [column.column for column in dbt_adpter.get_columns(model, base=False)]
            columns = [column for column in base_columns if column in curr_columns]
        completed = 0

        if composite:
            for primary_key_comp in primary_key[::-1]:
                if primary_key_comp not in columns:
                    columns.insert(0, primary_key_comp)
        else:
            if primary_key not in columns:
                columns.insert(0, primary_key)

        sql_template = r"""
        {% set a_query %}
            select {{ __PRIMARY_KEY__ }} as _pk, * from {{ base_relation }}
        {% endset %}

        {% set b_query %}
            select {{ __PRIMARY_KEY__ }} as _pk, * from {{ curr_relation }}
        {% endset %}

        {{ audit_helper.compare_column_values(
            a_query=a_query,
            b_query=b_query,
            primary_key="_pk",
            column_to_compare=column_to_compare
        ) }}
        """

        if composite:
            if self.legacy_surrogate_key:
                new_primary_key = 'dbt_utils.surrogate_key(primary_key)'
            else:
                new_primary_key = 'dbt_utils.generate_surrogate_key(primary_key)'
        else:
            new_primary_key = 'primary_key'
        sql_template = sql_template.replace('__PRIMARY_KEY__', new_primary_key)

        for column in columns:
            self.update_progress(message=f"Diff column: {column}", percentage=completed / len(columns))

            sql = dbt_adpter.generate_sql(sql_template, context=dict(
                base_relation=dbt_adpter.create_relation(model, base=True),
                curr_relation=dbt_adpter.create_relation(model, base=False),
                primary_key=primary_key,
                column_to_compare=column,
            ))

            _, table = dbt_adpter.execute(sql, fetch=True)
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

        first = list(column_groups.values())[0]
        added = first['added']
        removed = first['removed']
        common = first['matched'] + first['mismatched']
        total = common + added + removed

        row = []
        for k, v in column_groups.items():
            if composite and k.lower() == "_pk":
                continue
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
        dbt_adapter = default_context().adapter

        with dbt_adapter.connection_named("value diff"):
            self.connection = dbt_adapter.get_thread_connection()

            primary_key: Union[str, List[str]] = self.params.primary_key
            model: str = self.params.model
            columns: List[str] = self.params.columns

            self._verify_dbt_packages_deps(dbt_adapter)
            self.check_cancel()

            self._verify_primary_key(dbt_adapter, primary_key, model)
            self.check_cancel()

            return self._query_value_diff(dbt_adapter, primary_key, model, columns=columns)

    def cancel(self):
        super().cancel()
        from recce.adapter.dbt_adapter import DbtAdapter

        if self.connection:
            adapter: DbtAdapter = default_context().adapter
            with adapter.connection_named("cancel"):
                adapter.cancel(self.connection)


class ValueDiffTaskResultDiffer(TaskResultDiffer):

    def _check_result_changed_fn(self, result):
        is_changed = False
        summary = result.get('summary', {})
        added = summary.get('added', 0)
        removed = summary.get('removed', 0)
        changes = {
            'column_changed': []
        }

        if added > 0:
            is_changed = True
            changes['row_added'] = added

        if removed > 0:
            is_changed = True
            changes['row_removed'] = removed

        row_data = result.get('data', {}).get('data', [])
        for row in row_data:
            column, matched, matched_p = row
            if float(matched_p) < 1.0:
                # if there is any mismatched, we consider it as changed
                is_changed = True
                changes['column_changed'].append({
                    'column': column,
                    'matched': matched,
                    'matched_p': matched_p,
                })

        return changes if is_changed else None


class ValueDiffDetailParams(TypedDict):
    primary_key: str
    model: str
    columns: List[str]


class ValueDiffDetailResult(DataFrame):
    pass


class ValueDiffDetailTask(Task, ValueDiffMixin):

    def __init__(self, params):
        super().__init__()
        self.params = ValueDiffParams(**params)
        self.connection = None
        self.legacy_surrogate_key = True

    def _query_value_diff(self, dbt_adapter, primary_key: Union[str, List[str]], model: str, columns: List[str] = None):

        composite = True if isinstance(primary_key, List) else False

        if columns is None or len(columns) == 0:
            base_columns = [column.column for column in dbt_adapter.get_columns(model, base=True)]
            curr_columns = [column.column for column in dbt_adapter.get_columns(model, base=False)]
            columns = [column for column in base_columns if column in curr_columns]

        if composite:
            for primary_key_comp in primary_key[::-1]:
                if primary_key_comp not in columns:
                    columns.insert(0, primary_key_comp)
        else:
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
            primary_key=__PRIMARY_KEY__,
            summarize=False,
        ) }} limit {{ limit }}
        """

        if composite:
            if self.legacy_surrogate_key:
                new_primary_key = 'dbt_utils.surrogate_key(primary_key)'
            else:
                new_primary_key = 'dbt_utils.generate_surrogate_key(primary_key)'
        else:
            new_primary_key = 'primary_key'
        sql_template = sql_template.replace('__PRIMARY_KEY__', new_primary_key)

        sql = dbt_adapter.generate_sql(sql_template, context=dict(
            base_relation=dbt_adapter.create_relation(model, base=True),
            curr_relation=dbt_adapter.create_relation(model, base=False),
            primary_key=primary_key,
            columns=columns,
            limit=1000,
        ))

        _, table = dbt_adapter.execute(sql, fetch=True)
        self.check_cancel()

        return DataFrame.from_agate(table)

    def execute(self):

        from recce.adapter.dbt_adapter import DbtAdapter
        dbt_adapter: DbtAdapter = default_context().adapter

        with dbt_adapter.connection_named("value diff"):
            self.connection = dbt_adapter.get_thread_connection()

            primary_key: Union[str, List[str]] = self.params.primary_key
            model: str = self.params.model
            columns: List[str] = self.params.columns

            self._verify_dbt_packages_deps(dbt_adapter)
            self.check_cancel()

            self._verify_primary_key(dbt_adapter, primary_key, model)
            self.check_cancel()

            return self._query_value_diff(dbt_adapter, primary_key, model, columns)

    def cancel(self):
        from recce.adapter.dbt_adapter import DbtAdapter
        if self.connection:
            adapter: DbtAdapter = default_context().adapter
            with adapter.connection_named("cancel"):
                adapter.cancel(self.connection)


class ValueDiffDetailTaskResultDiffer(TaskResultDiffer):

    def _check_result_changed_fn(self, result):
        diff_data = result.get('data')
        if diff_data is None or len(diff_data) == 0:
            return None

        # TODO: Implement detailed information of values changed
        return dict(values_changed={})


class ValueDiffCheckValidator(CheckValidator):

    def validate_check(self, check: Check):
        try:
            ValueDiffParams(**check.params)
        except Exception as e:
            raise ValueError(f"Invalid check: {str(e)}")
