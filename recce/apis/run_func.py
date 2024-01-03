import asyncio
from abc import ABC, abstractmethod
from typing import Callable, Dict, List, Optional, TypedDict

from dbt.adapters.sql import SQLAdapter

from recce.apis.db import runs_db
from recce.apis.types import RunType, Run
from recce.dbt import default_dbt_context
from recce.exceptions import RecceException

running_tasks = {}


class ExecutorManager:
    @staticmethod
    def create_executor(run_type: RunType, params: dict):
        executors: Dict[RunType, Callable] = {RunType.QUERY: QueryExecutor,
                                              RunType.QUERY_DIFF: QueryDiffExecutor,
                                              RunType.VALUE_DIFF: ValueDiffExecutor,
                                              RunType.PROFILE_DIFF: ProfileExecutor}
        executor = executors.get(run_type)
        if not executor:
            raise NotImplementedError()
        return executor(params)


class RunExecutor(ABC):
    def __init__(self):
        self.isCancelled = False

    @abstractmethod
    def execute(self):
        """
        Execute the run.
        """
        raise NotImplementedError()

    def cancel(self):
        """
        Cancel the run. Subclass should override this method to implement the cancellation logic.
        """
        self.isCancelled = True

    def check_cancel(self):
        """
        Check if the run is canceled. If so, raise an exception.
        """

        if self.isCancelled:
            raise RecceException("Run is cancelled")


def submit_run(type, params):
    try:
        run_type = RunType(type)
    except ValueError:
        raise RecceException(f"Run type '{type}' not supported")

    try:
        task = ExecutorManager.create_executor(run_type, params)
    except NotImplementedError:
        raise RecceException(f"Run type '{type}' not supported")

    run = Run(type=run_type, params=params)
    runs_db.append(run)
    loop = asyncio.get_running_loop()
    running_tasks[run.run_id] = task

    async def update_run_result(run_id, result, error):
        if run is None:
            return
        if result is not None:
            run.result = result
        if error is not None:
            run.error = str(error)

    def fn():
        try:
            result = task.execute()
            print(f"{run.run_id} completed")
            asyncio.run_coroutine_threadsafe(update_run_result(run.run_id, result, None), loop)
            return result
        except BaseException as e:
            print(f"{run.run_id} failed")
            asyncio.run_coroutine_threadsafe(update_run_result(run.run_id, None, e), loop)
            raise e

    future = loop.run_in_executor(None, fn)
    return run, future


def get_run(run_id):
    for _run in runs_db:
        if str(run_id) == str(_run.run_id):
            return _run

    return None


def cancel_run(run_id):
    run = get_run(run_id)
    if run is None:
        raise RecceException(f"Run ID '{run_id}' not found")

    task = running_tasks.get(run_id)
    if task is None:
        raise RecceException(f"Run task for Run ID '{run_id}' not found")

    task.cancel()


class QueryMixin:
    def execute_sql(self, sql_template, base: bool = False):
        from jinja2.exceptions import TemplateSyntaxError

        try:
            result = default_dbt_context().execute_sql(sql_template, base=base)
            result_json = result.to_json(orient='table')
            import json
            return json.loads(result_json), None
        except TemplateSyntaxError as e:
            return None, f"Jinja template error: line {e.lineno}: {str(e)}"
        except Exception as e:
            return None, str(e)

    def close_connection(self, connection):
        adapter: SQLAdapter = default_dbt_context().adapter
        with adapter.connection_named("cancel query"):
            adapter.connections.cancel(connection)


class QueryParams(TypedDict):
    sql_template: str


class QueryExecutor(RunExecutor, QueryMixin):
    def __init__(self, params: QueryParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute(self):
        adapter: SQLAdapter = default_dbt_context().adapter
        with adapter.connection_named("query"):
            self.connection = adapter.connections.get_thread_connection()
            
            sql_template = self.params.get('sql_template')
            result, error = self.execute_sql(sql_template, base=True)
            return dict(result=result, error=error)

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)


class QueryDiffParams(TypedDict):
    sql_template: str


class QueryDiffExecutor(RunExecutor, QueryMixin):
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
            result['base'], result['base_error'] = self.execute_sql(sql_template, base=True)

            # Query current
            self.check_cancel()
            result['current'], result['current_error'] = self.execute_sql(sql_template, base=False)

        return result

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection(self.connection)


class ValueDiffParams(TypedDict):
    primary_key: str
    model: str
    exclude_columns: Optional[List[str]]


class ValueDiffExecutor(RunExecutor):

    def __init__(self, params: ValueDiffParams):
        super().__init__()
        self.params = params

    def execute(self):
        return default_dbt_context().columns_value_mismatched_summary(self.params['primary_key'], self.params['model'])


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
            result = default_dbt_context().model_profile(model, base=base)
            result_json = result.to_json(orient='table')

            import json
            return json.loads(result_json), None
        except TemplateSyntaxError as e:
            return None, f"Jinja template error: line {e.lineno}: {str(e)}"
        except Exception as e:
            return None, str(e)
