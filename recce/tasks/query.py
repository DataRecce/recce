from typing import TypedDict

import agate
from dbt.adapters.sql import SQLAdapter

from recce.dbt import default_dbt_context
from .core import Task
from .dataframe import DataFrame
from ..exceptions import RecceException


class QueryMixin:
    @staticmethod
    def execute_sql(sql_template, base: bool = False) -> agate.Table:
        from jinja2.exceptions import TemplateSyntaxError
        dbt_context = default_dbt_context()
        adapter = dbt_context.adapter
        try:
            sql = dbt_context.generate_sql(sql_template, base)
            _, result = adapter.execute(sql, fetch=True, auto_begin=True)
            return result

        except TemplateSyntaxError as e:
            raise RecceException(f"Jinja template error: line {e.lineno}: {str(e)}")

    @staticmethod
    def close_connection(connection):
        adapter: SQLAdapter = default_dbt_context().adapter
        with adapter.connection_named("cancel query"):
            adapter.connections.cancel(connection)


class QueryParams(TypedDict):
    sql_template: str


QueryResult = DataFrame


class QueryDiffParams(TypedDict):
    sql_template: str


class QueryTask(Task, QueryMixin):
    def __init__(self, params: QueryParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute(self):
        adapter: SQLAdapter = default_dbt_context().adapter
        with adapter.connection_named("query"):
            self.connection = adapter.connections.get_thread_connection()

            sql_template = self.params.get('sql_template')
            table = self.execute_sql(sql_template, base=True)
            self.check_cancel()

            return DataFrame.from_agate(table)

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)


class QueryDiffTask(Task, QueryMixin):
    def __init__(self, params: QueryDiffParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute(self):
        result = {}

        from dbt.adapters.sql import SQLAdapter
        adapter: SQLAdapter = default_dbt_context().adapter

        with adapter.connection_named("query"):
            sql_template = self.params.get('sql_template')
            self.connection = adapter.connections.get_thread_connection()
            result['base'] = self.execute_sql(sql_template, base=True)
            self.check_cancel()

            result['current'] = self.execute_sql(sql_template, base=False)
            self.check_cancel()

        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
