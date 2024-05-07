import asyncio
from typing import Dict, Type, List

from recce.core import default_context
from recce.exceptions import RecceException
from recce.models import RunType, Run, RunDAO
from recce.tasks import QueryTask, ProfileDiffTask, ValueDiffTask, QueryDiffTask, Task, RowCountDiffTask, \
    ValueDiffDetailTask
from recce.tasks.histogram import HistogramDiffTask
from recce.tasks.top_k import TopKDiffTask

running_tasks = {}

dbt_registry: Dict[RunType, Type[Task]] = {
    RunType.QUERY: QueryTask,
    RunType.QUERY_DIFF: QueryDiffTask,
    RunType.VALUE_DIFF: ValueDiffTask,
    RunType.VALUE_DIFF_DETAIL: ValueDiffDetailTask,
    RunType.PROFILE_DIFF: ProfileDiffTask,
    RunType.ROW_COUNT_DIFF: RowCountDiffTask,
    RunType.TOP_K_DIFF: TopKDiffTask,
    RunType.HISTOGRAM_DIFF: HistogramDiffTask,
}

sqlmesh_registry: Dict[RunType, Type[Task]] = {
    RunType.QUERY: QueryTask,
    RunType.QUERY_DIFF: QueryDiffTask,
    RunType.ROW_COUNT_DIFF: RowCountDiffTask,
}


def create_task(run_type: RunType, params: dict):
    registry = sqlmesh_registry if default_context().adapter_type == 'sqlmesh' else dbt_registry
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

    context = default_context()
    if context.review_mode is True:
        from recce.adapter.dbt_adapter import DbtAdapter
        dbt_adaptor: DbtAdapter = context.adapter
        if dbt_adaptor.adapter is None:
            raise RecceException("Recce Server is not launched under DBT project folder.")

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


def materialize_run_results(runs: List[Run], nodes: List[str] = None):
    '''
    Materialize the run results for nodes. It walks through all runs and get the last results for primary run types.

    The result format
    {
       'node_id': {
          'row_count_diff': {
            'run_id': '<run_id>',
            'result': '<result>'
          },
          'value_diff': {
            'run_id': '<run_id>',
            'result': '<result>'
          },
       },
    }
    '''

    context = default_context()
    if context:
        mame_to_unique_id = context.build_name_to_unique_id_index()
    else:
        mame_to_unique_id = {}

    result = {}
    for run in runs:
        if not run.result:
            continue

        if run.type == RunType.ROW_COUNT_DIFF:
            for model_name, node_run_result in run.result.items():
                key = mame_to_unique_id.get(model_name, model_name)

                if nodes:
                    if key not in nodes:
                        continue

                if model_name not in result:
                    node_result = result[key] = {}
                else:
                    node_result = result.get(key)
                node_result['row_count_diff'] = {'run_id': run.run_id, 'result': node_run_result}
    return result
