import asyncio
import logging
from datetime import timezone
from typing import List, Optional, Tuple

import dateutil.parser

from recce.core import default_context
from recce.exceptions import DuckDBExternalAccessBlocked, RecceException
from recce.models import Run, RunDAO, RunType
from recce.models.types import RunStatus
from recce.tasks.core import Task

running_tasks = {}
logger = logging.getLogger("uvicorn")


def _task_key(run_id) -> str:
    """Normalize a run id to the single key type ``running_tasks`` uses.

    ``Run.run_id`` is a ``UUID``, the cancel endpoint's path param is a ``UUID``,
    and ``_mark_run_cancelled`` takes a ``str``. Routing every access through
    this keeps a writer and a reader from disagreeing on the key type, which is
    invisible at the call site and turns cancel into a silent no-op.
    """
    return str(run_id)


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
        ref = _get_ref_model(params.get("sql_template"))
        if ref:
            return f"query of {ref}".capitalize()
        return f"{'query'.capitalize()} - {now}"
    elif run_type == RunType.QUERY_DIFF:
        ref = _get_ref_model(params.get("sql_template"))
        if ref:
            return f"query diff of {ref}".capitalize()
        return f"{'query diff'.capitalize()} - {now}"
    elif run_type == RunType.VALUE_DIFF:
        model = params.get("model")
        return f"value diff of {model}".capitalize()
    elif run_type == RunType.VALUE_DIFF_DETAIL:
        model = params.get("model")
        return f"value diff detail of {model}".capitalize()
    elif run_type == RunType.PROFILE_DIFF:
        model = params.get("model")
        return f"profile diff of {model}".capitalize()
    elif run_type == RunType.ROW_COUNT_DIFF:
        # MCP uses node_names (array) or node_ids (array of fully-qualified IDs)
        nodes = params.get("node_names")
        if nodes:
            if len(nodes) == 1:
                return f"row count diff of {nodes[0]}".capitalize()
            else:
                return f"row count of {len(nodes)} nodes".capitalize()
        node_ids = params.get("node_ids")
        if node_ids:
            if len(node_ids) == 1:
                return f"row count diff of {node_ids[0].split('.')[-1]}".capitalize()
            else:
                return f"row count of {len(node_ids)} nodes".capitalize()
        return "row count of multiple nodes".capitalize()
    elif run_type == RunType.TOP_K_DIFF:
        model = params.get("model")
        column = params.get("column_name")
        return f"top-k diff of {model}.{column} ".capitalize()
    elif run_type == RunType.HISTOGRAM_DIFF:
        model = params.get("model")
        column = params.get("column_name")
        return f"histogram diff of {model}.{column} ".capitalize()
    elif run_type == RunType.LINEAGE_DIFF:
        return "Lineage diff"
    elif run_type == RunType.SCHEMA_DIFF:
        # REST API uses node_id (single), MCP uses node_names/node_ids (arrays)
        node_id = params.get("node_id")
        if node_id:
            return f"Schema diff of {node_id.split('.')[-1]}"
        node_names = params.get("node_names")
        if node_names and len(node_names) == 1:
            return f"Schema diff of {node_names[0]}"
        elif node_names:
            return f"Schema diff of {len(node_names)} nodes"
        node_ids = params.get("node_ids")
        if node_ids and len(node_ids) == 1:
            return f"Schema diff of {node_ids[0].split('.')[-1]}"
        elif node_ids:
            return f"Schema diff of {len(node_ids)} nodes"
        return "Schema diff"
    else:
        return f"{'run'.capitalize()} - {now}"


def create_task(run_type: RunType, params: dict):
    context = default_context()
    if context is not None and context.adapter_type == "sqlmesh":
        from recce.adapter.sqlmesh_adapter import (
            sqlmesh_supported_registry as sqlmesh_registry,
        )

        registry = sqlmesh_registry
    else:
        from recce.adapter.dbt_adapter import dbt_supported_registry as dbt_registry

        registry = dbt_registry

    taskClz = registry.get(run_type)
    if not taskClz:
        raise NotImplementedError()
    return taskClz(params)


