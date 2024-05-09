import typing
from typing import TypedDict, Optional, Tuple, List

from pydantic import BaseModel

from .core import Task, TaskResultDiffer
from .dataframe import DataFrame
from .valuediff import ValueDiffMixin
from ..core import default_context
from ..exceptions import RecceException

QUERY_LIMIT = 2000

if typing.TYPE_CHECKING:
    import agate


class QueryMixin:
    @classmethod
    def execute_sql_with_limit(
        cls,
        sql_template,
        base: bool = False,
        limit: Optional[int] = None
    ) -> Tuple['agate.Table', bool]:
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
    def execute_sql(cls, sql_template, base: bool = False) -> 'agate.Table':
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
    primary_keys: List[str]


class QueryTask(Task, QueryMixin):
    def __init__(self, params: QueryParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute_dbt(self):
        from recce.adapter.dbt_adapter import DbtAdapter
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
    base: Optional[DataFrame] = None
    current: Optional[DataFrame] = None
    diff: Optional[DataFrame] = None


class QueryDiffTask(Task, QueryMixin, ValueDiffMixin):
    def __init__(self, params: QueryDiffParams):
        super().__init__()
        self.params = params
        self.connection = None
        self.legacy_surrogate_key = True

    def _query_diff(self, dbt_adapter, sql_template: str):
        limit = QUERY_LIMIT

        self.connection = dbt_adapter.get_thread_connection()
        base, base_more = self.execute_sql_with_limit(sql_template, base=True, limit=limit)
        self.check_cancel()

        current, current_more = self.execute_sql_with_limit(sql_template, base=False, limit=limit)
        self.check_cancel()

        return QueryDiffResult(
            base=DataFrame.from_agate(base, limit=limit, more=base_more),
            current=DataFrame.from_agate(current, limit=limit, more=current_more)
        )

    def _query_diff_join(self, dbt_adapter, sql_template: str, primary_keys: List[str]):

        query_template = r"""
            {% set a_query %}
                {{ base_query }}
            {% endset %}

            {% set b_query %}
                {{ current_query }}
            {% endset %}

            {{ audit_helper.compare_queries(
                a_query=a_query,
                b_query=b_query,
                primary_key=__PRIMARY_KEY__,
                summarize=False,
            ) }} limit {{ limit }}
            """

        if len(primary_keys) > 1:
            self._verify_dbt_packages_deps(dbt_adapter)
            self.check_cancel()

            if self.legacy_surrogate_key:
                new_primary_key = 'dbt_utils.surrogate_key(primary_key)'
            else:
                new_primary_key = 'dbt_utils.generate_surrogate_key(primary_key)'
        else:
            new_primary_key = 'primary_key'
        query_template = query_template.replace('__PRIMARY_KEY__', new_primary_key)

        base_query = dbt_adapter.generate_sql(sql_template, base=True)
        current_query = dbt_adapter.generate_sql(sql_template, base=False)

        sql = dbt_adapter.generate_sql(query_template, context=dict(
            base_query=base_query,
            current_query=current_query,
            primary_key=primary_keys if len(primary_keys) != 1 else primary_keys[0],
            limit=QUERY_LIMIT,
        ))

        _, table = dbt_adapter.execute(sql, fetch=True)
        self.check_cancel()

        return QueryDiffResult(
            diff=DataFrame.from_agate(table)
        )

    def execute_dbt(self):
        from recce.adapter.dbt_adapter import DbtAdapter
        dbt_adapter: DbtAdapter = default_context().adapter

        with dbt_adapter.connection_named("query"):
            sql_template = self.params.get('sql_template')
            primary_keys = self.params.get('primary_keys')

            if primary_keys:
                return self._query_diff_join(dbt_adapter, sql_template, primary_keys)

            return self._query_diff(dbt_adapter, sql_template)

    def _sqlmesh_query_diff(self, sql):
        from ..adapter.sqlmesh_adapter import SqlmeshAdapter

        sqlmesh_adapter: SqlmeshAdapter = default_context().adapter

        limit = QUERY_LIMIT
        base, base_more = sqlmesh_adapter.fetchdf_with_limit(sql, base=True, limit=limit)
        curr, curr_more = sqlmesh_adapter.fetchdf_with_limit(sql, base=False, limit=limit)
        return QueryDiffResult(
            base=DataFrame.from_pandas(base, limit=limit, more=base_more),
            current=DataFrame.from_pandas(curr, limit=limit, more=curr_more)
        )

    def _sqlmesh_query_diff_join(self, sql, primary_keys):
        from ..adapter.sqlmesh_adapter import SqlmeshAdapter

        sqlmesh_adapter: SqlmeshAdapter = default_context().adapter

        limit = QUERY_LIMIT
        expr_base = sqlmesh_adapter.replace_virtual_tables(sql, base=True)
        expr_curr = sqlmesh_adapter.replace_virtual_tables(sql, base=False)
        import sqlglot as g

        expr = g.select(
            '*',
        ).with_(
            'a', as_=expr_base
        ).with_(
            'b', as_=expr_curr
        ).with_(
            'a_interset_b', as_='select * from a intersect select * from b'
        ).with_(
            'a_except_b', as_='select * from a except select * from b'
        ).with_(
            'b_except_a', as_='select * from b except select * from a'
        ).with_(
            'all_records',
            as_='''
            SELECT
              *,
              TRUE AS in_a,
              TRUE AS in_b
            FROM a_interset_b
            UNION ALL
            SELECT
              *,
              TRUE AS in_a,
              FALSE AS in_b
            FROM a_except_b
            UNION ALL
            SELECT
              *,
              FALSE AS in_a,
              TRUE AS in_b
            FROM b_except_a
            '''
        ).with_(
            'final',
            as_=f'''
                    select * from all_records
                    where not (in_a and in_b)
                    order by {", ".join(primary_keys)}, in_a desc, in_b desc
                    '''
        ).from_('final').limit(1000)
        diff, diff_more = sqlmesh_adapter.fetchdf_with_limit(expr, limit=limit)
        return QueryDiffResult(
            diff=DataFrame.from_pandas(diff, limit=limit, more=diff_more)
        )

    def execute_sqlmesh(self):
        sql = self.params.get('sql_template')
        primary_keys = self.params.get('primary_keys')

        if primary_keys:
            return self._sqlmesh_query_diff_join(sql, primary_keys)
        else:
            return self._sqlmesh_query_diff(sql)

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


class QueryDiffResultDiffer(TaskResultDiffer):
    def _check_result_changed_fn(self, result):
        base = result.get('base')
        current = result.get('current')
        diff = result.get('diff')

        if diff is None:
            return TaskResultDiffer.diff(base, current)
        else:
            diff_data = diff.get('data')
            if diff_data is None or len(diff_data) == 0:
                return None

            # TODO: Implement detailed information of values changed
            return dict(values_changed={})
