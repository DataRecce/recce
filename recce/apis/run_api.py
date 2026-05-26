import asyncio
import logging
import time
import typing as t
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from recce.apis.export_utils import (
    EXPORT_MAX_ROWS,
    MAX_CONCURRENT_EXPORTS,
    SUPPORTED_EXPORT_TYPES,
    SUPPORTED_FORMATS,
    XLSX_MAX_ROWS,
    generate_export_filename,
    generate_xlsx_bytes,
    stream_csv_rows,
    stream_tsv_rows,
    wrap_sql_with_export_limit,
)
from recce.apis.run_func import (
    _invoke_task_cancel,
    _mark_run_cancelled,
    materialize_run_results,
    submit_run,
)
from recce.event import log_api_event
from recce.exceptions import DuckDBExternalAccessBlocked, RecceException
from recce.models import RunDAO

logger = logging.getLogger("uvicorn")

# Adapter cancel calls (e.g., Snowflake) may hang on the warehouse side.
# Bound the wait so a stuck warehouse cannot block the FastAPI event loop.
CANCEL_TIMEOUT_SECONDS = 2.0

run_router = APIRouter(tags=["run"])

# Lazy-init semaphore to limit concurrent export queries.
# Created lazily to avoid asyncio event loop issues at import time.
_export_semaphore: t.Optional[asyncio.Semaphore] = None


def _get_export_semaphore() -> asyncio.Semaphore:
    global _export_semaphore
    if _export_semaphore is None:
        _export_semaphore = asyncio.Semaphore(MAX_CONCURRENT_EXPORTS)
    return _export_semaphore


class CreateRunIn(BaseModel):
    type: str
    params: dict
    check_id: Optional[str] = None
    nowait: Optional[bool] = False
    track_props: Optional[dict] = None


@run_router.post("/runs", status_code=201)
async def create_run_handler(input: CreateRunIn):
    log_api_event(
        "create_run",
        dict(
            type=input.type,
            track_props=input.track_props,
        ),
    )
    try:
        run, future = submit_run(input.type, input.params, check_id=input.check_id, triggered_by="user")
    except RecceException as e:
        raise HTTPException(status_code=400, detail=str(e))

    if input.nowait:
        return run
    else:
        try:
            run.result = await future
        except DuckDBExternalAccessBlocked as e:
            raise HTTPException(status_code=400, detail=str(e))
        return run


def _resolve_adapter_type() -> Optional[str]:
    """Best-effort adapter type discovery for telemetry.

    Returns the active context's ``adapter_type`` string (e.g. ``"dbt"``
    or ``"sqlmesh"``) when available. Returns ``None`` rather than raising
    so a missing or partially-initialized context does not break the
    cancel handler — adapter type is a nice-to-have telemetry field, not
    a precondition.
    """
    try:
        from recce.core import default_context

        return getattr(default_context(), "adapter_type", None)
    except Exception:
        return None


