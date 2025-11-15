"""
Test suite for DataFrame and DataFrameColumn models.
"""

from recce.state import RecceState


class TestDataFrameColumn:
    """Test DataFrameColumn model functionality."""

    def test_dataframe_column_key_auto_setting_in_results(self):
        """Test that DataFrameColumn auto-sets keys in Run results during deserialization"""
        state_dict = {
            "runs": [
                {
                    "type": "query",
                    "name": "test_dataframe_columns",
                    "params": {"sql": "SELECT id, name FROM users"},
                    "status": "finished",
                    "result": {
                        "columns": [
                            # Test: column without key should auto-set key=name
                            {"name": "user_id", "type": "integer"},
                            # Test: column with explicit key should preserve it
                            {"key": "full_name", "name": "name", "type": "text"},
                            # Test: column with null key should auto-set key=name
                            {"key": None, "name": "email", "type": "text"},
                        ],
                        "data": [[1, "Alice", "alice@example.com"], [2, "Bob", "bob@example.com"]],
                        "limit": None,
                        "more": False,
                    },
                }
            ],
            "checks": [],
        }

        # Test RecceState deserialization with DataFrameColumn key behavior
        state = RecceState(**state_dict)

        query_run = state.runs[0]
        result_columns = query_run.result.columns

        # Test auto-set key from name (missing key)
        assert result_columns[0].key == "user_id"
        assert result_columns[0].name == "user_id"
        assert result_columns[0].type.value == "integer"

        # Test preserved explicit key (different from name)
        assert result_columns[1].key == "full_name"
        assert result_columns[1].name == "name"
        assert result_columns[1].type.value == "text"

        # Test auto-set key from name (null key)
        assert result_columns[2].key == "email"
        assert result_columns[2].name == "email"
        assert result_columns[2].type.value == "text"
