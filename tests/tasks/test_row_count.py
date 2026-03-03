import pytest

from recce.tasks import RowCountDiffTask
from recce.tasks.rowcount import (
    RowCountDiffResultDiffer,
    RowCountStatus,
    RowCountTask,
    _make_row_count_result,
    _split_row_count_result,
)


def test_row_count(dbt_test_helper):
    csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    csv_data_base = """
        customer_id,name,age
        1,Alice,35
        2,Bob,25
        """

    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr, unique_id="model.customers")
    task = RowCountDiffTask(dict(node_names=["customers"]))
    run_result = task.execute()

    # Verify backward-compatible format: base/curr are int, metadata in *_meta
    assert run_result["customers"]["base"] == 2
    assert run_result["customers"]["curr"] == 3
    assert run_result["customers"]["base_meta"]["status"] == RowCountStatus.OK
    assert run_result["customers"]["curr_meta"]["status"] == RowCountStatus.OK

    # Test non-existent model - should return not_in_manifest status
    task = RowCountDiffTask(dict(node_names=["customers_"]))
    run_result = task.execute()
    assert run_result["customers_"]["base"] is None
    assert run_result["customers_"]["curr"] is None
    assert run_result["customers_"]["base_meta"]["status"] == RowCountStatus.NOT_IN_MANIFEST
    assert run_result["customers_"]["curr_meta"]["status"] == RowCountStatus.NOT_IN_MANIFEST
    # Verify message is present for non-ok status
    assert "message" in run_result["customers_"]["base_meta"]

    task = RowCountDiffTask(dict(node_ids=["model.customers"]))
    run_result = task.execute()
    assert run_result["customers"]["base"] == 2
    assert run_result["customers"]["curr"] == 3


def test_row_count_with_selector(dbt_test_helper):
    csv_data_1 = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    csv_data_2 = """
        customer_id,name,age
        1,Alice,35
        2,Bob,25
        """

    dbt_test_helper.create_model("model_1", csv_data_1, csv_data_2, depends_on=[])
    dbt_test_helper.create_model("model_2", csv_data_1, csv_data_1, depends_on=["model_1"])
    task = RowCountDiffTask(dict(select="model_1"))
    run_result = task.execute()
    assert len(run_result) == 1

    task = RowCountDiffTask(dict(select="model_1+"))
    run_result = task.execute()
    assert len(run_result) == 2


def test_validator():
    from recce.tasks.rowcount import RowCountDiffCheckValidator

    validator = RowCountDiffCheckValidator()

    def validate(params: dict):
        validator.validate(
            {
                "name": "test",
                "type": "row_count_diff",
                "params": params,
            }
        )

    # Select all modesl
    validate({})

    # Select by node name
    validate(
        {
            "node_names": ["abc"],
        }
    )
    with pytest.raises(ValueError):
        validate(
            {
                "node_names": "abc",
            }
        )

    # Select by node id
    validate(
        {
            "node_ids": ["model.abc"],
        }
    )

    # Select by selector
    validate(
        {
            "select": "customers",
            "exclude": "customers",
            "packages": ["jaffle_shop"],
            "view_mode": "all",
        }
    )

    # packages should be an array
    with pytest.raises(ValueError):
        validate(
            {
                "packages": "jaffle_shop",
            }
        )

    # view_mode should be 'all' or 'changed_models'
    validate(
        {
            "view_mode": None,
        }
    )
    validate(
        {
            "view_mode": "all",
        }
    )
    with pytest.raises(ValueError):
        validate(
            {
                "view_mode": "abc",
            }
        )


def test_make_row_count_result():
    """Test the _make_row_count_result helper function."""
    # Test with count and default status
    result = _make_row_count_result(count=100)
    assert result["count"] == 100
    assert result["status"] == RowCountStatus.OK
    assert "message" not in result

    # Test with count=None and custom status
    result = _make_row_count_result(count=None, status=RowCountStatus.NOT_IN_MANIFEST)
    assert result["count"] is None
    assert result["status"] == RowCountStatus.NOT_IN_MANIFEST
    assert "message" not in result

    # Test with message
    result = _make_row_count_result(
        count=None,
        status=RowCountStatus.TABLE_NOT_FOUND,
        message="Table not found in database",
    )
    assert result["count"] is None
    assert result["status"] == RowCountStatus.TABLE_NOT_FOUND
    assert result["message"] == "Table not found in database"


def test_row_count_status_values():
    """Test that RowCountStatus has expected values."""
    assert RowCountStatus.OK == "ok"
    assert RowCountStatus.NOT_IN_MANIFEST == "not_in_manifest"
    assert RowCountStatus.UNSUPPORTED_RESOURCE_TYPE == "unsupported_resource_type"
    assert RowCountStatus.UNSUPPORTED_MATERIALIZATION == "unsupported_materialization"
    assert RowCountStatus.TABLE_NOT_FOUND == "table_not_found"
    assert RowCountStatus.PERMISSION_DENIED == "permission_denied"


