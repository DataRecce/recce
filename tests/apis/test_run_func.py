"""Tests for recce/apis/run_func.py

This module tests the run function API, specifically:
1. materialize_run_results() - aggregates run results by node
2. Params propagation - ensures updated task.params flow back to run.params
3. Params serialization - handles Pydantic v1/v2 models and plain dicts

The params propagation is critical for warehouse-resilient naming:
after task execution, normalized primary_keys must be reflected in run.params.
"""

import asyncio
import os
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from pydantic import BaseModel

from recce.apis.run_func import materialize_run_results
from recce.state import RecceState

current_dir = os.path.dirname(os.path.abspath(__file__))


# =============================================================================
# Existing Test: materialize_run_results
# =============================================================================


def test_materialize_run_results():
    """Test materialize_run_results aggregates run results correctly."""
    path = os.path.join(os.path.join(current_dir, "row_count_diff.json"))
    state = RecceState.from_file(path)
    result = materialize_run_results(state.runs)

    node_result = result["customers"]["row_count_diff"]
    assert node_result["run_id"] == UUID("92f31d63-0758-46af-a674-0e969208ec96")
    assert node_result["result"]["base"] == 1856
    assert node_result["result"]["curr"] == 1856

    result = materialize_run_results(state.runs, nodes=["xyz"])
    assert result == {}


def test_materialize_run_results_skips_cancelled_runs():
    """Cancelled runs with late-arriving results must NOT leak into the
    aggregate. Regression for the "false-quiet" hole in DRC-3411: the
    frontend sticky cancelled set is browser-local, so other tabs/devices
    would otherwise see lineage decorated by a cancelled row_count_diff.
    """
    from recce.models.types import Run, RunStatus, RunType

    cancelled_run = Run(
        type=RunType.ROW_COUNT_DIFF,
        params={"node_names": ["customers"]},
        result={"customers": {"base": 1856, "curr": 1856}},
        status=RunStatus.CANCELLED,
    )

    result = materialize_run_results([cancelled_run])

    assert result == {}, "Cancelled run leaked into materialized aggregate"


# =============================================================================
# Integration Tests: submit_run with Mocked Task
# =============================================================================


class _PydanticTaskParams(BaseModel):
    model: str
    primary_key: list[str]
    in_a: str


class _LegacyTaskParams:
    def __init__(self, values):
        self.values = values

    def dict(self):
        return self.values


class _BrokenTaskParams:
    def model_dump(self):
        raise RuntimeError("serialization failed")


class _UnknownTaskParams:
    pass


