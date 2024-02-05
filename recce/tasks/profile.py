from typing import TypedDict, List

import agate
from dbt.adapters.sql import SQLAdapter
from dbt.clients.agate_helper import merge_tables
from pydantic import BaseModel

from recce.dbt import default_dbt_context, DBTContext
from .core import Task
from .dataframe import DataFrame
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
        dbt_context = default_dbt_context()
        adapter = dbt_context.adapter

        model: str = self.params['model']

        self._verify_dbt_profiler(dbt_context)

        with adapter.connection_named("query"):
            self.connection = adapter.connections.get_thread_connection()

            base_columns = [column for column in dbt_context.get_columns(model, base=True)]
            curr_columns = [column for column in dbt_context.get_columns(model, base=False)]
            total = len(base_columns) + len(curr_columns)
            completed = 0

            tables: List[agate.Table] = []

            for column in base_columns:
                self.update_progress(message=f'[Base] Profile column: {column.name}', percentage=completed / total)
                relation = dbt_context.create_relation(model, base=True)
                response, table = self._profile_column(dbt_context, relation, column)
                tables.append(table)
                completed = completed + 1
                self.check_cancel()
            base = DataFrame.from_agate(merge_tables(tables))

            tables: List[agate.Table] = []
            for column in curr_columns:
                self.update_progress(message=f'[Current] Profile column: {column.column}', percentage=completed / total)
                relation = dbt_context.create_relation(model, base=False)
                response, table = self._profile_column(dbt_context, relation, column)
                tables.append(table)
                completed = completed + 1
                self.check_cancel()
            current = DataFrame.from_agate(merge_tables(tables))

            return ProfileResult(base=base, current=current)

    def _verify_dbt_profiler(self, dbt_context):
        for macro_name, macro in dbt_context.manifest.macros.items():
            if macro.package_name == 'dbt_profiler':
                break
        else:
            raise RecceException(
                r"Package 'dbt_profiler' not found. Please refer to the link to install: https://hub.getdbt.com/data-mie/dbt_profiler/")

    def _profile_column(self, dbt_context: DBTContext, relation, column):

        sql_template = r"""
        {%
        set column_type = column.dtype | lower
        %}

        select
        '{{column.name}}' as column_name,
        nullif('{{column.dtype}}', '') as data_type,
        {{ dbt_profiler.measure_row_count(column.name, column_type) }} as row_count,
        {{ dbt_profiler.measure_not_null_proportion(column.name, column_type) }} as not_null_proportion,
        {{ dbt_profiler.measure_distinct_proportion(column.name, column_type) }} as distinct_proportion,
        {{ dbt_profiler.measure_distinct_count(column.name, column_type) }} as distinct_count,
        {{ dbt_profiler.measure_is_unique(column.name, column_type) }} as is_unique,
        {{ dbt_profiler.measure_min(column.name, column_type) }} as min,
        {{ dbt_profiler.measure_max(column.name, column_type) }} as max,
        {{ dbt_profiler.measure_avg(column.name, column_type) }} as avg,
        {{ dbt_profiler.measure_median(column.name, column_type) }} as median
        from
        {{ relation }}
        """

        sql = dbt_context.generate_sql(
            sql_template,
            base=False,  # always false because we use the macro in current manifest
            context=dict(relation=relation, column=column)
        )

        return dbt_context.adapter.execute(sql, fetch=True)

    def _to_dataframe(self, table: agate.Table):
        import pandas as pd
        import json

        df = pd.DataFrame([row.values() for row in table.rows], columns=table.column_names)

        for column_name, column_type in zip(table.column_names, table.column_types):
            if column_name.lower() == 'not_null_proportion':
                df[column_name] = df[column_name].astype('float')
            if column_name.lower() == 'distinct_proportion':
                df[column_name] = df[column_name].astype('float')
        result_json = df.to_json(orient='table')
        return json.loads(result_json)

    def cancel(self):
        super().cancel()

        if self.connection:
            adapter: SQLAdapter = default_dbt_context().adapter
            with adapter.connection_named("cancel"):
                adapter.connections.cancel(self.connection)
