"""Tests for sqlmesh rowcount error classification (DRC-2754)."""

from unittest.mock import MagicMock, patch

import pytest

from recce.tasks.rowcount import RowCountDiffTask, RowCountStatus


@pytest.fixture
def sqlmesh_task():
    """Create a RowCountDiffTask configured for a single node."""
    task = RowCountDiffTask(params={"node_ids": ["test_model"]})
    return task


class TestSqlmeshErrorClassification:
    """Test that execute_sqlmesh classifies errors correctly (mirrors dbt path)."""

    @patch("recce.tasks.rowcount.default_context")
    def test_table_not_found(self, mock_ctx, sqlmesh_task):
        mock_adapter = MagicMock()
        mock_ctx.return_value.adapter = mock_adapter
        mock_ctx.return_value.adapter_type = "sqlmesh"

        import pandas as pd

        mock_adapter.fetchdf_with_limit.side_effect = [
            (pd.DataFrame([[100]]), None),  # base succeeds
            Exception("Object 'MY_TABLE' does not exist"),  # current fails
        ]

        result = sqlmesh_task.execute_sqlmesh()
        assert result["test_model"]["curr"] is None
        assert result["test_model"]["curr_meta"]["status"] == RowCountStatus.TABLE_NOT_FOUND

    @patch("recce.tasks.rowcount.default_context")
    def test_permission_denied(self, mock_ctx, sqlmesh_task):
        mock_adapter = MagicMock()
        mock_ctx.return_value.adapter = mock_adapter
        mock_ctx.return_value.adapter_type = "sqlmesh"

        import pandas as pd

        mock_adapter.fetchdf_with_limit.side_effect = [
            Exception("Insufficient privileges to operate on table"),  # base fails
            (pd.DataFrame([[50]]), None),  # current succeeds
        ]

        result = sqlmesh_task.execute_sqlmesh()
        assert result["test_model"]["base"] is None
        assert result["test_model"]["base_meta"]["status"] == RowCountStatus.PERMISSION_DENIED

    @patch("recce.tasks.rowcount.default_context")
    def test_unknown_error_reraises(self, mock_ctx, sqlmesh_task):
        mock_adapter = MagicMock()
        mock_ctx.return_value.adapter = mock_adapter
        mock_ctx.return_value.adapter_type = "sqlmesh"

        mock_adapter.fetchdf_with_limit.side_effect = [
            Exception("Connection refused"),  # base fails with unknown error
        ]

        with pytest.raises(Exception, match="Connection refused"):
            sqlmesh_task.execute_sqlmesh()
