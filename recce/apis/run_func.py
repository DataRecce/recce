from abc import ABC, abstractmethod
from typing import TypedDict, Optional

from recce.apis.types import RunType
from recce.server import dbt_context


class QueryDiffParams(TypedDict):
    sql_template: str


class ExecutorManager:
    @staticmethod
    def get_executor(run_type: RunType, params: dict):
        if run_type == RunType.QUERY_DIFF:
            return QueryDiffExecutor(params)
        else:
            return NotImplementedError


class RunExecutor(ABC):
    @abstractmethod
    def execute(self):
        raise NotImplementedError


class QueryDiffExecutor(RunExecutor):
    def __init__(self, params: QueryDiffParams):
        self.params = params

    def execute(self):
        result = {}

        result['base'], result['base_error'] = self.execute_sql(base=True)
        result['current'], result['current_error'] = self.execute_sql(base=False)

        return result

    def execute_sql(self, base: bool = False):
        from jinja2.exceptions import TemplateSyntaxError

        try:
            sql = self.params.get('sql_template')
            result = dbt_context.execute_sql(sql, base=base)
            result_json = result.to_json(orient='table')

            import json
            return json.loads(result_json), None
        except TemplateSyntaxError as e:
            return None, f"Jinja template error: line {e.lineno}: {str(e)}"
        except Exception as e:
            return None, str(e)
