from typing import TypedDict, List

from pydantic import BaseModel

from .core import Task, TaskResultDiffer
from .dataframe import DataFrame
from ..core import default_context
from ..exceptions import RecceException


class ProfileParams(TypedDict):
    model: str


class ProfileResult(BaseModel):
    base: DataFrame
    current: DataFrame


class ProfileDiffTask(Task):

    def __init__(self, params: ProfileParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute(self):
        import agate
        from recce.adapter.dbt_adapter import DbtAdapter, merge_tables
        dbt_adapter: DbtAdapter = default_context().adapter

        model: str = self.params['model']

        self._verify_dbt_profiler(dbt_adapter)

        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()

            base_columns = [column for column in dbt_adapter.get_columns(model, base=True)]
            curr_columns = [column for column in dbt_adapter.get_columns(model, base=False)]
            total = len(base_columns) + len(curr_columns)
            completed = 0

            tables: List[agate.Table] = []

            for column in base_columns:
                self.update_progress(message=f'[Base] Profile column: {column.name}', percentage=completed / total)
                relation = dbt_adapter.create_relation(model, base=True)
                response, table = self._profile_column(dbt_adapter, relation, column)
                tables.append(table)
                completed = completed + 1
                self.check_cancel()
            base = DataFrame.from_agate(merge_tables(tables))

            tables: List[agate.Table] = []
            for column in curr_columns:
                self.update_progress(message=f'[Current] Profile column: {column.column}', percentage=completed / total)
                relation = dbt_adapter.create_relation(model, base=False)
                response, table = self._profile_column(dbt_adapter, relation, column)
                tables.append(table)
                completed = completed + 1
                self.check_cancel()
            current = DataFrame.from_agate(merge_tables(tables))

            return ProfileResult(base=base, current=current)

    def _verify_dbt_profiler(self, dbt_adapter):
        for macro_name, macro in dbt_adapter.manifest.macros.items():
            if macro.package_name == 'dbt_profiler':
                break
        else:
            raise RecceException(
                r"Package 'dbt_profiler' not found. Please refer to the link to install: https://hub.getdbt.com/data-mie/dbt_profiler/")

    def _profile_column(self, dbt_adapter, relation, column):

        sql_template = r"""
        select
        '{{column_name}}' as column_name,
        nullif('{{column_type}}', '') as data_type,
        {{ dbt_profiler.measure_row_count(column_name, column_type) }} as row_count,
        {{ dbt_profiler.measure_not_null_proportion(column_name, column_type) }} as not_null_proportion,
        {{ dbt_profiler.measure_distinct_proportion(column_name, column_type) }} as distinct_proportion,
        {{ dbt_profiler.measure_distinct_count(column_name, column_type) }} as distinct_count,
        {{ dbt_profiler.measure_is_unique(column_name, column_type) }} as is_unique,
        {{ dbt_profiler.measure_min(column_name, column_type) }} as min,
        {{ dbt_profiler.measure_max(column_name, column_type) }} as max,
        {{ dbt_profiler.measure_avg(column_name, column_type) }} as avg,
        {{ dbt_profiler.measure_median(column_name, column_type) }} as median
        from
        {{ relation }}
        """
        column_name = column.name
        column_type = column.dtype.lower()

        try:
            sql = dbt_adapter.generate_sql(
                sql_template,
                base=False,  # always false because we use the macro in current manifest
                context=dict(relation=relation, column_name=column_name, column_type=column_type)
            )
        except Exception as e:
            raise RecceException(f"Failed to generate SQL for profiling column: {column_name}") from e

        try:
            return dbt_adapter.execute(sql, fetch=True)
        except Exception as e:
            from recce.adapter.dbt_adapter import dbt_version
            if dbt_version < 'v1.8':
                from dbt.exceptions import DbtDatabaseError
            else:
                from dbt_common.exceptions import DbtDatabaseError
            if isinstance(e, DbtDatabaseError):
                if str(e).find('100051'):
                    # Snowflake error '100051 (22012): Division by zero"'
                    e = RecceException('No profile diff result due to the model is empty.', False)
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
        return self.diff(result['base'], result['current'])
