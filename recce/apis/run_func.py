import asyncio
from typing import Callable, Dict

from recce.apis.db import runs_db
from recce.apis.types import RunType, Run
from recce.exceptions import RecceException, RecceCancelException
from recce.tasks import QueryTask, ProfileDiffTask, ValueDiffTask, QueryDiffTask

running_tasks = {}
registry: Dict[RunType, Callable] = {
    RunType.QUERY: QueryTask,
    RunType.QUERY_DIFF: QueryDiffTask,
    RunType.VALUE_DIFF: ValueDiffTask,
    RunType.PROFILE_DIFF: ProfileDiffTask
}


def create_task(run_type: RunType, params: dict):
    taskClz = registry.get(run_type)
    if not taskClz:
        raise NotImplementedError()
    return taskClz(params)


def submit_run(type, params):
    try:
        run_type = RunType(type)
    except ValueError:
        raise RecceException(f"Run type '{type}' not supported")

    try:
        task = create_task(run_type, params)
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
            asyncio.run_coroutine_threadsafe(update_run_result(run.run_id, result, None), loop)
            return result
        except BaseException as e:
            asyncio.run_coroutine_threadsafe(update_run_result(run.run_id, None, e), loop)
            if isinstance(e, RecceCancelException):
                return None
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
