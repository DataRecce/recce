"""Tests for recce/apis/run_api.py::cancel_run_handler.

The handler is the FastAPI entrypoint customers hit when they click
Cancel. Its job is twofold:

1. Flip ``run.status`` to CANCELLED synchronously so the UI's next poll
   sees the cancel immediately. Cheap, cannot hang.
2. Tell the adapter to cancel the underlying warehouse query. This MAY
   hang on warehouses like Snowflake — so it runs in a worker thread
   bounded by a 2s timeout, never blocking the event loop.

Either way, the handler always returns 200; the UI is already client-side
detached. A failed or timed-out cancel is a telemetry concern, not a
user-facing error. The ``cancel_run`` telemetry event lets adapter teams
measure cancel-honor rates by warehouse.
"""

import asyncio
from unittest.mock import MagicMock, patch

import pytest


class _FakeCancelTask:
    """Synchronous fake task; cancel() completes instantly."""

    def __init__(self):
        self.is_cancelled = False
        self.cancelled = False

    def cancel(self):
        self.cancelled = True
        self.is_cancelled = True


@pytest.fixture
def tmp_run():
    """Create a Run with status=RUNNING and register a fake task.

    Mirrors the fixture in tests/apis/test_run_func.py::TestCancelRunSplit.
    Patches default_context so RunDAO resolves against an in-memory list,
    and cleans up running_tasks afterward.
    """
    from recce.apis import run_func
    from recce.models import RunDAO
    from recce.models.types import Run, RunStatus, RunType

    with (
        patch("recce.apis.run_func.default_context") as mock_run_func_ctx,
        patch("recce.core.default_context") as mock_core_ctx,
    ):
        context = MagicMock()
        context.adapter_type = "dbt"
        context.review_mode = False
        context.runs = []
        mock_run_func_ctx.return_value = context
        mock_core_ctx.return_value = context

        run = Run(type=RunType.QUERY, params={"sql_template": "select 1"}, status=RunStatus.RUNNING)
        RunDAO().create(run)
        task = _FakeCancelTask()
        run_func.running_tasks[str(run.run_id)] = task
        try:
            yield run
        finally:
            run_func.running_tasks.pop(str(run.run_id), None)


@pytest.mark.asyncio
async def test_cancel_handler_records_acknowledged(tmp_run):
    """Happy path: cancel completes within timeout, outcome=acknowledged."""
    from recce.apis.run_api import cancel_run_handler

    events = []
    with patch(
        "recce.apis.run_api.log_api_event",
        side_effect=lambda name, props: events.append((name, props)),
    ):
        await cancel_run_handler(tmp_run.run_id)

    cancel_events = [e for e in events if e[0] == "cancel_run"]
    assert len(cancel_events) == 1, f"expected exactly one cancel_run event, got {len(cancel_events)}"
    props = cancel_events[0][1]
    assert props["outcome"] == "acknowledged"
    assert props["run_id"] == str(tmp_run.run_id)
    assert "elapsed_ms_at_cancel" in props
    assert isinstance(props["elapsed_ms_at_cancel"], int)
    assert props["elapsed_ms_at_cancel"] >= 0


@pytest.mark.asyncio
async def test_cancel_handler_returns_within_3s_when_task_cancel_hangs(tmp_run, caplog):
    """Hung adapter cancel: handler returns within 3s, outcome=timed_out.

    Without the asyncio.to_thread + wait_for wrap, a 60s sleep inside
    task.cancel would block the event loop. With it, the handler must
    bail at the 2s timeout.
    """
    import logging
    import time

    from recce.apis import run_func
    from recce.apis.run_api import cancel_run_handler

    class HangingTask:
        is_cancelled = False

        def cancel(self):
            # 5s exceeds the 2s timeout but keeps the dangling worker
            # thread short enough that pytest's process can shut down
            # promptly after the test exits.
            time.sleep(5)

    run_func.running_tasks[str(tmp_run.run_id)] = HangingTask()

    events = []
    with (
        caplog.at_level(logging.WARNING, logger="uvicorn"),
        patch(
            "recce.apis.run_api.log_api_event",
            side_effect=lambda name, props: events.append((name, props)),
        ),
    ):
        start = asyncio.get_event_loop().time()
        await cancel_run_handler(tmp_run.run_id)
        elapsed = asyncio.get_event_loop().time() - start

    assert elapsed < 3.0, f"handler took {elapsed:.1f}s, expected <3s"
    cancel_events = [e for e in events if e[0] == "cancel_run"]
    assert len(cancel_events) == 1
    assert cancel_events[0][1]["outcome"] == "timed_out"
    # Logger emits a warning so operators see the timeout in the server log.
    assert any(
        "cancel_run timed out" in r.getMessage() and str(tmp_run.run_id) in r.getMessage()
        for r in caplog.records
        if r.levelno == logging.WARNING
    ), "expected a logger.warning citing the timeout and run_id"