def test_row_count_diff_result_differ_meta_format():
    """Test RowCountDiffResultDiffer with the current _meta format."""
    from unittest.mock import MagicMock

    mock_run = MagicMock()
    mock_run.params = {"node_names": ["model_a"]}
    mock_run.result = {
        "model_a": {
            "base": 100,
            "curr": 200,
            "base_meta": {"status": RowCountStatus.OK},
            "curr_meta": {"status": RowCountStatus.OK},
        }
    }

    differ = RowCountDiffResultDiffer(mock_run)
    assert differ.changes is not None  # There are changes (100 -> 200)


def test_row_count_diff_result_differ_without_meta():
    """Test RowCountDiffResultDiffer with base/curr as plain integers (no _meta fields)."""
    from unittest.mock import MagicMock

    mock_run = MagicMock()
    mock_run.params = {"node_names": ["model_a"]}
    mock_run.result = {
        "model_a": {
            "base": 100,
            "curr": 200,
        }
    }

    differ = RowCountDiffResultDiffer(mock_run)
    assert differ.changes is not None  # There are changes (100 -> 200)


def test_row_count_diff_result_differ_with_none_counts():
    """Test RowCountDiffResultDiffer handles None counts (e.g., table not found)."""
    from unittest.mock import MagicMock

    mock_run = MagicMock()
    mock_run.params = {"node_names": ["model_a"]}
    mock_run.result = {
        "model_a": {
            "base": None,
            "curr": 200,
            "base_meta": {"status": RowCountStatus.TABLE_NOT_FOUND},
            "curr_meta": {"status": RowCountStatus.OK},
        }
    }

    differ = RowCountDiffResultDiffer(mock_run)
    # Should handle None -> 200 as a change
    assert differ.changes is not None


def test_row_count_diff_result_differ_additive_meta_with_none():
    """Test RowCountDiffResultDiffer with new additive _meta format and None counts.

    This is the actual format produced by _split_row_count_result():
    base/curr are int|None, *_meta are separate dicts. The differ must
    ignore *_meta fields and only use base/curr for comparison.
    """
    from unittest.mock import MagicMock, patch

    mock_ctx = MagicMock()
    mock_ctx.adapter.get_node_by_name.return_value = MagicMock(unique_id="model.proj.model_a")

    with patch("recce.tasks.core.default_context", return_value=mock_ctx):
        mock_run = MagicMock()
        mock_run.params = {"node_names": ["model_a", "model_b"]}
        mock_run.result = {
            "model_a": {
                "base": None,
                "curr": 200,
                "base_meta": {"status": RowCountStatus.TABLE_NOT_FOUND, "message": "Table not found"},
                "curr_meta": {"status": RowCountStatus.OK},
            },
            "model_b": {
                "base": 500,
                "curr": 500,
                "base_meta": {"status": RowCountStatus.OK},
                "curr_meta": {"status": RowCountStatus.OK},
            },
        }

        differ = RowCountDiffResultDiffer(mock_run)
        # model_a: None -> 200 is a change; model_b: 500 -> 500 is not
        assert differ.changes is not None
        assert "model_a" in list(differ.changes.affected_root_keys)


def test_row_count_task(dbt_test_helper):
    """Test RowCountTask (current environment only, no diff)."""
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    dbt_test_helper.create_model("customers", csv_data, csv_data, unique_id="model.customers")

    # Test with node_names
    task = RowCountTask(dict(node_names=["customers"]))
    run_result = task.execute()

    # Verify backward-compatible format: curr is int, metadata in curr_meta
    assert "customers" in run_result
    assert run_result["customers"]["curr"] == 3
    assert run_result["customers"]["curr_meta"]["status"] == RowCountStatus.OK

    # Test with non-existent model
    task = RowCountTask(dict(node_names=["nonexistent_model"]))
    run_result = task.execute()
    assert run_result["nonexistent_model"]["curr"] is None
    assert run_result["nonexistent_model"]["curr_meta"]["status"] == RowCountStatus.NOT_IN_MANIFEST
    assert "message" in run_result["nonexistent_model"]["curr_meta"]

    # Test with node_ids
    task = RowCountTask(dict(node_ids=["model.customers"]))
    run_result = task.execute()
    assert run_result["customers"]["curr"] == 3
    assert run_result["customers"]["curr_meta"]["status"] == RowCountStatus.OK