class TestSubmitRunParamsPropagation:
    """Integration tests for params propagation through submit_run.

    These tests verify that when a task normalizes its params during execution,
    those changes are propagated back to the run object.
    """

    @pytest.fixture
    def mock_context(self):
        """Create a mock RecceContext for testing."""
        with (
            patch("recce.apis.run_func.default_context") as mock_run_func_ctx,
            patch("recce.core.default_context") as mock_core_ctx,
        ):
            context = MagicMock()
            context.adapter_type = "dbt"
            context.review_mode = False
            context.runs = []
            # Both patches should return the same mock context
            mock_run_func_ctx.return_value = context
            mock_core_ctx.return_value = context
            yield context

    @pytest.fixture
    def mock_task_class(self):
        """Create a successful fake task with caller-controlled params."""

        class MockTask:
            def __init__(self, params):
                self.params = params
                self.is_cancelled = False
                self._progress_listener = None

            @property
            def progress_listener(self):
                return self._progress_listener

            @progress_listener.setter
            def progress_listener(self, value):
                self._progress_listener = value

            def execute(self):
                return {"diff": {"columns": [], "data": []}}

            def cancel(self):
                self.is_cancelled = True

        return MockTask

    @pytest.mark.parametrize(
        ("task_params", "original_params", "expected_params"),
        [
            pytest.param(
                _PydanticTaskParams(
                    model="customers",
                    primary_key=["CUSTOMER_ID"],
                    in_a="in_a",
                ),
                {
                    "model": "customers",
                    "primary_key": ["customer_id"],
                    "columns": ["name", "age"],
                },
                {
                    "model": "customers",
                    "primary_key": ["CUSTOMER_ID"],
                    "columns": ["name", "age"],
                    "in_a": "in_a",
                },
                id="pydantic-model",
            ),
            pytest.param(
                _LegacyTaskParams(
                    {
                        "model": "customers",
                        "primary_key": ["CUSTOMER_ID"],
                        "in_b": "in_b",
                    }
                ),
                {"model": "customers", "primary_key": ["customer_id"]},
                {
                    "model": "customers",
                    "primary_key": ["CUSTOMER_ID"],
                    "in_b": "in_b",
                },
                id="legacy-model",
            ),
            pytest.param(
                {
                    "model": "customers",
                    "primary_key": None,
                    "options": {"limit": 50},
                },
                {
                    "model": "customers",
                    "primary_key": ["customer_id"],
                    "options": {"limit": 100, "offset": 0},
                },
                {
                    "model": "customers",
                    "primary_key": None,
                    "options": {"limit": 50},
                },
                id="plain-dict",
            ),
        ],
    )
    @pytest.mark.asyncio
    async def test_task_params_propagate_to_run(
        self,
        mock_context,
        mock_task_class,
        task_params,
        original_params,
        expected_params,
    ):
        """Completed runs persist the task's normalized parameter values."""
        from recce.apis.run_func import submit_run

        with patch("recce.apis.run_func.create_task") as mock_create_task:
            mock_task = mock_task_class(task_params)
            mock_create_task.return_value = mock_task

            run, future = submit_run(type="value_diff", params=original_params.copy())
            await asyncio.wrap_future(future)

            from recce.models.types import RunStatus

            assert run.params == expected_params
            # Regression guard for the DRC-3307 root cause: run.status and
            # run.result MUST already be set when the future resolves. If these
            # assertions ever need a sleep/poll to pass, update_run_result is
            # being scheduled async again (e.g., via run_coroutine_threadsafe)
            # instead of called synchronously inside the executor thread.
            assert run.status == RunStatus.FINISHED
            assert run.result is not None

    @pytest.mark.parametrize(
        ("task_params", "warning"),
        [
            pytest.param(None, None, id="no-params"),
            pytest.param(_BrokenTaskParams(), "Failed to serialize task.params", id="serialization-error"),
            pytest.param(_UnknownTaskParams(), "unexpected type", id="unknown-type"),
        ],
    )
    @pytest.mark.asyncio
    async def test_unserializable_task_params_do_not_fail_run(
        self,
        mock_context,
        mock_task_class,
        caplog,
        task_params,
        warning,
    ):
        """Successful task results survive absent or unserializable task params."""
        from recce.apis.run_func import submit_run
        from recce.models.types import RunStatus

        original_params = {"model": "customers", "primary_key": ["customer_id"]}
        with patch("recce.apis.run_func.create_task") as mock_create_task:
            mock_create_task.return_value = mock_task_class(task_params)

            run, future = submit_run(type="value_diff", params=original_params.copy())
            await asyncio.wrap_future(future)

        assert run.params == original_params
        assert run.status == RunStatus.FINISHED
        assert run.result == {"diff": {"columns": [], "data": []}}
        if warning is not None:
            assert warning in caplog.text

    @pytest.mark.asyncio
    async def test_triggered_by_propagates_to_run(self, mock_context, mock_task_class):
        """Test that triggered_by parameter is set on the created Run object."""
        from recce.apis.run_func import submit_run

        with patch("recce.apis.run_func.create_task") as mock_create_task:
            mock_task = mock_task_class({"model": "customers", "primary_key": ["customer_id"]})
            mock_create_task.return_value = mock_task

            run, future = submit_run(
                type="value_diff",
                params={"model": "customers", "primary_key": ["customer_id"]},
                triggered_by="recce_ai",
            )

            assert run.triggered_by == "recce_ai"

            # Clean up: wait for the future to complete
            await asyncio.wrap_future(future)

    @pytest.mark.asyncio
    async def test_triggered_by_defaults_to_none(self, mock_context, mock_task_class):
        """Test that triggered_by defaults to None when not specified."""
        from recce.apis.run_func import submit_run

        with patch("recce.apis.run_func.create_task") as mock_create_task:
            mock_task = mock_task_class({"model": "customers", "primary_key": ["customer_id"]})
            mock_create_task.return_value = mock_task

            run, future = submit_run(
                type="value_diff",
                params={"model": "customers", "primary_key": ["customer_id"]},
            )

            assert run.triggered_by is None

            # Clean up: wait for the future to complete
            await asyncio.wrap_future(future)

    @pytest.mark.asyncio
    async def test_cancel_sentinel_preserved_on_success(self, mock_context, mock_task_class):
        """Regression: if cancel_run flips run.status = CANCELLED while the
        executor thread is finishing a successful task, update_run_result
        must NOT overwrite CANCELLED with FINISHED. Without this guard, a
        cancel-mid-execution race silently disappears."""
        from recce.apis.run_func import submit_run
        from recce.models.types import RunStatus

        with patch("recce.apis.run_func.create_task") as mock_create_task:
            mock_task = mock_task_class({"model": "customers", "primary_key": ["customer_id"]})
            mock_create_task.return_value = mock_task

            run, future = submit_run(
                type="value_diff",
                params={"model": "customers", "primary_key": ["customer_id"]},
            )
            # Simulate cancel_run flipping the sentinel BEFORE the executor
            # thread finishes — the success path should observe CANCELLED
            # and refuse to overwrite it.
            run.status = RunStatus.CANCELLED

            await asyncio.wrap_future(future)

            assert run.status == RunStatus.CANCELLED, "update_run_result success path overwrote CANCELLED sentinel"

    @pytest.mark.asyncio
    async def test_repr_fallback_when_str_error_is_none_string(self, mock_context):
        """Coverage for the ``repr(error)`` fallback in update_run_result.
        If a task raises an exception whose ``str(e) == "None"`` (e.g.,
        ``Exception(None)``), the failed_reason falls back to ``repr(e)``
        so the run.error field carries useful information."""
        from recce.apis.run_func import submit_run
        from recce.models.types import RunStatus

        class TaskRaisingNoneException:
            def __init__(self, params):
                self.params = None
                self.is_cancelled = False
                self._progress_listener = None

            @property
            def progress_listener(self):
                return self._progress_listener

            @progress_listener.setter
            def progress_listener(self, value):
                self._progress_listener = value

            def execute(self):
                raise Exception(None)

            def cancel(self):
                self.is_cancelled = True

        with patch("recce.apis.run_func.create_task") as mock_create_task:
            mock_create_task.return_value = TaskRaisingNoneException({})

            run, future = submit_run(type="value_diff", params={})
            await asyncio.wrap_future(future)

            assert run.status == RunStatus.FAILED
            # repr(Exception(None)) is "Exception(None)" — proves we fell
            # through the str(e) == "None" branch and recorded a useful value.
            assert run.error is not None
            assert run.error != "None"


