from uuid import uuid4

import pytest
from pydantic import ValidationError

from recce.models.types import (
    GenericRun,
    ProfileDiffRun,
    ProfileRun,
    QueryDiffRun,
    QueryRun,
    RunStatus,
    RunType,
    ValueDiffDetailRun,
    ValueDiffRun,
    create_run_instance,
)
from recce.state import RecceState


class TestRunFactory:
    """Test create_run_instance factory function"""

    def test_create_all_supported_run_types(self):
        """Test factory function creates correct Run instance for each type"""
        test_cases = [
            (RunType.QUERY, QueryRun),
            (RunType.QUERY_BASE, QueryRun),
            (RunType.QUERY_DIFF, QueryDiffRun),
            (RunType.VALUE_DIFF, ValueDiffRun),
            (RunType.VALUE_DIFF_DETAIL, ValueDiffDetailRun),
            (RunType.PROFILE, ProfileRun),
            (RunType.PROFILE_DIFF, ProfileDiffRun),
            (RunType.ROW_COUNT, GenericRun),
            (RunType.ROW_COUNT_DIFF, GenericRun),
            (RunType.HISTOGRAM_DIFF, GenericRun),
            (RunType.TOP_K_DIFF, GenericRun),
        ]

        for run_type, expected_class in test_cases:
            run = create_run_instance(type=run_type, params={"test": "value"}, status=RunStatus.RUNNING)
            assert isinstance(run, expected_class)
            assert run.type == run_type
            assert run.params == {"test": "value"}
            assert run.status == RunStatus.RUNNING

    def test_create_run_instance_with_check_id(self):
        """Test factory function with check_id parameter"""
        check_id = uuid4()
        run = create_run_instance(
            type=RunType.QUERY, params={"sql": "SELECT 1"}, check_id=check_id, status=RunStatus.FINISHED
        )

        assert run.check_id == check_id
        assert run.type == RunType.QUERY
        assert run.params == {"sql": "SELECT 1"}
        assert run.status == RunStatus.FINISHED

    def test_create_run_instance_with_minimal_params(self):
        """Test factory function with only required parameters"""
        run = create_run_instance(type=RunType.QUERY_DIFF)

        assert isinstance(run, QueryDiffRun)
        assert run.type == RunType.QUERY_DIFF
        assert run.params is None
        assert run.check_id is None
        assert run.status is None

    def test_create_run_instance_unsupported_type(self):
        """Test factory function with unsupported RunType"""
        with pytest.raises(ValueError, match="Unknown run type"):
            create_run_instance(type=RunType.SIMPLE)  # Not in factory mapping

        with pytest.raises(ValueError, match="Unknown run type"):
            create_run_instance(type=RunType.SCHEMA_DIFF)  # Not in factory mapping


class TestDiscriminatedUnionBehavior:
    """Test specific discriminated union behavior with Union type"""

    def test_discriminated_union_with_dict_data(self):
        """Test that discriminated union correctly selects Run subclass from dict data"""

        # Test data that should create different Run subclasses
        test_cases = [
            ({"type": "query", "params": {"sql": "SELECT 1"}}, QueryRun),
            ({"type": "query_base", "name": "base_query"}, QueryRun),
            ({"type": "query_diff", "params": {"model": "test"}}, QueryDiffRun),
            ({"type": "value_diff", "status": "running"}, ValueDiffRun),
            ({"type": "value_diff_detail", "name": "detail"}, ValueDiffDetailRun),
            ({"type": "profile", "params": {"columns": []}}, ProfileRun),
            ({"type": "profile_diff", "status": "finished"}, ProfileDiffRun),
            ({"type": "row_count", "params": {}}, GenericRun),
            ({"type": "row_count_diff", "name": "count_diff"}, GenericRun),
            ({"type": "histogram_diff", "status": "running"}, GenericRun),
            ({"type": "top_k_diff", "params": {"k": 10}}, GenericRun),
        ]

        for data, expected_class in test_cases:
            # This should work with Union[...] discriminated union
            validated_data = expected_class(**data)
            assert isinstance(validated_data, expected_class)
            assert validated_data.type == data["type"]

    def test_discriminated_union_invalid_type(self):
        """Test discriminated union behavior with invalid type"""
        invalid_data = {"type": "invalid_type", "params": {}}

        # Should fail when trying to validate with any specific Run class
        with pytest.raises(ValidationError):
            QueryRun(**invalid_data)

        with pytest.raises(ValidationError):
            GenericRun(**invalid_data)

    def test_discriminated_union_missing_type(self):
        """Test discriminated union behavior when type field is missing"""
        data_without_type = {"params": {"sql": "SELECT 1"}}

        with pytest.raises(ValidationError):
            QueryRun(**data_without_type)

    def test_discriminated_union_enum_vs_string(self):
        """Test that both enum and string values work for type field"""
        # Using enum value
        run_with_enum = QueryRun(type=RunType.QUERY, params={"sql": "SELECT 1"})
        assert run_with_enum.type == RunType.QUERY

        # Using dict with string value (as would come from JSON)
        run_from_dict = QueryRun(**{"type": "query", "params": {"sql": "SELECT 1"}})
        assert run_from_dict.type == RunType.QUERY

        # Both should be equivalent
        assert run_with_enum.type == run_from_dict.type
        assert run_with_enum.params == run_from_dict.params


