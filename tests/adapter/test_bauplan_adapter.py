# ABOUTME: Unit tests for BauplanAdapter with mocked bauplan client.
# ABOUTME: Tests load, lineage parsing, and data fetching functionality.
import json
import sys
import tempfile
from unittest.mock import MagicMock

import pandas as pd
import pytest

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
    assert adapter.base_lineage == lineage
    assert adapter.curr_lineage == lineage


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
        base_lineage={},
        curr_lineage={},
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
        base_lineage={},
        curr_lineage={},
    )

    df, more = adapter.fetchdf_with_limit("SELECT * FROM t", base=False, limit=3)
    assert len(df) == 3
    assert more
    call_kwargs = mock_client.query.call_args
    assert call_kwargs.kwargs["ref"] == "user.dev"


def test_bauplan_adapter_get_model():
    lineage = {
        "nodes": {
            "model.proj.users": {
                "name": "users",
                "columns": {"id": {"type": "int64"}, "name": {"type": "string"}},
            }
        },
        "sources": {},
    }
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        base_lineage=lineage,
        curr_lineage=lineage,
    )
    model = adapter.get_model("model.proj.users")
    assert model is not None
    assert "id" in model["columns"]
    assert model["columns"]["id"]["type"] == "int64"

    assert adapter.get_model("nonexistent") is None


def test_bauplan_adapter_get_node_name_by_id():
    lineage = {
        "nodes": {"model.proj.users": {"name": "users"}},
        "sources": {},
    }
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        base_lineage=lineage,
        curr_lineage=lineage,
    )
    assert adapter.get_node_name_by_id("model.proj.users") == "users"
    assert adapter.get_node_name_by_id("nonexistent") is None


def test_bauplan_adapter_select_nodes():
    lineage = {
        "nodes": {
            "model.proj.users": {"name": "users"},
            "model.proj.orders": {"name": "orders"},
        },
        "sources": {},
    }
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        base_lineage=lineage,
        curr_lineage=lineage,
    )
    nodes = adapter.select_nodes()
    assert nodes == {"model.proj.users", "model.proj.orders"}


def test_bauplan_adapter_support_tasks():
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        base_lineage={},
        curr_lineage={},
    )
    support = adapter.support_tasks()
    assert support["query"] is True
    assert support["query_diff"] is True
    assert support["row_count_diff"] is True
    assert support["change_analysis"] is True


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

    lineage = {
        "nodes": {"model.proj.stg_users": {"name": "stg_users", "resource_type": "model", "columns": {}}},
        "sources": {},
        "parent_map": {},
    }
    adapter = BauplanAdapter(
        client=mock_client,
        base_ref="main",
        curr_ref="user.dev",
        base_lineage=lineage,
        curr_lineage=lineage,
    )

    df_base, _ = adapter.fetchdf_with_limit("SELECT COUNT(*) as count FROM stg_users", base=True)
    df_curr, _ = adapter.fetchdf_with_limit("SELECT COUNT(*) as count FROM stg_users", base=False)

    assert int(df_base.iloc[0]["count"]) == 100
    assert int(df_curr.iloc[0]["count"]) == 70


def test_bauplan_adapter_load_missing_refs():
    """Test that load raises when --bauplan-refs is missing."""
    with pytest.raises(Exception, match="--bauplan-refs"):
        BauplanAdapter.load()


def test_bauplan_adapter_load_invalid_refs_format():
    """Test that load raises when refs format is wrong."""
    with pytest.raises(Exception, match="BASE:CURRENT"):
        BauplanAdapter.load(bauplan_refs="just_one_ref")


def test_bauplan_adapter_get_cll_basic():
    """Test column-level lineage for a single node."""
    lineage = {
        "nodes": {
            "model.proj.features": {
                "name": "features",
                "resource_type": "model",
                "package_name": "proj",
                "checksum": "abc",
                "columns": {
                    "user_id": {
                        "transformation_type": "passthrough",
                        "depends_on": [{"node": "source.proj.raw", "column": "user_id"}],
                        "type": "int64",
                    },
                    "score": {
                        "transformation_type": "derived",
                        "depends_on": [
                            {"node": "source.proj.raw", "column": "likes"},
                            {"node": "source.proj.raw", "column": "comments"},
                        ],
                        "type": "float64",
                    },
                },
            }
        },
        "sources": {
            "source.proj.raw": {
                "name": "raw",
                "resource_type": "source",
                "columns": {
                    "user_id": {"type": "int64"},
                    "likes": {"type": "int64"},
                    "comments": {"type": "int64"},
                },
            }
        },
        "parent_map": {"model.proj.features": ["source.proj.raw"]},
    }

    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        base_lineage=lineage,
        curr_lineage=lineage,
    )

    cll = adapter.get_cll(node_id="model.proj.features")

    # Should have both nodes
    assert "model.proj.features" in cll.nodes
    assert "source.proj.raw" in cll.nodes

    # Should have columns with correct IDs
    assert "model.proj.features_user_id" in cll.columns
    assert "model.proj.features_score" in cll.columns
    assert "source.proj.raw_user_id" in cll.columns

    # Check column dependencies in parent_map
    features_user_id_parents = cll.parent_map.get("model.proj.features_user_id", set())
    assert "source.proj.raw_user_id" in features_user_id_parents

    features_score_parents = cll.parent_map.get("model.proj.features_score", set())
    assert "source.proj.raw_likes" in features_score_parents
    assert "source.proj.raw_comments" in features_score_parents

    # Check transformation types
    assert cll.columns["model.proj.features_user_id"].transformation_type == "passthrough"
    assert cll.columns["model.proj.features_score"].transformation_type == "derived"
    assert cll.columns["source.proj.raw_user_id"].transformation_type == "source"


