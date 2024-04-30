from typing import TypedDict, Optional, Tuple

import agate
from pydantic import BaseModel

from .core import Task
from .dataframe import DataFrame
from ..core import default_context
from ..exceptions import RecceException

QUERY_LIMIT = 2000


class QueryMixin:
    @classmethod
    def execute_sql_with_limit(
        cls,
        sql_template,
        base: bool = False,
        limit: Optional[int] = None
    ) -> Tuple[agate.Table, bool]:
        """
        Execute a SQL template and return the result as an agate table.
        :param sql_template: SQL template to execute
        :param base: Whether to run the query on the base environment
        :param limit: Limit the number of rows returned
        :return: Tuple of agate table and whether there are more rows to fetch
        """
        from jinja2.exceptions import TemplateSyntaxError
        dbt_adapter = default_context().adapter
        try:
            sql = dbt_adapter.generate_sql(sql_template, base)

            if limit is None:
                _, result = dbt_adapter.execute(sql, fetch=True, auto_begin=True)
                return result, False
            else:
                _, result = dbt_adapter.execute(sql, fetch=True, auto_begin=True, limit=limit + 1)
                if len(result.rows) > limit:
                    return result.limit(limit), True
                return result, False

        except TemplateSyntaxError as e:
            raise RecceException(f"Jinja template error: line {e.lineno}: {str(e)}")

    @classmethod
    def execute_sql(cls, sql_template, base: bool = False) -> agate.Table:
        result, _ = cls.execute_sql_with_limit(sql_template, base)
        return result

    @staticmethod
    def close_connection(connection):
        dbt_adapter = default_context().adapter
        with dbt_adapter.connection_named("cancel query"):
            dbt_adapter.cancel(connection)


class QueryParams(TypedDict):
    sql_template: str


class QueryResult(DataFrame):
    pass


class QueryDiffParams(TypedDict):
    sql_template: str


class QueryTask(Task, QueryMixin):
    def __init__(self, params: QueryParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute_dbt(self):
        from ..adapter.dbt_adapter import DbtAdapter
        dbt_adapter: DbtAdapter = default_context().adapter

        limit = QUERY_LIMIT
        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()

            sql_template = self.params.get('sql_template')
            table, more = self.execute_sql_with_limit(sql_template, base=False, limit=limit)
            self.check_cancel()

            return DataFrame.from_agate(table, limit=limit, more=more)

    def execute_sqlmesh(self):
        from ..adapter.sqlmesh_adapter import SqlmeshAdapter
        sqlmesh_adapter: SqlmeshAdapter = default_context().adapter

        sql = self.params.get('sql_template')
        limit = QUERY_LIMIT
        df, more = sqlmesh_adapter.fetchdf_with_limit(sql, base=False, limit=limit)
        return DataFrame.from_pandas(df, limit=limit, more=more)

    def execute(self):
        context = default_context()

        if context.adapter_type == 'sqlmesh':
            return self.execute_sqlmesh()
        else:
            return self.execute_dbt()

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)


class QueryDiffResult(BaseModel):
    base: DataFrame
    current: DataFrame


class QueryDiffTask(Task, QueryMixin):
    def __init__(self, params: QueryDiffParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute_dbt(self):
        from ..adapter.dbt_adapter import DbtAdapter
        dbt_adapter: DbtAdapter = default_context().adapter
        limit = QUERY_LIMIT

        with dbt_adapter.connection_named("query"):
            sql_template = self.params.get('sql_template')
            self.connection = dbt_adapter.get_thread_connection()
            base, base_more = self.execute_sql_with_limit(sql_template, base=True, limit=limit)
            self.check_cancel()

            current, current_more = self.execute_sql_with_limit(sql_template, base=False, limit=limit)
            self.check_cancel()

            return QueryDiffResult(
                base=DataFrame.from_agate(base, limit=limit, more=base_more),
                current=DataFrame.from_agate(current, limit=limit, more=current_more)
            )

    def execute_sqlmesh(self):
        from ..adapter.sqlmesh_adapter import SqlmeshAdapter

        sqlmesh_adapter: SqlmeshAdapter = default_context().adapter

        sql = self.params.get('sql_template')
        limit = QUERY_LIMIT
        base, base_more = sqlmesh_adapter.fetchdf_with_limit(sql, base=True, limit=limit)
        curr, curr_more = sqlmesh_adapter.fetchdf_with_limit(sql, base=False, limit=limit)
        return QueryDiffResult(
            base=DataFrame.from_pandas(base, limit=limit, more=base_more),
            current=DataFrame.from_pandas(curr, limit=limit, more=curr_more)
        )

    def execute(self):
        context = default_context()

        if context.adapter_type == 'sqlmesh':
            return self.execute_sqlmesh()
        else:
            return self.execute_dbt()

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)