def submit_run(type, params, check_id=None, triggered_by=None):
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

    run = Run(
        type=run_type,
        params=params,
        check_id=check_id,
        status=RunStatus.RUNNING,
        triggered_by=triggered_by,
    )
    run.name = generate_run_name(run)
    RunDAO().create(run)

    loop = asyncio.get_running_loop()
    # Keyed by the string form, because that is what every reader has: the
    # cancel endpoint receives a UUID path param and hands _mark_run_cancelled
    # str(run_id). A UUID key never matches that lookup, which silently turned
    # every cancel into a no-op (the endpoint reports it as acknowledged).
    running_tasks[_task_key(run.run_id)] = task

    def progress_listener(message=None, percentage=None):
        run.progress = {"message": message, "percentage": percentage}

    task.progress_listener = progress_listener

    def update_run_result(run, result, error, updated_params=None):
        """Update run with result, error, and optionally updated params.

        Called synchronously inside the executor thread (fn) so that
        run.status and run.result are set BEFORE the future resolves.

        DRC-3307 historical context: previously this was async + scheduled
        via run_coroutine_threadsafe(...), which let callers observe stale
        run.status after `await future`. Consumer-side defensive guards
        (e.g., recce-cloud-infra `derive_check_run_status` race-workaround)
        explicitly cite this fix as the reason for their existence.

        Sunset condition: the synchronous-call requirement is safe to
        remove (and this docstring archeology along with it) once the
        recce-cloud-infra defensive guards in derive_check_run_status are
        removed — those guards depend on this rationale being preserved
        here as the canonical justification.

        Cross-thread store ordering: this runs in the executor thread while
        async callers read run.status / run.result from the event-loop
        thread. CPython's GIL makes each individual attribute store atomic,
        but multi-store sequences are not serialized with the loop.
        Mitigations applied here:

        - Status is written BEFORE result/error so a completion-signal
          reader (e.g., wait_run_handler polling on `result is not None`)
          never observes the inverse window ("result-present +
          status-RUNNING"). A snapshot reader that grabs both fields in
          a single render may briefly see (FINISHED, result=None) for
          the sub-µs gap between the two stores; accepted as practically
          unobservable, and snapshot readers are expected to re-poll.
        - When status == CANCELLED (set by cancel_run from the loop),
          neither the success nor the failure path overwrites it — the
          cancellation sentinel is preserved. Note: the guard is
          check-then-assign, not atomic. A sub-µs GIL window remains
          where cancel_run can flip status between the check and the
          overwrite; this is best-effort against the macroscopic race
          (cancel before executor enters), accepted as practically
          unobservable. Use threading.Lock or threading.Event if a
          future caller needs full atomicity.
        """
        if run is None:
            return
        if updated_params is not None:
            # Merge updated params (preserves any fields not in updated_params)
            run.params.update(updated_params)
        if result is not None:
            # Status BEFORE result: see "Cross-thread store ordering" above.
            if run.status != RunStatus.CANCELLED:
                run.status = RunStatus.FINISHED
            run.result = result
        if error is not None:
            # Status BEFORE error: same reason as above.
            if run.status != RunStatus.CANCELLED:
                run.status = RunStatus.FAILED
            failed_reason = str(error) if str(error) != "None" else repr(error)
            run.error = failed_reason
        run.progress = None

    def fn():
        try:
            result = task.execute()

            # Extract updated params from task after execution
            updated_params = None
            if hasattr(task, "params") and task.params is not None:
                # Serialization logic:
                # - Most tasks use Pydantic models (v2: model_dump, v1: dict)
                # - Some tasks may use plain dicts
                # - If params is an unexpected type, log a warning for debugging
                # - Handle the case where model_dump() or dict() raises an exception.
                try:
                    if hasattr(task.params, "model_dump"):
                        updated_params = task.params.model_dump()
                    elif hasattr(task.params, "dict"):
                        updated_params = task.params.dict()
                    elif isinstance(task.params, dict):
                        updated_params = task.params
                    else:
                        logger.warning(
                            f"Could not serialize task.params for run_id={run.run_id}: "
                            f"unexpected type {task.params.__class__} with value {repr(task.params)}"
                        )
                except Exception as e:
                    logger.warning(f"Failed to serialize task.params: {e}")
                    updated_params = None

            update_run_result(run, result, None, updated_params)
            return result
        except BaseException as e:
            update_run_result(run, None, e, None)
            if isinstance(e, DuckDBExternalAccessBlocked):
                # Propagate so the handler can map it to HTTP 400.
                raise
            if isinstance(e, RecceException) and e.is_raise is False:
                return None
            import sentry_sdk

            sentry_sdk.capture_exception(e)
            failed_reason = str(e) if str(e) != "None" else repr(e)
            failed_reason = failed_reason.replace(". ", ".\n")
            logger.error(f"Failed to execute {run_type} task: {failed_reason}")
            return None

    future = loop.run_in_executor(None, fn)
    return run, future


