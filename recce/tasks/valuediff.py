from typing import List, Optional, TypedDict, Union

from pydantic import BaseModel

from ..core import default_context
from ..exceptions import RecceException
from ..models import Check
from .core import CheckValidator, Task, TaskResultDiffer
from .dataframe import DataFrame


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
    def _verify_primary_key(self, dbt_adapter, primary_key: Union[str, List[str]], model: str):
        self.update_progress(message=f"Verify primary key: {primary_key}")
        composite = True if isinstance(primary_key, List) else False

        if composite:
            if len(primary_key) == 0:
                raise RecceException("Primary key cannot be empty")
            sql_template = r"""
            {%- set column_list = primary_key %}
            {%- set columns_csv = column_list | join(', ') %}

            with validation_errors as (
                select
                    {{ columns_csv }}
                from {{ relation }}
                group by {{ columns_csv }}
                having count(*) > 1
            )

            select *
            from validation_errors
            """
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
                        f"Invalid primary key: \"{primary_key}\". The column should be unique. Please check by this sql: '{sql}'"
                    )
                break
            else:
                # it will never happen unless we use a wrong check sql
                raise RecceException("Cannot verify primary key")


class ValueDiffTask(Task, ValueDiffMixin):
    def __init__(self, params):
        super().__init__()
        self.params = ValueDiffParams(**params)
        self.connection = None
        self.legacy_surrogate_key = True

    def _query_value_diff(
        self,
        dbt_adapter,
        primary_key: Union[str, List[str]],
        model: str,
        columns: List[str] = None,
    ):
        import agate

        column_groups = {}
        composite = True if isinstance(primary_key, List) else False

        if columns is None or len(columns) == 0:
            base_columns = [column.column for column in dbt_adapter.get_columns(model, base=True)]
            curr_columns = [column.column for column in dbt_adapter.get_columns(model, base=False)]
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
        {%- set default_null_value = "_recce_surrogate_key_null_" -%}
        {%- set fields = [] -%}

        {%- for field in primary_keys -%}
            {%- do fields.append(
                "coalesce(cast(" ~ field ~ " as " ~ dbt.type_string() ~ "), '" ~ default_null_value  ~"')"
            ) -%}

            {%- if not loop.last %}
                {%- do fields.append("'-'") -%}
            {%- endif -%}
        {%- endfor -%}

        {%- set _pk = dbt.hash(dbt.concat(fields)) -%}

        with a_query as (
            select {{ _pk }} as _pk, * from {{ base_relation }}
        ),

        b_query as (
            select {{ _pk }} as _pk, * from {{ curr_relation }}
        ),

        joined as (
            select
                coalesce(a_query._pk, b_query._pk) as _pk,
                a_query.{{ column_to_compare }} as a_query_value,
                b_query.{{ column_to_compare }} as b_query_value,
                case
                    when a_query.{{ column_to_compare }} = b_query.{{ column_to_compare }} then 'perfect match'
                    when a_query.{{ column_to_compare }} is null and b_query.{{ column_to_compare }} is null then 'both are null'
                    when a_query._pk is null then 'missing from {{ a_relation_name }}'
                    when b_query._pk is null then 'missing from {{ b_relation_name }}'
                    when a_query.{{ column_to_compare }} is null then 'value is null in {{ a_relation_name }} only'
                    when b_query.{{ column_to_compare }} is null then 'value is null in {{ b_relation_name }} only'
                    when a_query.{{ column_to_compare }} != b_query.{{ column_to_compare }} then 'values do not match'
                    else 'unknown' -- this should never happen
                end as match_status
            from a_query
            full outer join b_query on a_query._pk = b_query._pk
        ),

        aggregated as (
            select
                '{{ column_to_compare }}' as column_name,
                match_status,
                count(*) as count_records
            from joined
            group by column_name, match_status
        )

        select
            column_name,
            match_status,
            count_records,
            round(100.0 * count_records / sum(count_records) over (), 2) as percent_of_total
        from aggregated
        """

        for column in columns:
            self.update_progress(message=f"Diff column: {column}", percentage=completed / len(columns))

            sql = dbt_adapter.generate_sql(
                sql_template,
                context=dict(
                    base_relation=dbt_adapter.create_relation(model, base=True),
                    curr_relation=dbt_adapter.create_relation(model, base=False),
                    primary_keys=primary_key if composite else [primary_key],
                    column_to_compare=column,
                ),
            )

            _, table = dbt_adapter.execute(sql, fetch=True)
            if column not in column_groups:
                column_groups[column] = dict(added=0, removed=0, mismatched=0, matched=0)
            for row in table.rows:
                # data example:
                # ('COLUMN_NAME', 'MATCH_STATUS', 'COUNT_RECORDS', 'PERCENT_OF_TOTAL')
                # ('EVENT_ID', 'perfect match', 158601510, Decimal('100.00'))
                column_name, column_state, row_count, total_rate = row
                if "column_name" == row[0].lower():
                    # skip column names
                    return

                # sample data like this:
                #     https://github.com/dbt-labs/dbt-audit-helper/blob/main/macros/compare_column_values.sql
                #
                #     'perfect match'            -> matched
                #     'both are null'            -> matched
                #     'missing from a'           -> row added
                #     'missing from b'           -> row removed
                #     'value is null in a only'  -> mismatched
                #     'value is null in b only'  -> mismatched
                #     'values do not match'      -> mismatched
                #     'unknown'                  -> this should never happen
                # end as match_status,

                state_mappings = {
                    "perfect match": "matched",
                    "both are null": "matched",
                    "missing from a": "added",
                    "missing from b": "removed",
                    "value is null in a only": "mismatched",
                    "value is null in b only": "mismatched",
                    "values do not match": "mismatched",
                }

                # Use the mapping to update counts
                for state, action in state_mappings.items():
                    if state in column_state:
                        column_groups[column_name][action] += row_count

            # Cancel as early as possible
            self.check_cancel()

            completed = completed + 1

        first = list(column_groups.values())[0]
        added = first["added"]
        removed = first["removed"]
        common = first["matched"] + first["mismatched"]
        total = common + added + removed

        row = []
        for k, v in column_groups.items():
            if composite and k.lower() == "_pk":
                continue
            # This is incorrect when there are one side null
            # https://github.com/dbt-labs/dbt-audit-helper/blob/main/macros/compare_column_values.sql#L20-L23
            # matched = v['matched']
            matched = common - v["mismatched"]
            rate = None if common == 0 else matched / common
            record = [k, matched, rate]
            row.append(record)

        column_names = ["column", "matched", "matched_p"]
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
        summary = result.get("summary", {})
        added = summary.get("added", 0)
        removed = summary.get("removed", 0)
        changes = {"column_changed": []}

        if added > 0:
            is_changed = True
            changes["row_added"] = added

        if removed > 0:
            is_changed = True
            changes["row_removed"] = removed

        row_data = result.get("data", {}).get("data", [])
        for row in row_data:
            column, matched, matched_p = row
            if float(matched_p) < 1.0:
                # if there is any mismatched, we consider it as changed
                is_changed = True
                changes["column_changed"].append(
                    {
                        "column": column,
                        "matched": matched,
                        "matched_p": matched_p,
                    }
                )

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

    def _query_value_diff(
        self,
        dbt_adapter,
        primary_key: Union[str, List[str]],
        model: str,
        columns: List[str] = None,
    ):
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
        with a_query as (
            select {{ columns | join(',\n') }} from {{ base_relation }}
        ),

        b_query as (
            select {{ columns | join(',\n') }} from {{ curr_relation }}
        ),

        a_intersect_b as (
            select * from a_query
            {{ dbt.intersect() }}
            select * from b_query
        ),

        a_except_b as (
            select * from a_query
            {{ dbt.except() }}
            select * from b_query
        ),

        b_except_a as (
            select * from b_query
            {{ dbt.except() }}
            select * from a_query
        ),

        all_records as (
            select
                *,
                true as in_a,
                true as in_b
            from a_intersect_b

            union all

            select
                *,
                true as in_a,
                false as in_b
            from a_except_b

            union all

            select
                *,
                false as in_a,
                true as in_b
            from b_except_a
        )

        select * from all_records
        where not (in_a and in_b)
        order by {{ primary_keys | join(',\n') }}, in_a desc, in_b desc
        limit {{ limit }}
        """

        sql = dbt_adapter.generate_sql(
            sql_template,
            context=dict(
                base_relation=dbt_adapter.create_relation(model, base=True),
                curr_relation=dbt_adapter.create_relation(model, base=False),
                primary_keys=primary_key if composite else [primary_key],
                columns=columns,
                limit=1000,
            ),
        )

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
        diff_data = result.get("data")
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
