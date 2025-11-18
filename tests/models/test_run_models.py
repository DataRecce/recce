from recce.models.types import Run, RunStatus, RunType
from recce.state import RecceState


class TestRecceStateWithRuns:
    """Test RecceState integration with Run objects and Run.__init__ result validation"""

    def test_recce_state_with_query_result_validation(self):
        """Test RecceState correctly deserializes query results through Run.__init__"""
        state_dict = {
            "runs": [
                {
                    "type": "query",
                    "name": "customer_query",
                    "params": {"sql": "SELECT * FROM customers"},
                    "status": "finished",
                    "result": {
                        "columns": [{"name": "customer_id", "type": "integer"}, {"name": "name", "type": "text"}],
                        "data": [[1, "Alice"], [2, "Bob"]],
                        "limit": None,
                        "more": False,
                    },
                }
            ],
            "checks": [],
        }

        state = RecceState(**state_dict)
        run = state.runs[0]

        # Verify Run was created correctly
        assert isinstance(run, Run)
        assert run.type == RunType.QUERY
        assert run.status == RunStatus.FINISHED

        # Verify Run.__init__ validated and preserved result structure
        assert run.result is not None
        assert "columns" in run.result
        assert "data" in run.result

        # Verify DataFrameColumn auto-set key=name (from DataFrameColumn.__init__)
        assert run.result["columns"][0]["key"] == "customer_id"
        assert run.result["columns"][0]["name"] == "customer_id"

    def test_recce_state_with_profile_result_validation(self):
        """Test RecceState correctly deserializes profile results through Run.__init__"""
        state_dict = {
            "runs": [
                {
                    "type": "profile",
                    "name": "customers_profile",
                    "params": {"model": "customers"},
                    "status": "finished",
                    "result": {
                        "current": {
                            "columns": [
                                {"name": "column_name", "type": "text"},
                                {"name": "row_count", "type": "integer"},
                            ],
                            "data": [["customer_id", 100], ["name", 100]],
                        }
                    },
                }
            ],
            "checks": [],
        }

        state = RecceState(**state_dict)
        run = state.runs[0]

        assert run.type == RunType.PROFILE
        assert run.result is not None
        assert "current" in run.result

        # Verify DataFrameColumn auto-set key=name in nested structure
        assert run.result["current"]["columns"][0]["key"] == "column_name"

    def test_recce_state_with_query_diff_result_validation(self):
        """Test RecceState correctly deserializes query_diff results through Run.__init__"""
        state_dict = {
            "runs": [
                {
                    "type": "query_diff",
                    "name": "users_diff",
                    "status": "finished",
                    "result": {
                        "base": {"columns": [{"name": "id", "type": "integer"}], "data": [[1], [2]]},
                        "current": {"columns": [{"name": "id", "type": "integer"}], "data": [[1], [2], [3]]},
                        "diff": None,
                    },
                }
            ],
            "checks": [],
        }

        state = RecceState(**state_dict)
        run = state.runs[0]

        assert run.type == RunType.QUERY_DIFF
        assert run.result is not None
        assert "base" in run.result
        assert "current" in run.result
        # Verify both base and current DataFrames have auto-set keys
        assert run.result["base"]["columns"][0]["key"] == "id"
        assert run.result["current"]["columns"][0]["key"] == "id"

    def test_recce_state_with_value_diff_result_validation(self):
        """Test RecceState correctly deserializes value_diff results through Run.__init__"""
        state_dict = {
            "runs": [
                {
                    "type": "value_diff",
                    "name": "products_diff",
                    "status": "finished",
                    "result": {
                        "summary": {"total": 100, "added": 5, "removed": 2},
                        "data": {"columns": [{"name": "product_id", "type": "integer"}], "data": [[1], [2]]},
                    },
                }
            ],
            "checks": [],
        }

        state = RecceState(**state_dict)
        run = state.runs[0]

        assert run.type == RunType.VALUE_DIFF
        assert run.result is not None
        assert "summary" in run.result
        assert run.result["summary"]["total"] == 100
        # Verify nested DataFrame has auto-set key
        assert run.result["data"]["columns"][0]["key"] == "product_id"

    def test_recce_state_with_value_diff_detail_result_validation(self):
        """Test RecceState correctly deserializes value_diff_detail results through Run.__init__"""
        state_dict = {
            "runs": [
                {
                    "type": "value_diff_detail",
                    "name": "detailed_diff",
                    "status": "finished",
                    "result": {
                        "columns": [{"name": "id", "type": "integer"}, {"name": "__diff_status__", "type": "text"}],
                        "data": [[1, "modified"], [2, "added"]],
                    },
                }
            ],
            "checks": [],
        }

        state = RecceState(**state_dict)
        run = state.runs[0]

        assert run.type == RunType.VALUE_DIFF_DETAIL
        assert run.result is not None
        assert "columns" in run.result
        assert run.result["columns"][0]["key"] == "id"

    def test_recce_state_with_profile_diff_result_validation(self):
        """Test RecceState correctly deserializes profile_diff results through Run.__init__"""
        state_dict = {
            "runs": [
                {
                    "type": "profile_diff",
                    "name": "profile_comparison",
                    "status": "finished",
                    "result": {
                        "base": {"columns": [{"name": "stat", "type": "text"}], "data": [["count", 100]]},
                        "current": {"columns": [{"name": "stat", "type": "text"}], "data": [["count", 105]]},
                    },
                }
            ],
            "checks": [],
        }

        state = RecceState(**state_dict)
        run = state.runs[0]

        assert run.type == RunType.PROFILE_DIFF
        assert run.result is not None
        assert "base" in run.result
        assert "current" in run.result

    def test_recce_state_with_unvalidated_run_types(self):
        """Test RecceState with run types that don't go through Run.__init__ validation"""
        state_dict = {
            "runs": [
                {
                    "type": "row_count_diff",
                    "name": "customers_row_count",
                    "status": "finished",
                    "result": {"customers": {"base": 95, "curr": 100}},
                }
            ],
            "checks": [],
        }

        state = RecceState(**state_dict)
        run = state.runs[0]

        # row_count_diff doesn't go through Run.__init__ validation
        # so result stays as-is (dict without DataFrame structure)
        assert run.type == RunType.ROW_COUNT_DIFF
        assert run.result is not None
        assert run.result["customers"]["base"] == 95

    def test_recce_state_roundtrip_with_results(self):
        """Test RecceState serialization roundtrip preserves validated results"""
        original_state = RecceState(
            runs=[
                Run(
                    type=RunType.QUERY,
                    status=RunStatus.FINISHED,
                    result={"columns": [{"name": "id", "type": "integer"}], "data": [[1], [2]]},
                )
            ]
        )

        # Serialize and deserialize
        json_str = original_state.to_json()
        restored_state = RecceState.from_json(json_str)

        # Verify result structure is preserved
        assert len(restored_state.runs) == 1
        run = restored_state.runs[0]
        assert run.result is not None
        assert run.result["columns"][0]["key"] == "id"

    def test_recce_state_with_runs_without_results(self):
        """Test RecceState works with runs that have no results"""
        state_dict = {
            "runs": [
                {"type": "query", "name": "pending_query", "status": "running"},
                {"type": "profile", "name": "pending_profile", "status": "running"},
            ],
            "checks": [],
        }

        state = RecceState(**state_dict)

        assert len(state.runs) == 2
        assert state.runs[0].result is None
        assert state.runs[1].result is None

    def test_recce_state_with_null_results(self):
        """Test RecceState handles runs with explicitly null results"""
        state_dict = {
            "runs": [
                {
                    "type": "query",
                    "name": "failed_query",
                    "status": "failed",
                    "result": None,
                    "error": "Query execution failed",
                }
            ],
            "checks": [],
        }

        state = RecceState(**state_dict)

        assert len(state.runs) == 1
        assert state.runs[0].result is None
        assert state.runs[0].error == "Query execution failed"

    def test_recce_state_with_mixed_result_states(self):
        """Test RecceState with runs in various states (finished, running, failed, cancelled)"""
        state_dict = {
            "runs": [
                {
                    "type": "query",
                    "name": "completed_query",
                    "status": "finished",
                    "result": {"columns": [{"name": "id", "type": "integer"}], "data": [[1]]},
                },
                {"type": "profile", "name": "running_profile", "status": "running"},
                {
                    "type": "value_diff",
                    "name": "failed_diff",
                    "status": "failed",
                    "result": None,
                    "error": "Connection timeout",
                },
                {"type": "query_diff", "name": "cancelled_diff", "status": "cancelled"},
            ],
            "checks": [],
        }

        state = RecceState(**state_dict)

        assert len(state.runs) == 4
        assert state.runs[0].result is not None  # Finished with result
        assert state.runs[1].result is None  # Running, no result yet
        assert state.runs[2].result is None  # Failed, null result
        assert state.runs[3].result is None  # Cancelled, no result
