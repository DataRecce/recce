from typing import TypedDict

from dbt.adapters.sql import SQLAdapter

from recce.dbt import default_dbt_context
from .core import Task
from ..exceptions import RecceException


class QueryMixin:
    @staticmethod
    def execute_sql(sql_template, base: bool = False):
        from jinja2.exceptions import TemplateSyntaxError
        import agate
        import pandas as pd
        import json
        dbt_context = default_dbt_context()
        adapter = dbt_context.adapter
        try:
            sql = dbt_context.generate_sql(sql_template, base)
            response, result = adapter.execute(sql, fetch=True, auto_begin=True)
            table: agate.Table = result
            df = pd.DataFrame([row.values() for row in table.rows], columns=table.column_names)
            result_json = df.to_json(orient='table')
            return json.loads(result_json)
        except TemplateSyntaxError as e:
            raise RecceException(f"Jinja template error: line {e.lineno}: {str(e)}")

    @staticmethod
    def close_connection(connection):
        adapter: SQLAdapter = default_dbt_context().adapter
        with adapter.connection_named("cancel query"):
            adapter.connections.cancel(connection)


class QueryParams(TypedDict):
    sql_template: str


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
            result = self.execute_sql(sql_template, base=True)
            self.check_cancel()

            return dict(result=result)

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

            # Query base
            try:
                result['base'] = self.execute_sql(sql_template, base=True)
            except Exception as e:
                print(e)
                result['base'] = None
            self.check_cancel()

            # Query current
            try:
                result['current'] = self.execute_sql(sql_template, base=False)
            except Exception as e:
                print(e)
                result['current'] = None
            self.check_cancel()

        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)


class RowCountDiffParams(TypedDict):
    node_names: list[str]


class RowCountDiffTask(Task, QueryMixin):
    def __init__(self, params: RowCountDiffParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute(self):
        result = {}

        from dbt.adapters.sql import SQLAdapter
        dbt_context = default_dbt_context()
        adapter: SQLAdapter = dbt_context.adapter

        query_candidates = []
        nodes = self.params.get('node_names')
        for node in nodes:
            cached_row_count = dbt_context.row_count_cache.get(node)
            if cached_row_count is not None:
                result[node] = cached_row_count
            else:
                query_candidates.append(node)

        # Query row count for nodes that are not cached
        with adapter.connection_named("query"):
            self.connection = adapter.connections.get_thread_connection()
            for node in query_candidates:
                base_row_count = None
                curr_row_count = None
                sql_query = 'select count(*) as ROW_COUNT from {{ ref("' + node + '") }}'

                try:
                    base = self.execute_sql(sql_query, base=True)
                except Exception as e:
                    print(e)
                    base = None
                self.check_cancel()

                try:
                    curr = self.execute_sql(sql_query, base=False)
                except Exception:
                    curr = None
                self.check_cancel()
                if base is not None:
                    base_row_count = int(base['data'][0].get('ROW_COUNT'))
                if curr is not None:
                    curr_row_count = int(curr['data'][0].get('ROW_COUNT'))

                # Cache the row_count result
                row_count = dict(base=base_row_count, curr=curr_row_count)
                dbt_context.row_count_cache.put(node, row_count)
                result[node] = row_count

        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
