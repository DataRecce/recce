# ABOUTME: Unit tests for BauplanAdapter with mocked bauplan client.
# ABOUTME: Tests load, lineage parsing, and data fetching functionality.
import json
import sys
import tempfile
from unittest.mock import MagicMock

import pandas as pd

from recce.adapter.bauplan_adapter import BauplanAdapter


def _mock_bauplan_module():
    """Insert a fake bauplan module into sys.modules so 'import bauplan' succeeds."""
    mock_module = MagicMock()
    sys.modules["bauplan"] = mock_module
    return mock_module


def test_bauplan_adapter_load_parses_refs():
    lineage = {"nodes": {}, "sources": {}, "parent_map": {}}
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(lineage, f)
        lineage_path = f.name

    _mock_bauplan_module()
    try:
        adapter = BauplanAdapter.load(
            bauplan_refs="main:user.dev",
            bauplan_lineage=lineage_path,
        )
    finally:
        sys.modules.pop("bauplan", None)

    assert adapter.base_ref == "main"
    assert adapter.curr_ref == "user.dev"
    assert adapter.lineage_data == lineage


def test_bauplan_adapter_get_lineage():
    lineage = {
        "nodes": {
            "model.proj.stg_users": {
                "name": "stg_users",
                "resource_type": "model",
                "checksum": "abc123",
                "columns": {
                    "user_id": {"type": "int64"},
                    "name": {"type": "string"},
                },
            }
        },
        "sources": {
            "source.proj.raw_users": {
                "name": "raw_users",
                "resource_type": "source",
                "columns": {"user_id": {"type": "int64"}},
            }
        },
        "parent_map": {"model.proj.stg_users": ["source.proj.raw_users"]},
    }
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(lineage, f)
        lineage_path = f.name

    _mock_bauplan_module()
    try:
        adapter = BauplanAdapter.load(
            bauplan_refs="main:user.dev",
            bauplan_lineage=lineage_path,
        )
    finally:
        sys.modules.pop("bauplan", None)

    result = adapter.get_lineage(base=False)
    assert "model.proj.stg_users" in result["nodes"]
    assert "source.proj.raw_users" in result["nodes"]
    assert result["nodes"]["model.proj.stg_users"]["checksum"]["checksum"] == "abc123"
    assert result["parent_map"]["model.proj.stg_users"] == ["source.proj.raw_users"]


def test_bauplan_adapter_fetchdf_with_limit():
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.to_pandas.return_value = pd.DataFrame({"id": [1, 2, 3]})
    mock_client.query.return_value = mock_result

    adapter = BauplanAdapter(
        client=mock_client,
        base_ref="main",
        curr_ref="user.dev",
        lineage_data={},
    )

    df, more = adapter.fetchdf_with_limit("SELECT * FROM t", base=True, limit=10)
    assert len(df) == 3
    assert not more
    mock_client.query.assert_called_once()
    call_kwargs = mock_client.query.call_args
    assert call_kwargs.kwargs["ref"] == "main"


def test_bauplan_adapter_fetchdf_with_limit_truncates():
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.to_pandas.return_value = pd.DataFrame({"id": list(range(4))})
    mock_client.query.return_value = mock_result

    adapter = BauplanAdapter(
        client=mock_client,
        base_ref="main",
        curr_ref="user.dev",
        lineage_data={},
    )

    df, more = adapter.fetchdf_with_limit("SELECT * FROM t", base=False, limit=3)
    assert len(df) == 3
    assert more
    call_kwargs = mock_client.query.call_args
    assert call_kwargs.kwargs["ref"] == "user.dev"


def test_bauplan_adapter_get_model():
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        lineage_data={
            "nodes": {
                "model.proj.users": {
                    "name": "users",
                    "columns": {"id": {"type": "int64"}, "name": {"type": "string"}},
                }
            },
            "sources": {},
        },
    )
    model = adapter.get_model("model.proj.users")
    assert model is not None
    assert "id" in model["columns"]
    assert model["columns"]["id"]["type"] == "int64"

    assert adapter.get_model("nonexistent") is None


def test_bauplan_adapter_get_node_name_by_id():
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        lineage_data={
            "nodes": {"model.proj.users": {"name": "users"}},
            "sources": {},
        },
    )
    assert adapter.get_node_name_by_id("model.proj.users") == "users"
    assert adapter.get_node_name_by_id("nonexistent") is None


def test_bauplan_adapter_select_nodes():
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        lineage_data={
            "nodes": {
                "model.proj.users": {"name": "users"},
                "model.proj.orders": {"name": "orders"},
            },
            "sources": {},
        },
    )
    nodes = adapter.select_nodes()
    assert nodes == {"model.proj.users", "model.proj.orders"}


def test_bauplan_adapter_support_tasks():
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        lineage_data={},
    )
    support = adapter.support_tasks()
    assert support["query"] is True
    assert support["query_diff"] is True
    assert support["row_count_diff"] is True
    assert support["change_analysis"] is False


def test_bauplan_adapter_row_count_diff():
    """Test row count queries through both branches."""
    mock_client = MagicMock()

    def mock_query(query, ref):
        result = MagicMock()
        if ref == "main":
            result.to_pandas.return_value = pd.DataFrame({"count": [100]})
        else:
            result.to_pandas.return_value = pd.DataFrame({"count": [70]})
        return result

    mock_client.query.side_effect = mock_query

    adapter = BauplanAdapter(
        client=mock_client,
        base_ref="main",
        curr_ref="user.dev",
        lineage_data={
            "nodes": {"model.proj.stg_users": {"name": "stg_users", "resource_type": "model", "columns": {}}},
            "sources": {},
            "parent_map": {},
        },
    )

    df_base, _ = adapter.fetchdf_with_limit("SELECT COUNT(*) as count FROM stg_users", base=True)
    df_curr, _ = adapter.fetchdf_with_limit("SELECT COUNT(*) as count FROM stg_users", base=False)

    assert int(df_base.iloc[0]["count"]) == 100
    assert int(df_curr.iloc[0]["count"]) == 70


def test_bauplan_adapter_load_missing_refs():
    """Test that load raises when --bauplan-refs is missing."""
    import pytest

    with pytest.raises(Exception, match="--bauplan-refs"):
        BauplanAdapter.load()


def test_bauplan_adapter_load_invalid_refs_format():
    """Test that load raises when refs format is wrong."""
    import pytest

    with pytest.raises(Exception, match="BASE:CURRENT"):
        BauplanAdapter.load(bauplan_refs="just_one_ref")


def test_bauplan_adapter_fetchdf_no_limit():
    """Test fetchdf_with_limit without limit parameter."""
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.to_pandas.return_value = pd.DataFrame({"id": [1, 2, 3]})
    mock_client.query.return_value = mock_result

    adapter = BauplanAdapter(
        client=mock_client,
        base_ref="main",
        curr_ref="user.dev",
        lineage_data={},
    )

    df, more = adapter.fetchdf_with_limit("SELECT * FROM t", base=False)
    assert len(df) == 3
    assert not more
    # Should NOT wrap in LIMIT subquery
    call_kwargs = mock_client.query.call_args
    assert "LIMIT" not in call_kwargs.kwargs["query"]
