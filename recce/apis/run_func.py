import asyncio
from typing import Dict, Type

from dbt.exceptions import DbtDatabaseError
from recce.exceptions import RecceException, RecceCancelException
from recce.models import RunType, Run, RunDAO
from recce.tasks import QueryTask, ProfileDiffTask, ValueDiffTask, QueryDiffTask, Task, RowCountDiffTask, \
    ValueDiffDetailTask
from recce.tasks.histogram import HistogramDiffTask
from recce.tasks.top_k import TopKDiffTask

running_tasks = {}

registry: Dict[RunType, Type[Task]] = {
    RunType.QUERY: QueryTask,
    RunType.QUERY_DIFF: QueryDiffTask,
    RunType.VALUE_DIFF: ValueDiffTask,
    RunType.VALUE_DIFF_DETAIL: ValueDiffDetailTask,
    RunType.PROFILE_DIFF: ProfileDiffTask,
    RunType.ROW_COUNT_DIFF: RowCountDiffTask,
    RunType.TOP_K_DIFF: TopKDiffTask,
    RunType.HISTOGRAM_DIFF: HistogramDiffTask,
}


def create_task(run_type: RunType, params: dict):
    taskClz = registry.get(run_type)
    if not taskClz:
        raise NotImplementedError()
    return taskClz(params)


def submit_run(type, params, check_id=None):
    try:
        run_type = RunType(type)
    except ValueError:
        raise RecceException(f"Run type '{type}' not supported")

    try:
        task = create_task(run_type, params)
    except NotImplementedError:
        raise RecceException(f"Run type '{type}' not supported")

    run = Run(type=run_type, params=params, check_id=check_id)
    RunDAO().create(run)

    loop = asyncio.get_running_loop()
    running_tasks[run.run_id] = task

    def progress_listener(message=None, percentage=None):
        run.progress = {'message': message, 'percentage': percentage}

    task.progress_listener = progress_listener

    async def update_run_result(run_id, result, error):
        if run is None:
            return
        if result is not None:
            run.result = result
        if error is not None:
            run.error = str(error)
        run.progress = None

    def fn():
        try:
            result = task.execute()
            asyncio.run_coroutine_threadsafe(update_run_result(run.run_id, result, None), loop)
            return result
        except BaseException as e:
            if isinstance(e, DbtDatabaseError):
                if str(e).find('100051') and run.type == RunType.PROFILE_DIFF:
                    # Snowflake error '100051 (22012): Division by zero"'
                    e = RecceException('No profile diff result due to the model is empty.', False)
            asyncio.run_coroutine_threadsafe(update_run_result(run.run_id, None, e), loop)
            if isinstance(e, RecceException) and e.is_raise is False:
                return None
            raise e

    future = loop.run_in_executor(None, fn)
    return run, future


def cancel_run(run_id):
    run = RunDAO().find_run_by_id(run_id)
    if run is None:
        raise RecceException(f"Run ID '{run_id}' not found")

    task = running_tasks.get(run_id)
    if task is None:
        raise RecceException(f"Run task for Run ID '{run_id}' not found")

    task.cancel()
