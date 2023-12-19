from abc import ABC, abstractmethod
from typing import Callable, Dict, List, Optional, TypedDict

from recce.apis.types import RunType
from recce.server import dbt_context


class QueryDiffParams(TypedDict):
    sql_template: str


class ValueDiffParams(TypedDict):
    primary_key: str
    model: str
    exclude_columns: Optional[List[str]]


class ExecutorManager:
    @staticmethod
    def create_executor(run_type: RunType, params: dict):
        executors: Dict[RunType, Callable] = {RunType.QUERY_DIFF: QueryDiffExecutor,
                                              RunType.VALUE_DIFF: ValueDiffExecutor}
        executor = executors.get(run_type)
        if not executor:
            return NotImplementedError
        return executor(params)


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


class ValueDiffExecutor(RunExecutor):

    def __init__(self, params: ValueDiffParams):
        self.params = params

    def execute(self):
        return dbt_context.columns_value_mismatched_summary(self.params['primary_key'], self.params['model'])