def _mark_run_cancelled(run_id: str) -> Tuple[Run, Task]:
    """Synchronously flip run status to CANCELLED. Cannot hang.

    Returns ``(run, task)``. Raises ``RecceException`` if either the
    ``Run`` record or the in-memory task is missing.

    Status is flipped BEFORE invoking the task's adapter cancel so the
    in-memory state reflects the cancel immediately. This matters because
    the adapter cancel (``dbt_adapter.cancel``) may hang on some
    warehouses (e.g., Snowflake), and the UI polls ``run.status`` to
    render the Cancelled state. Callers can now bound the cancel
    duration via :func:`_invoke_task_cancel` without leaving the run in
    RUNNING while the warehouse round-trip is in flight.

    See :func:`submit_run`'s ``update_run_result`` (the
    "Cross-thread store ordering" note) for the sub-µs GIL window race
    that the status guard at run_func.py:203-209 covers.
    """
    run = RunDAO().find_run_by_id(run_id)
    if run is None:
        raise RecceException(f"Run ID '{run_id}' not found")

    task = running_tasks.get(_task_key(run_id))
    if task is None:
        raise RecceException(f"Run task for Run ID '{run_id}' not found")

    run.status = RunStatus.CANCELLED
    return run, task


def _invoke_task_cancel(task: Task) -> None:
    """Invoke the task's cancel hook. May hang on adapter cancel.

    Callers that run on an async event loop should wrap this with
    ``asyncio.wait_for(asyncio.to_thread(...), timeout=...)`` so a hung
    warehouse cancel cannot block the event loop.
    """
    task.cancel()


def cancel_run(run_id: str) -> None:
    """Backwards-compatible shim.

    Marks the run cancelled, then invokes the task's cancel hook
    synchronously. Prefer the split helpers (:func:`_mark_run_cancelled`
    + :func:`_invoke_task_cancel`) when the caller needs to bound the
    cancel duration (e.g., async FastAPI handlers).
    """
    _, task = _mark_run_cancelled(run_id)
    _invoke_task_cancel(task)


_VALIDATION_RUN_TYPES = (
    RunType.VALUE_DIFF,
    RunType.PROFILE_DIFF,
    RunType.TOP_K_DIFF,
    RunType.HISTOGRAM_DIFF,
)
_COLUMN_VALIDATION_RUN_TYPES = (RunType.TOP_K_DIFF, RunType.HISTOGRAM_DIFF)


def _run_recency_key(run: Run):
    """Return an input-order-independent ordering key for persisted runs."""
    try:
        run_at = dateutil.parser.parse(run.run_at)
        if run_at.tzinfo is None:
            run_at = run_at.replace(tzinfo=timezone.utc)
        timestamp = run_at.timestamp()
    except (TypeError, ValueError, OverflowError):
        timestamp = float("-inf")
    return timestamp, str(run.run_id)


def _value_diff_difference_count(result: dict) -> int:
    """Count value-diff columns whose matched proportion is below one."""
    rows = result.get("data", {}).get("data", [])
    difference_count = 0
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) < 3 or row[2] is None:
            continue
        try:
            if float(row[2]) < 1:
                difference_count += 1
        except (TypeError, ValueError):
            continue
    return difference_count


