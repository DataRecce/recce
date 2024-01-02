from abc import ABC, abstractmethod
from typing import Callable, Dict, List, Optional, TypedDict

from recce.apis.types import RunType
from recce.server import dbt_context


class ExecutorManager:
    @staticmethod
    def create_executor(run_type: RunType, params: dict):
        executors: Dict[RunType, Callable] = {RunType.QUERY: QueryExecutor,
                                              RunType.QUERY_DIFF: QueryDiffExecutor,
                                              RunType.VALUE_DIFF: ValueDiffExecutor,
                                              RunType.PROFILE_DIFF: ProfileExecutor}
        executor = executors.get(run_type)
        if not executor:
            return NotImplementedError
        return executor(params)


class RunExecutor(ABC):
    @abstractmethod
    def execute(self):
        raise NotImplementedError

    def cancel(self):
        raise NotImplementedError


class QueryParams(TypedDict):
    sql_template: str


class QueryExecutor(RunExecutor):
    def __init__(self, params: QueryParams):
        self.params = params
        self.connection = None

    def execute(self):
        from jinja2.exceptions import TemplateSyntaxError

        try:
            sql_template = self.params.get('sql_template')

            from dbt.adapters.sql import SQLAdapter
            adapter: SQLAdapter = dbt_context.adapter

            with adapter.connection_named("query"):
                self.connection = adapter.connections.get_thread_connection()

                sql = dbt_context.generate_sql(sql_template, base=False)
                response, result = adapter.execute(sql, fetch=True, auto_begin=True)
                self.connection = None

                import agate
                import pandas as pd
                table: agate.Table = result
                df = pd.DataFrame([row.values() for row in table.rows], columns=table.column_names)
                result_json = df.to_json(orient='table')
                import json
                return dict(result=json.loads(result_json))
        except TemplateSyntaxError as e:
            return dict(error=f"Jinja template error: line {e.lineno}: {str(e)}")
        except Exception as e:
            return dict(error=str(e))

    def cancel(self):
        from dbt.adapters.sql import SQLAdapter
        adapter: SQLAdapter = dbt_context.adapter
        with adapter.connection_named("cancel query"):
            if self.connection:
                adapter.connections.cancel(self.connection)


class QueryDiffParams(TypedDict):
    sql_template: str


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


class ValueDiffParams(TypedDict):
    primary_key: str
    model: str
    exclude_columns: Optional[List[str]]


class ValueDiffExecutor(RunExecutor):

    def __init__(self, params: ValueDiffParams):
        self.params = params

    def execute(self):
        return dbt_context.columns_value_mismatched_summary(self.params['primary_key'], self.params['model'])


class ProfileParams(TypedDict):
    model: str


class ProfileExecutor(RunExecutor):

    def __init__(self, params: ProfileParams):
        self.params = params

    def execute(self):
        result = {}

        result['base'], result['base_error'] = self.execute_profile(base=True)
        result['current'], result['current_error'] = self.execute_profile(base=False)

        return result

    def execute_profile(self, base: bool = False):
        from jinja2.exceptions import TemplateSyntaxError

        try:
            model = self.params.get('model')
            result = dbt_context.model_profile(model, base=base)
            result_json = result.to_json(orient='table')

            import json
            return json.loads(result_json), None
        except TemplateSyntaxError as e:
            return None, f"Jinja template error: line {e.lineno}: {str(e)}"
        except Exception as e:
            return None, str(e)
