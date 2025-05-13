from typing import List

from pydantic import BaseModel

from ..core import default_context
from ..exceptions import RecceException
from ..models import Check
from .core import CheckValidator, Task, TaskResultDiffer
from .dataframe import DataFrame

PROFILE_COLUMN_JINJA_TEMPLATE = r"""
{# Conditions -------------------------------------------- #}
{%- set is_struct = column_type.startswith('struct') -%}
{%- set is_numeric =
    column_type.startswith('int') or
    column_type.startswith('float') or
    'numeric' in column_type or
    'number' in column_type or
    'double' in column_type or
    'bigint' in column_type
-%}
{%- set is_date_or_time =
    column_type.startswith('date') or
    column_type.startswith('timestamp')
-%}
{%- set is_logical = column_type.startswith('bool') -%}

{%- if db_type == 'sqlserver' -%}
    {%- set is_numeric = column_type in [
        "bigint", "numeric", "smallint", "decimal", "int",
        "tinyint", "money", "float", "real"
    ]-%}
{%- elif db_type == 'athena' -%}
    {%- set is_numeric =
        "int" in column_type or
        "float" in column_type or
        "decimal" in column_type or
        "double" in column_type
    -%}
{%- endif -%}

{# General Agg ------------------------------------------- #}
{%- set agg_row_count = 'cast(count(*) as ' ~ dbt.type_bigint() ~ ')' -%}
{%- set agg_not_null_proportion =
        'sum(case when ' ~ adapter.quote(column_name) ~ ' is null '
        ~ 'then 0 '
        ~ 'else 1 end) / '
        ~ 'cast(count(*) as ' ~ dbt.type_numeric() ~ ')'
-%}
{%- set agg_distinct_proportion =
        'count(distinct ' ~ adapter.quote(column_name) ~') / '
        ~ 'cast(count(*) as ' ~ dbt.type_numeric() ~ ')'
-%}
{%- set agg_distinct_count = 'count(distinct ' ~ adapter.quote(column_name) ~ ')' -%}
{%- set agg_is_unique =      'count(distinct ' ~ adapter.quote(column_name) ~ ') = count(*)' -%}
{%- set agg_min =            'cast(null as ' ~ dbt.type_string() ~ ')' -%}
{%- set agg_max =            'cast(null as ' ~ dbt.type_string() ~ ')' -%}
{%- set agg_avg =            'cast(null as ' ~ dbt.type_numeric() ~ ')' -%}
{%- set agg_median =         'cast(null as ' ~ dbt.type_numeric() ~ ')' -%}


{%- if is_struct -%}
    {%- set agg_distinct_proportion = 'cast(null as ' ~ dbt.type_numeric() ~ ')' -%}
    {%- set agg_distinct_count = 'cast(null as ' ~ dbt.type_numeric() ~ ')' -%}
    {%- set agg_is_unique = 'null' -%}
{%- endif -%}


{%- if (is_numeric or is_date_or_time) and (not is_struct) -%}
    {%- set agg_min =
        'cast(min(' ~ adapter.quote(column_name) ~ ') as ' ~ dbt.type_string() ~ ')'
    -%}
    {%- set agg_max =
        'cast(max(' ~ adapter.quote(column_name) ~ ') as ' ~ dbt.type_string() ~ ')'
    -%}
{%- endif -%}


{%- if is_numeric and not is_struct -%}
    {%- set agg_avg = 'avg(' ~ adapter.quote(column_name) ~ ')' -%}

    {%- if db_type == 'bigquery' -%}
        {%- set agg_median = 'approx_quantiles(' ~ adapter.quote(column_name) ~ ', 100)[offset(50)]' -%}
    {%- elif db_type == 'postgres' -%}
        {%- set agg_median = 'percentile_cont(0.5) within group (order by ' ~ adapter.quote(column_name) ~ ')' -%}
    {%- elif db_type == 'redshift' -%}
        {%- set agg_median =
            '(select percentile_cont(0.5) within group (order by '
            ~ adapter.quote(column_name) ~ ') from ' ~ relation ~ ')' -%}
    {%- elif db_type == 'athena' -%}
        {%- set agg_median = 'approx_percentile( ' ~ adapter.quote(column_name) ~ ', 0.5)' -%}
    {%- elif db_type == 'sqlserver' -%}
        {%- set agg_median = 'percentile_cont(' ~ adapter.quote(column_name) ~ ', 0.5) over ()' -%}
    {%- else -%}
        {%- set agg_median = 'median(' ~ adapter.quote(column_name) ~ ')' -%}
    {%- endif -%}
{%- elif is_logical -%}
    {%- set agg_avg = 'avg(case when ' ~ adapter.quote(column_name) ~ ' then 1 else 0 end)' -%}
{%- endif -%}


{# Overwrite Agg ----------------------------------------- #}

{# DRC-663: Support bigquery array type }
{%- set is_array = column_type.startswith('array') -%}
{%- if db_type == 'bigquery' and is_array -%}
    {%- set agg_distinct_proportion = 'cast(null as ' ~ dbt.type_numeric() ~ ')' -%}
    {%- set agg_distinct_count = 'cast(null as ' ~ dbt.type_numeric() ~ ')' -%}
    {%- set agg_is_unique = 'null' -%}
    {%- set agg_min =
        'cast(min(array_length(' ~ adapter.quote(column_name) ~ ')) as ' ~ dbt.type_string() ~ ')'
    -%}
    {%- set agg_max =
        'cast(max(array_length(' ~ adapter.quote(column_name) ~ ')) as ' ~ dbt.type_string() ~ ')'
    -%}
    {%- set agg_avg = 'avg(array_length(' ~ adapter.quote(column_name) ~ '))' -%}
    {%- set agg_median =
        'approx_quantiles(array_length(' ~ adapter.quote(column_name) ~ '), 100)[offset(50)]'
    -%}
{%- endif -%}


{# Main Query -------------------------------------------- #}

select
    '{{ column_name }}' as column_name,
    nullif('{{ column_type }}', '') as data_type,
    {{ agg_row_count }} as row_count,
    {{ agg_not_null_proportion }} as not_null_proportion,
    {{ agg_distinct_proportion }} as distinct_proportion,
    {{ agg_distinct_count }} as distinct_count,
    {{ agg_is_unique }} as is_unique,
    {{ agg_min }} as min,
    {{ agg_max }} as max,
    {{ agg_avg }} as avg,
    {{ agg_median }} as median
from {{ relation }}
"""