def test_bauplan_adapter_get_cll_change_analysis():
    """Test column-level lineage with change analysis detecting modifications."""
    base_lineage = {
        "nodes": {
            "model.proj.features": {
                "name": "features",
                "resource_type": "model",
                "package_name": "proj",
                "checksum": "old_checksum",
                "columns": {
                    "user_id": {
                        "transformation_type": "passthrough",
                        "depends_on": [{"node": "source.proj.raw", "column": "user_id"}],
                        "type": "int64",
                    },
                },
            }
        },
        "sources": {
            "source.proj.raw": {
                "name": "raw",
                "resource_type": "source",
                "columns": {"user_id": {"type": "int64"}},
            }
        },
        "parent_map": {"model.proj.features": ["source.proj.raw"]},
    }
    curr_lineage = {
        "nodes": {
            "model.proj.features": {
                "name": "features",
                "resource_type": "model",
                "package_name": "proj",
                "checksum": "new_checksum",
                "columns": {
                    "user_id": {
                        "transformation_type": "passthrough",
                        "depends_on": [{"node": "source.proj.raw", "column": "user_id"}],
                        "type": "int64",
                    },
                    "new_col": {
                        "transformation_type": "derived",
                        "depends_on": [{"node": "source.proj.raw", "column": "user_id"}],
                        "type": "string",
                    },
                },
            }
        },
        "sources": {
            "source.proj.raw": {
                "name": "raw",
                "resource_type": "source",
                "columns": {"user_id": {"type": "int64"}},
            }
        },
        "parent_map": {"model.proj.features": ["source.proj.raw"]},
    }

    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        base_lineage=base_lineage,
        curr_lineage=curr_lineage,
    )

    cll = adapter.get_cll(change_analysis=True)

    # Node should be marked as modified
    features_node = cll.nodes["model.proj.features"]
    assert features_node.change_status == "modified"

    # new_col should be marked as added
    new_col = cll.columns["model.proj.features_new_col"]
    assert new_col.change_status == "added"


def test_bauplan_adapter_get_cll_column_filters_to_lineage_chain():
    """When column is specified, only columns in the dependency chain should be included."""
    lineage = {
        "nodes": {
            "model.proj.features": {
                "name": "features",
                "resource_type": "model",
                "package_name": "proj",
                "checksum": "abc",
                "columns": {
                    "user_id": {
                        "transformation_type": "passthrough",
                        "depends_on": [{"node": "source.proj.raw", "column": "user_id"}],
                        "type": "int64",
                    },
                    "score": {
                        "transformation_type": "derived",
                        "depends_on": [
                            {"node": "source.proj.raw", "column": "likes"},
                            {"node": "source.proj.raw", "column": "comments"},
                        ],
                        "type": "float64",
                    },
                },
            }
        },
        "sources": {
            "source.proj.raw": {
                "name": "raw",
                "resource_type": "source",
                "package_name": "proj",
                "columns": {
                    "user_id": {"type": "int64"},
                    "likes": {"type": "int64"},
                    "comments": {"type": "int64"},
                    "created_at": {"type": "timestamp"},
                    "country": {"type": "string"},
                },
            }
        },
        "parent_map": {"model.proj.features": ["source.proj.raw"]},
    }

    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        base_lineage=lineage,
        curr_lineage=lineage,
    )

    # Request CLL for a specific column: features.user_id
    cll = adapter.get_cll(node_id="model.proj.features", column="user_id")

    # Should include the target column
    assert "model.proj.features_user_id" in cll.columns

    # Should include the source column it depends on
    assert "source.proj.raw_user_id" in cll.columns

    # Should NOT include unrelated source columns
    assert "source.proj.raw_likes" not in cll.columns
    assert "source.proj.raw_comments" not in cll.columns
    assert "source.proj.raw_created_at" not in cll.columns
    assert "source.proj.raw_country" not in cll.columns

    # Should NOT include unrelated model columns
    assert "model.proj.features_score" not in cll.columns

    # Nodes should still be present (for rendering the graph)
    assert "model.proj.features" in cll.nodes
    assert "source.proj.raw" in cll.nodes

    # But the source node should only have the relevant column
    assert "user_id" in cll.nodes["source.proj.raw"].columns
    assert "likes" not in cll.nodes["source.proj.raw"].columns


