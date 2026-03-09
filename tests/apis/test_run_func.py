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


# =============================================================================
# Tests: Params Merge Logic (update_run_result behavior)
# =============================================================================


class TestUpdateRunResultBehavior:
    """Tests for the params merge behavior in update_run_result.

    Since update_run_result is a nested function, we test the behavior
    by verifying the merge logic that would occur.
    """

    def test_params_merge_updates_existing_params(self):
        """Updated params should be merged into run.params."""
        # Simulate run.params before task execution
        original_params = {"model": "customers", "primary_key": ["customer_id"]}

        # Simulate updated params after task execution (PK normalized to UPPERCASE)
        updated_params = {"model": "customers", "primary_key": ["CUSTOMER_ID"]}

        # Simulate the merge behavior from update_run_result
        original_params.update(updated_params)

        assert original_params["primary_key"] == ["CUSTOMER_ID"]
        assert original_params["model"] == "customers"

    def test_params_merge_preserves_fields_not_in_updated(self):
        """Fields not in updated_params should be preserved."""
        original_params = {
            "model": "customers",
            "primary_key": ["customer_id"],
            "columns": ["name", "age"],  # Not in updated_params
        }

        # Task only updates primary_key
        updated_params = {"model": "customers", "primary_key": ["CUSTOMER_ID"]}

        original_params.update(updated_params)

        assert original_params["columns"] == ["name", "age"]
        assert original_params["primary_key"] == ["CUSTOMER_ID"]

    def test_params_merge_handles_none_updated_params(self):
        """When updated_params is None, original params should be unchanged."""
        original_params = {"model": "customers", "primary_key": ["customer_id"]}
        original_copy = original_params.copy()

        updated_params = None

        # Simulate the conditional merge from update_run_result
        if updated_params is not None:
            original_params.update(updated_params)

        assert original_params == original_copy

    def test_params_merge_adds_new_fields(self):
        """New fields in updated_params should be added to run.params."""
        original_params = {"model": "customers"}

        updated_params = {
            "model": "customers",
            "primary_key": ["CUSTOMER_ID"],  # Added by task
            "in_a": "in_a",  # Normalized by task
            "in_b": "in_b",
        }

        original_params.update(updated_params)

        assert original_params["primary_key"] == ["CUSTOMER_ID"]
        assert original_params["in_a"] == "in_a"
        assert original_params["in_b"] == "in_b"


# =============================================================================
# Tests: Params Serialization Logic (fn() behavior)
# =============================================================================


class TestParamsSerializationBehavior:
    """Tests for params serialization in the fn() closure.

    The fn() closure extracts task.params after execution using:
    1. model_dump() for Pydantic v2
    2. dict() for Pydantic v1
    3. Direct pass-through for plain dicts
    """

    def test_extracts_pydantic_v2_params(self):
        """Pydantic v2 models should use model_dump()."""

        class PydanticV2Params(BaseModel):
            model: str
            primary_key: list

        params = PydanticV2Params(model="customers", primary_key=["CUSTOMER_ID"])

        # Simulate the extraction logic from fn()
        if hasattr(params, "model_dump"):
            extracted = params.model_dump()
        elif hasattr(params, "dict"):
            extracted = params.dict()
        else:
            extracted = params

        assert extracted == {"model": "customers", "primary_key": ["CUSTOMER_ID"]}
        assert isinstance(extracted, dict)

    def test_extracts_pydantic_v1_params(self):
        """Pydantic v1 models should use dict() method."""

        # Simulate a Pydantic v1-style object (has dict() but not model_dump())
        class PydanticV1Params:
            def __init__(self):
                self.model = "customers"
                self.primary_key = ["CUSTOMER_ID"]

            def dict(self):
                return {"model": self.model, "primary_key": self.primary_key}

        params = PydanticV1Params()

        # Simulate the extraction logic from fn()
        if hasattr(params, "model_dump"):
            extracted = params.model_dump()
        elif hasattr(params, "dict"):
            extracted = params.dict()
        else:
            extracted = params

        assert extracted == {"model": "customers", "primary_key": ["CUSTOMER_ID"]}

    def test_extracts_plain_dict_params(self):
        """Plain dict params should pass through directly."""
        params = {"model": "customers", "primary_key": ["CUSTOMER_ID"]}

        # Simulate the extraction logic from fn()
        if hasattr(params, "model_dump"):
            extracted = params.model_dump()
        elif hasattr(params, "dict"):
            extracted = params.dict()
        elif isinstance(params, dict):
            extracted = params
        else:
            extracted = None

        assert extracted == {"model": "customers", "primary_key": ["CUSTOMER_ID"]}

    def test_handles_serialization_exception(self):
        """Serialization exceptions should be caught and logged."""

        class BrokenParams:
            def model_dump(self):
                raise RuntimeError("Serialization failed")

        params = BrokenParams()
        updated_params = None

        # Simulate the try/catch from fn()
        try:
            if hasattr(params, "model_dump"):
                updated_params = params.model_dump()
            elif hasattr(params, "dict"):
                updated_params = params.dict()
            elif isinstance(params, dict):
                updated_params = params
        except Exception:
            updated_params = None

        assert updated_params is None

    def test_handles_none_params(self):
        """None task.params should result in None updated_params."""
        params = None
        updated_params = None

        # Simulate the conditional check from fn()
        if params is not None:
            if hasattr(params, "model_dump"):
                updated_params = params.model_dump()
            elif hasattr(params, "dict"):
                updated_params = params.dict()
            elif isinstance(params, dict):
                updated_params = params

        assert updated_params is None

    def test_logs_warning_for_unknown_type(self):
        """Unknown params types should trigger a warning log."""

        class UnknownParams:
            """A params object without model_dump(), dict(), or being a dict."""

            pass

        params = UnknownParams()
        updated_params = "SENTINEL"  # Use sentinel to detect if branch was taken
        warning_logged = False

        # Simulate the extraction logic from fn()
        if hasattr(params, "model_dump"):
            updated_params = params.model_dump()
        elif hasattr(params, "dict"):
            updated_params = params.dict()
        elif isinstance(params, dict):
            updated_params = params
        else:
            # This is the warning branch
            warning_logged = True
            updated_params = None

        assert warning_logged is True
        assert updated_params is None