def test_query_row_count_unsupported_resource_type():
    """Test _query_row_count result format for unsupported resource type (e.g., source)."""
    # Create a mock result for unsupported resource type
    result = _make_row_count_result(
        status=RowCountStatus.UNSUPPORTED_RESOURCE_TYPE,
        message="Resource type 'source' does not support row counts",
    )

    assert result["status"] == RowCountStatus.UNSUPPORTED_RESOURCE_TYPE
    assert result["count"] is None
    assert "source" in result["message"]


def test_query_row_count_unsupported_materialization():
    """Test _query_row_count result format for unsupported materialization (e.g., ephemeral)."""
    # Create a mock result for unsupported materialization
    result = _make_row_count_result(
        status=RowCountStatus.UNSUPPORTED_MATERIALIZATION,
        message="Materialization 'ephemeral' does not support row counts",
    )

    assert result["status"] == RowCountStatus.UNSUPPORTED_MATERIALIZATION
    assert result["count"] is None
    assert "ephemeral" in result["message"]


def test_query_row_count_table_not_found():
    """Test _query_row_count when table doesn't exist in database."""
    # Simulate the TABLE_NOT_FOUND status result
    result = _make_row_count_result(
        status=RowCountStatus.TABLE_NOT_FOUND,
        message="Table 'SCHEMA.model' not found in base database. "
        "The model is defined in the dbt manifest but the table doesn't exist. "
        "This may indicate stale dbt artifacts or an environment configuration issue.",
    )

    assert result["status"] == RowCountStatus.TABLE_NOT_FOUND
    assert result["count"] is None
    assert "stale dbt artifacts" in result["message"]
    assert "environment configuration" in result["message"]


def test_query_row_count_permission_denied():
    """Test _query_row_count result format for permission denied errors."""
    # Create a mock result for permission denied
    result = _make_row_count_result(
        status=RowCountStatus.PERMISSION_DENIED,
        message="Permission denied when accessing 'SCHEMA.model' in base database. "
        "The table may exist but the current user lacks permission to query it.",
    )

    assert result["status"] == RowCountStatus.PERMISSION_DENIED
    assert result["count"] is None
    assert "Permission denied" in result["message"]
    assert "lacks permission" in result["message"]


def test_row_count_diff_result_differ_get_related_node_ids():
    """Test RowCountDiffResultDiffer._get_related_node_ids with different params."""
    from unittest.mock import MagicMock

    # Test with model param
    mock_run = MagicMock()
    mock_run.params = {"model": "model_a"}
    mock_run.result = {"model_a": {"base": {"count": 100, "status": "ok"}, "curr": {"count": 100, "status": "ok"}}}

    differ = RowCountDiffResultDiffer(mock_run)
    assert differ.related_node_ids is not None

    # Test with node_names param
    mock_run.params = {"node_names": ["model_a", "model_b"]}
    differ = RowCountDiffResultDiffer(mock_run)
    assert differ.related_node_ids is not None

    # Test with node_ids param
    mock_run.params = {"node_ids": ["model.project.model_a"]}
    differ = RowCountDiffResultDiffer(mock_run)
    assert differ.related_node_ids is not None


def test_row_count_diff_result_differ_get_changed_nodes():
    """Test RowCountDiffResultDiffer._get_changed_nodes."""
    from unittest.mock import MagicMock

    # Test with changes
    mock_run = MagicMock()
    mock_run.params = {"node_names": ["model_a"]}
    mock_run.result = {
        "model_a": {
            "base": {"count": 100, "status": RowCountStatus.OK},
            "curr": {"count": 200, "status": RowCountStatus.OK},
        }
    }

    differ = RowCountDiffResultDiffer(mock_run)
    changed_nodes = differ.changed_nodes
    assert changed_nodes is not None
    assert "model_a" in changed_nodes

    # Test without changes
    mock_run.result = {
        "model_a": {
            "base": {"count": 100, "status": RowCountStatus.OK},
            "curr": {"count": 100, "status": RowCountStatus.OK},
        }
    }
    differ = RowCountDiffResultDiffer(mock_run)
    # No changes means changed_nodes should be None or empty
    assert differ.changed_nodes is None or len(differ.changed_nodes) == 0


def test_split_row_count_result():
    """Test _split_row_count_result bridges internal dict to backward-compatible output."""
    # OK result
    result = _make_row_count_result(count=42, status=RowCountStatus.OK)
    count, meta = _split_row_count_result(result)
    assert count == 42
    assert meta == {"status": RowCountStatus.OK}

    # Error result with message
    result = _make_row_count_result(
        count=None,
        status=RowCountStatus.TABLE_NOT_FOUND,
        message="Table not found",
    )
    count, meta = _split_row_count_result(result)
    assert count is None
    assert meta["status"] == RowCountStatus.TABLE_NOT_FOUND
    assert meta["message"] == "Table not found"
    assert "count" not in meta  # count must be stripped from meta
