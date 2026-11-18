"""Tests for sqlmesh rowcount error classification (DRC-2754)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from recce.exceptions import RecceException
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
        mock_adapter.context.models = {"test_model": MagicMock(**{"name": "test_model"})}

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
        mock_adapter.context.models = {"test_model": MagicMock(**{"name": "test_model"})}

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
        mock_adapter.context.models = {"test_model": MagicMock(**{"name": "test_model"})}

        mock_adapter.fetchdf_with_limit.side_effect = [
            Exception("Connection refused"),  # base fails with unknown error
        ]

        with pytest.raises(Exception, match="Connection refused"):
            sqlmesh_task.execute_sqlmesh()


class TestSqlmeshAllowlistIncludesEnvironmentSnapshots:
    """DRC-5336 review: lineage node ids come from each environment's snapshots
    (SqlmeshAdapter.get_lineage), so a model removed or renamed in the current change
    exists only in the base environment's snapshots, not in context.models. It must
    still be allowed, and must keep the pre-allowlist behavior (base count plus
    TABLE_NOT_FOUND for current) instead of aborting the whole run."""

    @staticmethod
    def _adapter(base_snapshot_names, curr_snapshot_names):
        adapter = MagicMock()
        adapter.context.models = {"current_model": MagicMock(**{"name": "current_model"})}
        adapter.base_env.snapshots = [SimpleNamespace(name=n) for n in base_snapshot_names]
        adapter.curr_env.snapshots = [SimpleNamespace(name=n) for n in curr_snapshot_names]
        return adapter

    @patch("recce.tasks.rowcount.default_context")
    def test_base_only_model_is_queried(self, mock_ctx):
        import pandas as pd

        adapter = self._adapter(["current_model", "removed_model"], ["current_model"])
        mock_ctx.return_value.adapter = adapter
        adapter.fetchdf_with_limit.side_effect = [
            (pd.DataFrame([[7]]), None),  # base: removed_model still exists
            Exception("Table removed_model does not exist"),  # current: gone
        ]

        result = RowCountDiffTask(params={"node_ids": ["removed_model"]}).execute_sqlmesh()

        assert adapter.fetchdf_with_limit.call_count == 2
        assert result["removed_model"]["base"] == 7
        assert result["removed_model"]["curr"] is None
        assert result["removed_model"]["curr_meta"]["status"] == RowCountStatus.TABLE_NOT_FOUND

    @patch("recce.tasks.rowcount.default_context")
    def test_current_env_snapshot_is_allowed(self, mock_ctx):
        import pandas as pd

        adapter = self._adapter([], ["env_only_model"])
        mock_ctx.return_value.adapter = adapter
        adapter.fetchdf_with_limit.side_effect = [
            (pd.DataFrame([[1]]), None),
            (pd.DataFrame([[2]]), None),
        ]

        result = RowCountDiffTask(params={"node_names": ["env_only_model"]}).execute_sqlmesh()

        assert result["env_only_model"]["base"] == 1
        assert result["env_only_model"]["curr"] == 2

    @patch("recce.tasks.rowcount.default_context")
    def test_name_absent_from_both_envs_is_rejected(self, mock_ctx):
        hostile = "removed_model; drop table y"
        adapter = self._adapter(["current_model", "removed_model"], ["current_model"])
        mock_ctx.return_value.adapter = adapter

        with pytest.raises(RecceException, match="does not exist"):
            RowCountDiffTask(params={"node_ids": ["removed_model", hostile]}).execute_sqlmesh()

        adapter.fetchdf_with_limit.assert_not_called()