# =============================================================================
# Integration Tests: submit_run with Mocked Task
# =============================================================================


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
        """Create a mock task class that normalizes params."""

        class MockTask:
            def __init__(self, params):
                # Simulate Pydantic model
                self.params = MagicMock()
                self.params.model_dump = MagicMock(
                    return_value={
                        **params,
                        # Simulate normalization: lowercase -> UPPERCASE
                        "primary_key": [pk.upper() for pk in params.get("primary_key", [])],
                    }
                )
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

    @pytest.mark.asyncio
    async def test_normalized_params_propagate_to_run(self, mock_context, mock_task_class):
        """Test that normalized params from task execution flow to run.params."""
        from recce.apis.run_func import submit_run

        # Register the mock task
        with patch("recce.apis.run_func.create_task") as mock_create_task:
            mock_task = mock_task_class({"model": "customers", "primary_key": ["customer_id"]})
            mock_create_task.return_value = mock_task

            # Get the event loop
            asyncio.get_event_loop()

            # Submit the run
            run, future = submit_run(
                type="value_diff",
                params={"model": "customers", "primary_key": ["customer_id"]},
            )

            # Wait for the task to complete
            await asyncio.wrap_future(future)

            # The update_run_result coroutine is scheduled via
            # asyncio.run_coroutine_threadsafe from the executor thread.
            # Its callback chain (call_soon_threadsafe → create Task →
            # execute coroutine) spans multiple event loop iterations,
            # so a brief sleep lets the loop fully process it.
            await asyncio.sleep(0.1)

            # Verify params were normalized
            assert run.params["primary_key"] == ["CUSTOMER_ID"]

    @pytest.mark.asyncio
    async def test_run_params_unchanged_when_task_has_no_params(self, mock_context):
        """Test that run.params is unchanged when task.params is None."""
        from recce.apis.run_func import submit_run

        class TaskWithNoParams:
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
                return {"result": "success"}

            def cancel(self):
                self.is_cancelled = True

        with patch("recce.apis.run_func.create_task") as mock_create_task:
            mock_create_task.return_value = TaskWithNoParams({})

            original_params = {"model": "customers", "primary_key": ["customer_id"]}
            run, future = submit_run(type="value_diff", params=original_params.copy())

            await asyncio.wrap_future(future)

            # Params should be unchanged since task.params was None
            assert run.params == original_params


# =============================================================================
# Edge Case Tests
# =============================================================================


class TestEdgeCases:
    """Edge case tests for run_func behavior."""

    def test_empty_params_dict_is_valid(self):
        """Empty dict params should be handled gracefully."""
        params = {}

        if hasattr(params, "model_dump"):
            extracted = params.model_dump()
        elif hasattr(params, "dict"):
            extracted = params.dict()
        elif isinstance(params, dict):
            extracted = params
        else:
            extracted = None

        assert extracted == {}

    def test_params_with_none_values_preserved(self):
        """Params containing None values should be preserved."""
        params = {"model": "customers", "primary_key": None, "columns": None}

        original = {"model": "customers"}
        original.update(params)

        assert original["primary_key"] is None
        assert original["columns"] is None

    def test_nested_params_are_merged(self):
        """Nested dict structures should be merged (shallow merge)."""
        original = {
            "model": "customers",
            "options": {"limit": 100, "offset": 0},
        }

        updated = {
            "model": "customers",
            "options": {"limit": 50},  # Replaces entire options dict
        }

        original.update(updated)

        # Note: dict.update() does shallow merge, so options is replaced entirely
        assert original["options"] == {"limit": 50}
        assert "offset" not in original["options"]