@pytest.mark.asyncio
async def test_cancel_handler_records_errored(tmp_run, caplog):
    """Adapter raises a generic exception: outcome=errored, no exception escapes."""
    import logging

    from recce.apis import run_func
    from recce.apis.run_api import cancel_run_handler

    class ErrorTask:
        is_cancelled = False

        def cancel(self):
            raise RuntimeError("adapter blew up")

    run_func.running_tasks[str(tmp_run.run_id)] = ErrorTask()

    events = []
    with (
        caplog.at_level(logging.WARNING, logger="uvicorn"),
        patch(
            "recce.apis.run_api.log_api_event",
            side_effect=lambda name, props: events.append((name, props)),
        ),
    ):
        await cancel_run_handler(tmp_run.run_id)  # must not raise

    cancel_events = [e for e in events if e[0] == "cancel_run"]
    assert len(cancel_events) == 1
    assert cancel_events[0][1]["outcome"] == "errored"
    # Logger emits a warning so operators see the adapter exception.
    assert any(
        "cancel_run errored" in r.getMessage() and "adapter blew up" in r.getMessage()
        for r in caplog.records
        if r.levelno == logging.WARNING
    ), "expected a logger.warning citing the adapter exception"


@pytest.mark.asyncio
async def test_cancel_handler_treats_not_implemented_as_acknowledged(tmp_run):
    """Adapter does not implement cancel: outcome=acknowledged.

    The UX is already detached at this point — a NotImplementedError from
    the adapter is not a user-facing failure; recording it as ``errored``
    would just generate noise in telemetry dashboards.
    """
    from recce.apis import run_func
    from recce.apis.run_api import cancel_run_handler

    class NotImplTask:
        is_cancelled = False

        def cancel(self):
            raise NotImplementedError()

    run_func.running_tasks[str(tmp_run.run_id)] = NotImplTask()

    events = []
    with patch(
        "recce.apis.run_api.log_api_event",
        side_effect=lambda name, props: events.append((name, props)),
    ):
        await cancel_run_handler(tmp_run.run_id)

    cancel_events = [e for e in events if e[0] == "cancel_run"]
    assert len(cancel_events) == 1
    assert cancel_events[0][1]["outcome"] == "acknowledged"


@pytest.mark.asyncio
async def test_cancel_handler_records_acknowledged_when_run_missing():
    """Unknown run_id: outcome=acknowledged, no exception escapes.

    The frontend has already detached client-side. A missing run is
    typically a double-cancel race (run finished + cleaned up between
    the user click and the handler running). Treating it as ack avoids
    noisy 4xx responses for a normal race condition.
    """
    from uuid import uuid4

    from recce.apis.run_api import cancel_run_handler

    with (
        patch("recce.apis.run_func.default_context") as mock_run_func_ctx,
        patch("recce.core.default_context") as mock_core_ctx,
    ):
        context = MagicMock()
        context.adapter_type = "dbt"
        context.runs = []
        mock_run_func_ctx.return_value = context
        mock_core_ctx.return_value = context

        events = []
        with patch(
            "recce.apis.run_api.log_api_event",
            side_effect=lambda name, props: events.append((name, props)),
        ):
            await cancel_run_handler(uuid4())

    cancel_events = [e for e in events if e[0] == "cancel_run"]
    assert len(cancel_events) == 1
    assert cancel_events[0][1]["outcome"] == "acknowledged"