# =============================================================================
# Tests: generate_run_name for metadata types
# =============================================================================


class TestGenerateRunNameRowCountDiff:
    """Tests for generate_run_name with row_count_diff node_ids fallback."""

    def test_row_count_diff_node_names_single(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(type=RunType.ROW_COUNT_DIFF, params={"node_names": ["customers"]})
        assert generate_run_name(run) == "Row count diff of customers"

    def test_row_count_diff_node_ids_single(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(
            type=RunType.ROW_COUNT_DIFF,
            params={"node_ids": ["model.jaffle_shop.customers"]},
        )
        assert generate_run_name(run) == "Row count diff of customers"

    def test_row_count_diff_node_ids_multiple(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(
            type=RunType.ROW_COUNT_DIFF,
            params={"node_ids": ["model.jaffle_shop.customers", "model.jaffle_shop.orders"]},
        )
        assert generate_run_name(run) == "Row count of 2 nodes"

    def test_row_count_diff_no_params(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(type=RunType.ROW_COUNT_DIFF, params={})
        assert generate_run_name(run) == "Row count of multiple nodes"


class TestGenerateRunNameMetadataTypes:
    """Tests for generate_run_name with lineage_diff and schema_diff types."""

    def test_lineage_diff_name(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(type=RunType.LINEAGE_DIFF, params={})
        assert generate_run_name(run) == "Lineage diff"

    def test_schema_diff_no_params(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(type=RunType.SCHEMA_DIFF, params={})
        assert generate_run_name(run) == "Schema diff"

    # REST API convention: node_id (single string, fully-qualified)
    def test_schema_diff_node_id(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(type=RunType.SCHEMA_DIFF, params={"node_id": "model.jaffle_shop.customers"})
        assert generate_run_name(run) == "Schema diff of customers"

    # MCP convention: node_names (array of short names)
    def test_schema_diff_single_node_name(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(type=RunType.SCHEMA_DIFF, params={"node_names": ["customers"]})
        assert generate_run_name(run) == "Schema diff of customers"

    def test_schema_diff_multiple_node_names(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(type=RunType.SCHEMA_DIFF, params={"node_names": ["customers", "orders"]})
        assert generate_run_name(run) == "Schema diff of 2 nodes"

    # MCP convention: node_ids (array of fully-qualified IDs)
    def test_schema_diff_single_node_id_array(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(
            type=RunType.SCHEMA_DIFF,
            params={"node_ids": ["model.jaffle_shop.customers"]},
        )
        assert generate_run_name(run) == "Schema diff of customers"

    def test_schema_diff_multiple_node_ids(self):
        from recce.apis.run_func import generate_run_name
        from recce.models.types import Run, RunType

        run = Run(
            type=RunType.SCHEMA_DIFF,
            params={"node_ids": ["model.jaffle_shop.customers", "model.jaffle_shop.orders"]},
        )
        assert generate_run_name(run) == "Schema diff of 2 nodes"


# =============================================================================
# Tests: cancel_run split (_mark_run_cancelled + _invoke_task_cancel)
# =============================================================================


class _FakeCancelTask:
    """Fake task that records whether cancel() was invoked.

    Used by the cancel_run-split tests; intentionally synchronous so the
    tests can observe the status flip independently of the cancel call.
    """

    def __init__(self):
        self.is_cancelled = False
        self.cancelled = False

    def cancel(self):
        self.cancelled = True
        self.is_cancelled = True


class TestCancelRunSplit:
    """Tests for the cancel_run split into _mark_run_cancelled +
    _invoke_task_cancel.

    The split lets the FastAPI handler flip run.status synchronously
    (so the UI sees the cancel immediately) and run the adapter cancel
    on a worker thread with a timeout (so a hung warehouse cancel does
    not block the event loop).
    """

    @pytest.fixture
    def tmp_run(self):
        """Create a Run with status=RUNNING and register a fake task.

        Patches default_context so RunDAO().find_run_by_id() resolves
        against an in-memory list. Cleans up the running_tasks entry
        afterwards so tests do not leak state.
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

    def test_mark_run_cancelled_flips_status_immediately(self, tmp_run):
        """Status flips to CANCELLED before any adapter cancel runs."""
        from recce.apis.run_func import _mark_run_cancelled
        from recce.models.types import RunStatus

        run, task = _mark_run_cancelled(str(tmp_run.run_id))
        assert run.status == RunStatus.CANCELLED
        assert task is not None
        # The split must NOT call task.cancel() — that is _invoke_task_cancel's
        # job. This is what lets the handler bound the cancel duration.
        assert task.cancelled is False

    def test_mark_run_cancelled_raises_when_run_missing(self):
        """Missing run raises RecceException."""
        from recce.apis.run_func import _mark_run_cancelled
        from recce.exceptions import RecceException

        with (
            patch("recce.apis.run_func.default_context") as mock_run_func_ctx,
            patch("recce.core.default_context") as mock_core_ctx,
        ):
            context = MagicMock()
            context.runs = []
            mock_run_func_ctx.return_value = context
            mock_core_ctx.return_value = context

            with pytest.raises(RecceException, match="not found"):
                _mark_run_cancelled("nonexistent")

    def test_mark_run_cancelled_raises_when_task_missing(self, tmp_run):
        """Missing running task raises RecceException."""
        from recce.apis import run_func
        from recce.apis.run_func import _mark_run_cancelled
        from recce.exceptions import RecceException

        # Drop the task from running_tasks so only the run exists.
        run_func.running_tasks.pop(str(tmp_run.run_id), None)
        with pytest.raises(RecceException, match="not found"):
            _mark_run_cancelled(str(tmp_run.run_id))

    def test_invoke_task_cancel_calls_task_cancel(self, tmp_run):
        """_invoke_task_cancel propagates synchronously to task.cancel."""
        from recce.apis import run_func
        from recce.apis.run_func import _invoke_task_cancel

        task = run_func.running_tasks[str(tmp_run.run_id)]
        assert task.cancelled is False
        _invoke_task_cancel(task)
        assert task.cancelled is True

    def test_cancel_run_shim_still_works(self, tmp_run):
        """Backwards-compat: cancel_run flips status AND cancels the task."""
        from recce.apis import run_func
        from recce.apis.run_func import cancel_run
        from recce.models.types import RunStatus

        task = run_func.running_tasks[str(tmp_run.run_id)]
        cancel_run(str(tmp_run.run_id))
        assert tmp_run.status == RunStatus.CANCELLED
        assert task.cancelled is True