def materialize_run_results(runs: List[Run], nodes: List[str] = None):
    """Project persisted runs into compact, node-keyed lineage evidence.

    Legacy row-count entries retain their full result shape. Validation runs
    expose only IDs and scalar counts under ``validation_summary``; their raw
    DataFrames and distribution arrays remain in the run store.
    """

    context = default_context()
    if context:
        name_to_unique_id = context.build_name_to_unique_id_index(excluded_types={"semantic_model", "metric"})
    else:
        name_to_unique_id = {}

    result = {}
    latest_validation_runs = {}
    for run in runs:
        if run.type == RunType.ROW_COUNT_DIFF and run.result and run.status != RunStatus.CANCELLED:
            for model_name, node_run_result in run.result.items():
                key = name_to_unique_id.get(model_name, model_name)

                if nodes:
                    if key not in nodes:
                        continue

                node_result = result.setdefault(key, {})
                node_result["row_count_diff"] = {
                    "run_id": run.run_id,
                    "result": node_run_result,
                }
        elif run.type == RunType.ROW_COUNT and run.result and run.status != RunStatus.CANCELLED:
            for model_name, node_run_result in run.result.items():
                key = name_to_unique_id.get(model_name, model_name)

                if nodes:
                    if key not in nodes:
                        continue

                node_result = result.setdefault(key, {})
                node_result["row_count"] = {
                    "run_id": run.run_id,
                    "result": node_run_result,
                }
        elif run.type in _VALIDATION_RUN_TYPES and run.status == RunStatus.FINISHED and run.result is not None:
            params = run.params if isinstance(run.params, dict) else {}
            model_name = params.get("model")
            if not isinstance(model_name, str) or not model_name:
                continue

            key = name_to_unique_id.get(model_name, model_name)
            if nodes and key not in nodes:
                continue

            node_runs = latest_validation_runs.setdefault(key, {})
            if run.type in _COLUMN_VALIDATION_RUN_TYPES:
                column_name = params.get("column_name")
                if not isinstance(column_name, str) or not column_name:
                    continue
                column_runs = node_runs.setdefault(run.type, {})
                previous = column_runs.get(column_name)
                if previous is None or _run_recency_key(run) > _run_recency_key(previous):
                    column_runs[column_name] = run
            else:
                previous = node_runs.get(run.type)
                if previous is None or _run_recency_key(run) > _run_recency_key(previous):
                    node_runs[run.type] = run

    for key, node_runs in latest_validation_runs.items():
        validation_types = {}
        result_count = 0
        difference_count = 0

        value_diff_run = node_runs.get(RunType.VALUE_DIFF)
        if value_diff_run is not None:
            difference_count = _value_diff_difference_count(value_diff_run.result)
            validation_types[RunType.VALUE_DIFF.value] = {
                "latest_run_id": value_diff_run.run_id,
                "difference_count": difference_count,
                "result_available": True,
            }
            result_count += 1

        profile_diff_run = node_runs.get(RunType.PROFILE_DIFF)
        if profile_diff_run is not None:
            validation_types[RunType.PROFILE_DIFF.value] = {
                "latest_run_id": profile_diff_run.run_id,
                "result_count": 1,
                "result_available": True,
            }
            result_count += 1

        for run_type in _COLUMN_VALIDATION_RUN_TYPES:
            column_runs = node_runs.get(run_type)
            if not column_runs:
                continue
            latest_run_ids_by_column = {
                column_name: column_runs[column_name].run_id for column_name in sorted(column_runs)
            }
            column_count = len(latest_run_ids_by_column)
            validation_types[run_type.value] = {
                "latest_run_ids_by_column": latest_run_ids_by_column,
                "column_count": column_count,
                "result_available": True,
            }
            result_count += column_count

        result.setdefault(key, {})["validation_summary"] = {
            "result_count": result_count,
            "difference_count": difference_count,
            "types": validation_types,
        }
    return result
