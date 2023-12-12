from typing import TypedDict

from recce.apis.types import RunType, RunResultType
from recce.server import dbt_context


class SqlQueryParams(TypedDict):
    sql_template: str


class RunExecutor:
    @staticmethod
    def get_executor(executor_type: RunType):
        if executor_type == RunType.QUERY_DIFF:
            return SqlQueryExecutor()
        else:
            raise ValueError("Invalid executor type")


class SqlQueryExecutor:
    @staticmethod
    def execute(params: SqlQueryParams, base=False):
        from jinja2.exceptions import TemplateSyntaxError

        try:
            sql = params.get('sql_template')
            result = dbt_context.execute_sql(sql, base=base)
            result_json = result.to_json(orient='table')

            import json
            return json.loads(result_json), None
        except TemplateSyntaxError as e:
            return None, f"Jinja template error: line {e.lineno}: {str(e)}"
        except Exception as e:
            return None, str(e)

    @staticmethod
    def get_result_type():
        return RunResultType.DF_DIFF