def test_bauplan_adapter_support_tasks_includes_change_analysis():
    """Test that change_analysis is now True in support_tasks."""
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        base_lineage={},
        curr_lineage={},
    )
    support = adapter.support_tasks()
    assert support["change_analysis"] is True


def test_bauplan_adapter_top_k_diff():
    """Test top-k diff via execute_bauplan on TopKDiffTask."""
    from unittest.mock import patch

    from recce.tasks.top_k import TopKDiffTask

    mock_client = MagicMock()

    def mock_query(query, ref):
        result = MagicMock()
        if "group by" in query.lower():
            # Top-k category query (both branches get the same SQL)
            if ref == "main":
                result.to_pandas.return_value = pd.DataFrame(
                    {"category": ["active", "passive", "bot"], "c": [50, 30, 15]}
                )
            else:
                result.to_pandas.return_value = pd.DataFrame(
                    {"category": ["active", "passive", "bot"], "c": [60, 35, 20]}
                )
        else:
            # Row count + valids query
            if ref == "main":
                result.to_pandas.return_value = pd.DataFrame({"total": [100], "valids": [95]})
            else:
                result.to_pandas.return_value = pd.DataFrame({"total": [120], "valids": [110]})
        return result

    mock_client.query.side_effect = mock_query

    lineage = {
        "nodes": {
            "model.proj.segments": {
                "name": "segments",
                "resource_type": "model",
                "columns": {"segment": {"type": "string"}},
            }
        },
        "sources": {},
        "parent_map": {},
    }
    adapter = BauplanAdapter(
        client=mock_client,
        base_ref="main",
        curr_ref="dev",
        base_lineage=lineage,
        curr_lineage=lineage,
    )

    mock_context = MagicMock()
    mock_context.adapter = adapter
    mock_context.adapter_type = "bauplan"

    with patch("recce.tasks.top_k.default_context", return_value=mock_context):
        task = TopKDiffTask({"model": "segments", "column_name": "segment", "k": 3})
        result = task.execute()

    assert "base" in result
    assert "current" in result
    assert result["base"]["values"] == ["active", "passive", "bot"]
    assert result["base"]["counts"] == [50, 30, 15]
    assert result["current"]["counts"] == [60, 35, 20]
    assert result["base"]["total"] == 100
    assert result["current"]["total"] == 120


def test_bauplan_adapter_select_nodes_all_includes_sources():
    """Test that select_nodes with view_mode='all' includes source nodes."""
    base_lineage = {
        "nodes": {"model.proj.a": {"name": "a"}, "model.proj.b": {"name": "b"}},
        "sources": {"source.proj.raw": {"name": "raw"}},
        "parent_map": {"model.proj.a": ["source.proj.raw"]},
    }
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        base_lineage=base_lineage,
        curr_lineage=base_lineage,
    )
    nodes = adapter.select_nodes(view_mode="all")
    assert "source.proj.raw" in nodes
    assert "model.proj.a" in nodes
    assert "model.proj.b" in nodes


def test_bauplan_adapter_select_nodes_changed_models_includes_parents():
    """Test that select_nodes with view_mode='changed_models' includes upstream parents."""
    base_lineage = {
        "nodes": {
            "model.proj.a": {"name": "a", "checksum": "old"},
            "model.proj.b": {"name": "b", "checksum": "same"},
        },
        "sources": {"source.proj.raw": {"name": "raw"}},
        "parent_map": {
            "model.proj.a": ["source.proj.raw"],
            "model.proj.b": ["model.proj.a"],
        },
    }
    curr_lineage = {
        "nodes": {
            "model.proj.a": {"name": "a", "checksum": "new"},
            "model.proj.b": {"name": "b", "checksum": "same"},
        },
        "sources": {"source.proj.raw": {"name": "raw"}},
        "parent_map": {
            "model.proj.a": ["source.proj.raw"],
            "model.proj.b": ["model.proj.a"],
        },
    }
    adapter = BauplanAdapter(
        client=MagicMock(),
        base_ref="main",
        curr_ref="dev",
        base_lineage=base_lineage,
        curr_lineage=curr_lineage,
    )
    nodes = adapter.select_nodes(view_mode="changed_models")
    # model.proj.a is modified (checksum differs)
    assert "model.proj.a" in nodes
    # source.proj.raw is upstream parent of modified node
    assert "source.proj.raw" in nodes
    # model.proj.b is NOT modified (same checksum) and not a parent of modified
    assert "model.proj.b" not in nodes


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
        base_lineage={},
        curr_lineage={},
    )

    df, more = adapter.fetchdf_with_limit("SELECT * FROM t", base=False)
    assert len(df) == 3
    assert not more
    # Should NOT wrap in LIMIT subquery
    call_kwargs = mock_client.query.call_args
    assert "LIMIT" not in call_kwargs.kwargs["query"]