@run_router.post("/runs/{run_id}/cancel")
async def cancel_run_handler(run_id: UUID):
    """Cancel a running query.

    The synchronous status flip happens first so the UI sees CANCELLED on
    the next poll. The adapter cancel (which may hang on warehouses like
    Snowflake) runs in a worker thread bounded by ``CANCEL_TIMEOUT_SECONDS``
    so a stuck warehouse cannot block the FastAPI event loop.

    Always returns 200 — the UI has already detached client-side; a
    failed, timed-out, or unknown-run cancel is a telemetry concern, not
    a user-facing error. The ``cancel_run`` event records outcome so
    adapter teams can measure cancel-honor rates per warehouse.

    Thread-leak note: on timeout, the worker thread continues running
    until the adapter call eventually returns. Python has no thread-kill
    primitive, so a wedged warehouse-side cancel will leave one Python
    thread parked on the connection until the OS-level call unblocks.
    This is acceptable because cancel is low-frequency and the leak is
    bounded by the warehouse's own connection timeout.
    """
    start = time.monotonic()
    outcome = "acknowledged"
    task_kind: Optional[str] = None
    adapter_type = _resolve_adapter_type()
    task = None

    try:
        run, task = _mark_run_cancelled(str(run_id))
        run_type = getattr(run, "type", None)
        # RunType is an Enum; record the string value for clean telemetry.
        task_kind = getattr(run_type, "value", run_type) if run_type is not None else None
    except RecceException:
        # Run or task already gone (e.g., already terminal, double-cancel
        # race). UX is already detached client-side, so this is an ack.
        log_api_event(
            "cancel_run",
            dict(
                run_id=str(run_id),
                task_kind=None,
                adapter_type=adapter_type,
                elapsed_ms_at_cancel=int((time.monotonic() - start) * 1000),
                outcome="acknowledged",
            ),
        )
        return

    try:
        await asyncio.wait_for(
            asyncio.to_thread(_invoke_task_cancel, task),
            timeout=CANCEL_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        outcome = "timed_out"
        logger.warning(
            "cancel_run timed out after %.1fs (run_id=%s)",
            CANCEL_TIMEOUT_SECONDS,
            run_id,
        )
    except NotImplementedError:
        # Adapter does not implement cancel — UX has already detached.
        # Recording as ``errored`` would just generate dashboard noise.
        pass
    except Exception as e:
        outcome = "errored"
        logger.warning("cancel_run errored (run_id=%s): %s", run_id, e)

    log_api_event(
        "cancel_run",
        dict(
            run_id=str(run_id),
            task_kind=task_kind,
            adapter_type=adapter_type,
            elapsed_ms_at_cancel=int((time.monotonic() - start) * 1000),
            outcome=outcome,
        ),
    )


@run_router.get("/runs/{run_id}/wait")
async def wait_run_handler(run_id: UUID, timeout: int = Query(None, description="Maximum number of seconds to wait")):
    run = RunDAO().find_run_by_id(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Not Found")

    start_time = asyncio.get_event_loop().time()
    while run.result is None and run.error is None:
        await asyncio.sleep(1)
        if timeout is not None and (asyncio.get_event_loop().time() - start_time) > timeout:
            break
    return run


@run_router.get("/runs", status_code=200)
async def list_run_handler():
    runs = RunDAO().list() or []

    result = [
        {
            "run_id": run.run_id,
            "run_at": run.run_at,
            "name": run.name,
            "type": run.type,
            "params": run.params,
            "status": run.status,
            "check_id": run.check_id,
            "error": run.error,
            "triggered_by": run.triggered_by,
        }
        for run in runs
    ]

    # sort by run_at
    result = sorted(result, key=lambda x: x["run_at"], reverse=True)

    return result


class SearchRunsIn(BaseModel):
    type: str
    params: dict
    limit: Optional[int] = None


@run_router.post("/runs/search", status_code=200)
async def search_runs_handler(search: SearchRunsIn):
    runs = RunDAO().list()

    result = []
    for run in runs:
        if run.type.value != search.type:
            continue
        if not all(search.params[key] == run.params.get(key) for key in search.params.keys()):
            continue

        result.append(run)

    if search.limit:
        return result[-search.limit :]

    return result


class AggregateRunsIn(BaseModel):
    class AggregateFilter(BaseModel):
        nodes: Optional[List[str]] = None

    filter: Optional[AggregateFilter] = None


@run_router.post("/runs/aggregate", status_code=200)
async def aggregate_runs_handler(input: AggregateRunsIn):
    try:
        runs = RunDAO().list()
        nodes = input.filter.nodes if input.filter and input.filter.nodes else None
        result = materialize_run_results(runs, nodes=nodes)
        return result
    except Exception as e:
        raise HTTPException(status_code=405, detail=str(e))


@run_router.get("/runs/{run_id}/export")
async def export_run_handler(run_id: UUID, format: str = Query("csv", description="Export format: csv, tsv, or xlsx")):
    """Export full query results as a downloadable file."""
    if format not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400, detail=f"Unsupported format: {format}. Use: {', '.join(SUPPORTED_FORMATS)}"
        )

    run = RunDAO().find_run_by_id(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.type.value not in SUPPORTED_EXPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Export not supported for run type: {run.type.value}. Supported: {', '.join(SUPPORTED_EXPORT_TYPES)}",
        )

    # Reject query_diff exports that used primary_keys (warehouse-side join diff).
    # The stored result is diff-only, but _execute_export_query exports base/current
    # raw queries, which would not match what the user saw in the UI.
    if run.type.value == "query_diff":
        params = run.params if isinstance(run.params, dict) else run.params.dict()
        if params.get("primary_keys"):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Export is not yet supported for query_diff runs that use primary_keys "
                    "(warehouse-side join diff). Use a standard query run for full export."
                ),
            )

    total_row_count = _get_total_row_count(run)
    if total_row_count is not None:
        if total_row_count > EXPORT_MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"Export too large ({total_row_count:,} rows). Maximum is {EXPORT_MAX_ROWS:,} rows.",
            )
        if format == "xlsx" and total_row_count > XLSX_MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"Excel exports are limited to {XLSX_MAX_ROWS:,} rows. Use CSV or TSV for larger exports.",
            )

    # Limit concurrent exports to prevent server resource exhaustion.
    # Fast-reject if all semaphore slots are taken rather than queuing.
    sem = _get_export_semaphore()
    if sem._value <= 0:
        raise HTTPException(
            status_code=429,
            detail="Too many concurrent exports. Please wait for the current export to complete.",
        )

    filename = generate_export_filename(run.type.value, format)

    # Run the blocking warehouse query in a thread pool to keep the
    # async event loop responsive for other API requests and WebSocket heartbeats.
    async with sem:
        try:
            columns, rows = await asyncio.to_thread(_execute_export_query, run)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Export query failed: {str(e)}")

    # Semaphore released — data is in memory, formatting is cheap.
    if format == "csv":
        return StreamingResponse(
            stream_csv_rows(columns, iter(rows)),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    elif format == "tsv":
        return StreamingResponse(
            stream_tsv_rows(columns, iter(rows)),
            media_type="text/tab-separated-values",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    elif format == "xlsx":
        xlsx_bytes = await asyncio.to_thread(generate_xlsx_bytes, columns, iter(rows))
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


def _get_total_row_count(run) -> t.Optional[int]:
    """Extract total_row_count from run result.

    Note: Run.result is always a dict (Pydantic serialization), never a DataFrame instance.
    """
    result = run.result
    if not isinstance(result, dict):
        return None

    if "total_row_count" in result and isinstance(result["total_row_count"], (int, float)):
        return int(result["total_row_count"])

    base = result.get("base")
    curr = result.get("current")
    base_count = base.get("total_row_count") if isinstance(base, dict) else None
    curr_count = curr.get("total_row_count") if isinstance(curr, dict) else None
    counts = [int(c) for c in [base_count, curr_count] if c is not None]
    return max(counts) if counts else None


def _execute_export_query(run) -> t.Tuple[t.List[str], t.List[tuple]]:
    """Re-execute the run's SQL query with export limits and return columns + rows.

    Uses SQL-level LIMIT to cap warehouse processing (saves compute cost),
    plus dbt's fetchmany as a secondary Python-side guard.

    Returns a materialized list (not a generator) so the database connection
    can be closed before streaming begins — important since this runs in a
    background thread via asyncio.to_thread.
    """
    from recce.core import default_context

    dbt_adapter = default_context().adapter
    params = run.params if isinstance(run.params, dict) else (run.params.dict() if run.params else {})
    sql_template = params.get("sql_template")
    if not sql_template:
        raise ValueError("Run has no sql_template in params")
    run_type = run.type.value if hasattr(run.type, "value") else run.type

    # Use connection_named for thread-safe connection management.
    # Each thread gets its own database connection via dbt's thread-local storage.
    with dbt_adapter.connection_named("export"):
        if run_type in ("query", "query_base"):
            is_base = run_type == "query_base"
            compiled_sql = dbt_adapter.generate_sql(sql_template, is_base)
            limited_sql = wrap_sql_with_export_limit(compiled_sql, EXPORT_MAX_ROWS)
            _, table = dbt_adapter.execute(limited_sql, fetch=True, auto_begin=True)
            columns = list(table.column_names)
            rows = [tuple(row.values()) for row in table.rows]
            return columns, rows

        elif run_type == "query_diff":
            base_sql = params.get("base_sql_template")

            base_compiled = dbt_adapter.generate_sql(base_sql or sql_template, True)
            base_limited = wrap_sql_with_export_limit(base_compiled, EXPORT_MAX_ROWS)
            _, base_table = dbt_adapter.execute(base_limited, fetch=True, auto_begin=True)

            curr_compiled = dbt_adapter.generate_sql(sql_template, False)
            curr_limited = wrap_sql_with_export_limit(curr_compiled, EXPORT_MAX_ROWS)
            _, current_table = dbt_adapter.execute(curr_limited, fetch=True, auto_begin=True)

            from itertools import zip_longest

            columns = [f"base__{c}" for c in base_table.column_names] + [
                f"current__{c}" for c in current_table.column_names
            ]

            num_cols_base = len(base_table.column_names)
            num_cols_curr = len(current_table.column_names)
            empty_base = tuple([None] * num_cols_base)
            empty_curr = tuple([None] * num_cols_curr)

            base_rows = [tuple(r.values()) for r in base_table.rows]
            curr_rows = [tuple(r.values()) for r in current_table.rows]

            merged = []
            for b, c in zip_longest(base_rows, curr_rows):
                merged.append((b if b is not None else empty_base) + (c if c is not None else empty_curr))
            return columns, merged

    raise ValueError(f"Unsupported export run type: {run_type}")
