import asyncio
from typing import Dict, Type, List, Optional

from recce.core import default_context
from recce.exceptions import RecceException
from recce.models import RunType, Run, RunDAO
from recce.models.types import RunStatus
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


def _get_ref_model(sql_template: str) -> Optional[str]:
    import re

    pattern = r'\bref\(["\']?(\w+)["\']?\)\s*}}'
    matches = re.findall(pattern, sql_template)
    if len(matches) == 1:
        ref = matches[0]
        return ref

    return None


def generate_run_name(run):
    # parse utc time with timezone

    import dateutil

    run_type = run.type
    params = run.params
    now = dateutil.parser.parse(run.run_at)

    if run_type == RunType.QUERY:
        ref = _get_ref_model(params.get('sql_template'))
        if ref:
            return f"query of {ref}".capitalize()
        return f"{'query'.capitalize()} - {now}"
    elif run_type == RunType.QUERY_DIFF:
        ref = _get_ref_model(params.get('sql_template'))
        if ref:
            return f"query diff of {ref}".capitalize()
        return f"{'query diff'.capitalize()} - {now}"
    elif run_type == RunType.VALUE_DIFF or run_type == RunType.VALUE_DIFF_DETAIL:
        model = params.get('model')
        return f"value diff of {model}".capitalize()
    elif run_type == RunType.PROFILE_DIFF:
        model = params.get('model')
        return f"profile diff of {model}".capitalize()
    elif run_type == RunType.ROW_COUNT_DIFF:
        nodes = params.get('node_names')
        if nodes:
            if len(nodes) == 1:
                node = nodes[0]
                return f"row count diff of {node}".capitalize()
            else:
                return f"row count of {len(nodes)} nodes".capitalize()
        else:
            return "row count of multiple nodes".capitalize()
    elif run_type == RunType.TOP_K_DIFF:
        model = params.get('model')
        column = params.get('column_name')
        return f"top-k diff of {model}.{column} ".capitalize()
    elif run_type == RunType.HISTOGRAM_DIFF:
        model = params.get('model')
        column = params.get('column_name')
        return f"histogram diff of {model}.{column} ".capitalize()
    else:
        return f"{'run'.capitalize()} - {now}"


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
    run.name = generate_run_name(run)
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
            run.status = RunStatus.SUCCESSFUL
        if error is not None:
            run.error = str(error)
            if run.status != RunStatus.CANCELLED:
                run.status = RunStatus.FAILED
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
    run.status = RunStatus.CANCELLED


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