class TestRecceStateWithDiscriminatedUnion:
    """Test RecceState integration with discriminated union Run objects"""

    def test_recce_state_deserialization_with_discriminated_union_runs(self):
        """Test RecceState can correctly deserialize different Run types from dict using discriminated union"""
        state_dict = {
            "runs": [
                {
                    "type": "query",
                    "name": "customer_query",
                    "params": {"sql_template": 'select * from {{ ref("customers") }}'},
                    "status": "finished",
                    "result": {
                        "columns": [
                            {"name": "customer_id", "type": "integer"},
                            {"name": "name", "type": "text"},
                            {"name": "age", "type": "integer"},
                        ],
                        "data": [[1, "Alice", 30], [2, "Bob", 25], [3, "Charlie", 35]],
                        "limit": None,
                        "more": False,
                    },
                },
                {
                    "type": "profile",
                    "name": "customers_profile",
                    "params": {"model": "customers"},
                    "status": "finished",
                    "result": {
                        "current": {
                            "columns": [
                                {"name": "column_name", "type": "text"},
                                {"name": "data_type", "type": "text"},
                                {"name": "row_count", "type": "integer"},
                                {"name": "null_count", "type": "integer"},
                                {"name": "null_percentage", "type": "number"},
                            ],
                            "data": [
                                ["customer_id", "integer", 3, 0, 0.0],
                                ["name", "text", 3, 0, 0.0],
                                ["age", "integer", 3, 0, 0.0],
                            ],
                            "limit": None,
                            "more": False,
                        }
                    },
                },
                {
                    "type": "row_count_diff",
                    "name": "customers_row_count",
                    "params": {"node_names": ["customers"]},
                    "status": "finished",
                    "result": {"customers": {"base": 2, "curr": 3}},
                },
            ],
            "checks": [],
        }

        # Test RecceState deserialization from dict (simulates JSON loading)
        state = RecceState(**state_dict)

        # Verify correct number of runs
        assert len(state.runs) == 3

        # Test that discriminated union correctly created appropriate Run subclasses
        query_run = state.runs[0]
        assert isinstance(query_run, QueryRun)
        assert query_run.type == RunType.QUERY
        assert query_run.name == "customer_query"
        assert query_run.params == {"sql_template": 'select * from {{ ref("customers") }}'}
        assert query_run.status == RunStatus.FINISHED
        # Verify result data is preserved
        assert query_run.result is not None
        assert len(query_run.result.columns) == 3
        assert query_run.result.columns[0].name == "customer_id"
        assert query_run.result.columns[0].type.value == "integer"
        assert len(query_run.result.data) == 3
        assert query_run.result.data[0] == [1, "Alice", 30]

        profile_run = state.runs[1]
        assert isinstance(profile_run, ProfileRun)
        assert profile_run.type == RunType.PROFILE
        assert profile_run.name == "customers_profile"
        assert profile_run.params == {"model": "customers"}
        assert profile_run.status == RunStatus.FINISHED
        # Verify result data is preserved
        assert profile_run.result is not None
        assert profile_run.result.current is not None
        assert len(profile_run.result.current.columns) == 5
        assert profile_run.result.current.columns[0].name == "column_name"
        assert len(profile_run.result.current.data) == 3

        generic_run = state.runs[2]
        assert isinstance(generic_run, GenericRun)
        assert generic_run.type == RunType.ROW_COUNT_DIFF
        assert generic_run.name == "customers_row_count"
        assert generic_run.params == {"node_names": ["customers"]}
        assert generic_run.status == RunStatus.FINISHED
        # Verify result data is preserved (matching RowCountDiffTask output structure)
        assert generic_run.result is not None
        assert isinstance(generic_run.result, dict)
        assert "customers" in generic_run.result
        customers_result = generic_run.result.get("customers", {})
        assert customers_result.get("base") == 2
        assert customers_result.get("curr") == 3

    def test_recce_state_roundtrip_serialization_with_runs(self):
        """Test RecceState serialization and deserialization roundtrip preserves Run types"""
        # Create RecceState with different Run types
        original_runs = [
            create_run_instance(type=RunType.QUERY, params={"sql": "SELECT 1"}),
            create_run_instance(type=RunType.PROFILE, params={"columns": ["id"]}),
            create_run_instance(type=RunType.ROW_COUNT_DIFF, params={"model": "test"}),
        ]
        original_state = RecceState(runs=original_runs)

        # Serialize to JSON string
        json_str = original_state.to_json()
        assert isinstance(json_str, str)

        # Deserialize back from JSON
        restored_state = RecceState.from_json(json_str)

        # Verify runs are correctly restored with proper types
        assert len(restored_state.runs) == 3

        # Check each run type is preserved
        assert isinstance(restored_state.runs[0], QueryRun)
        assert restored_state.runs[0].type == RunType.QUERY
        assert restored_state.runs[0].params == {"sql": "SELECT 1"}

        assert isinstance(restored_state.runs[1], ProfileRun)
        assert restored_state.runs[1].type == RunType.PROFILE
        assert restored_state.runs[1].params == {"columns": ["id"]}

        assert isinstance(restored_state.runs[2], GenericRun)
        assert restored_state.runs[2].type == RunType.ROW_COUNT_DIFF
        assert restored_state.runs[2].params == {"model": "test"}