class ProfileParams(BaseModel):
    model: str
    columns: List[str] = None


class ProfileDiffResult(BaseModel):
    base: DataFrame
    current: DataFrame


class ProfileResult(BaseModel):
    current: DataFrame


class ProfileDiffTask(Task):

    def __init__(self, params):
        super().__init__()
        self.params = ProfileParams(**params)
        self.connection = None

    def execute(self):
        import agate

        from recce.adapter.dbt_adapter import DbtAdapter, merge_tables

        dbt_adapter: DbtAdapter = default_context().adapter

        model: str = self.params.model
        selected_columns: List[str] = self.params.columns

        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()

            base_columns = [column for column in dbt_adapter.get_columns(model, base=True)]
            curr_columns = [column for column in dbt_adapter.get_columns(model, base=False)]

            if selected_columns:
                # Only profile the columns in the filter_columns
                base_columns = [column for column in base_columns if column.name in selected_columns]
                curr_columns = [column for column in curr_columns if column.name in selected_columns]

            total = len(base_columns) + len(curr_columns)
            completed = 0

            tables: List[agate.Table] = []

            for column in base_columns:
                self.update_progress(message=f"[Base] Profile column: {column.name}", percentage=completed / total)
                relation = dbt_adapter.create_relation(model, base=True)
                response, table = self._profile_column(dbt_adapter, relation, column)
                tables.append(table)
                completed = completed + 1
                self.check_cancel()
            base = DataFrame.from_agate(merge_tables(tables))

            tables: List[agate.Table] = []
            for column in curr_columns:
                self.update_progress(message=f"[Current] Profile column: {column.column}", percentage=completed / total)
                relation = dbt_adapter.create_relation(model, base=False)
                response, table = self._profile_column(dbt_adapter, relation, column)
                tables.append(table)
                completed = completed + 1
                self.check_cancel()
            current = DataFrame.from_agate(merge_tables(tables))

            if len(base.columns) == 0 and len(current.columns) != 0:
                base.columns = current.columns
            elif len(base.columns) != 0 and len(current.columns) == 0:
                current.columns = base.columns

            return ProfileDiffResult(base=base, current=current)

    def _profile_column(self, dbt_adapter, relation, column):
        column_name = column.name
        column_type = column.data_type.lower()
        db_type = dbt_adapter.adapter.type().lower()

        try:
            sql = dbt_adapter.generate_sql(
                PROFILE_COLUMN_JINJA_TEMPLATE,
                base=False,  # always false because we use the macro in current manifest
                context=dict(relation=relation, column_name=column_name, column_type=column_type, db_type=db_type),
            )
        except Exception as e:
            raise RecceException(f"Failed to generate SQL for profiling column: {column_name}") from e

        try:
            return dbt_adapter.execute(sql, fetch=True)
        except Exception as e:
            from recce.adapter.dbt_adapter import dbt_version

            if dbt_version < "v1.8":
                from dbt.exceptions import DbtDatabaseError
            else:
                from dbt_common.exceptions import DbtDatabaseError
            if isinstance(e, DbtDatabaseError):
                if str(e).find("100051") >= 0:
                    # Snowflake error '100051 (22012): Division by zero"'
                    e = RecceException("No profile diff result due to the model is empty.", False)
            raise e

    def cancel(self):
        super().cancel()

        if self.connection:
            from recce.adapter.dbt_adapter import DbtAdapter

            dbt_adapter: DbtAdapter = default_context().adapter
            with dbt_adapter.connection_named("cancel"):
                dbt_adapter.cancel(self.connection)


class ProfileDiffResultDiffer(TaskResultDiffer):
    def _check_result_changed_fn(self, result):
        return self.diff(result["base"], result["current"])


class ProfileCheckValidator(CheckValidator):

    def validate_check(self, check: Check):
        try:
            ProfileParams(**check.params)
        except Exception as e:
            raise ValueError(f"Invalid check: {str(e)}")


class ProfileTask(ProfileDiffTask):
    def execute(self):
        import agate

        from recce.adapter.dbt_adapter import DbtAdapter, merge_tables

        dbt_adapter: DbtAdapter = default_context().adapter

        model: str = self.params.model
        selected_columns: List[str] = self.params.columns

        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()
            curr_columns = [column for column in dbt_adapter.get_columns(model, base=False)]

            if selected_columns:
                curr_columns = [column for column in curr_columns if column.name in selected_columns]

            total = len(curr_columns)
            completed = 0

            tables: List[agate.Table] = []
            for column in curr_columns:
                self.update_progress(message=f"[Current] Profile column: {column.column}", percentage=completed / total)
                relation = dbt_adapter.create_relation(model, base=False)
                response, table = self._profile_column(dbt_adapter, relation, column)
                tables.append(table)
                completed = completed + 1
                self.check_cancel()
            current = DataFrame.from_agate(merge_tables(tables))
            return ProfileResult(current=current)
