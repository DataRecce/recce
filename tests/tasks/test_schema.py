import os
from unittest import TestCase
from unittest.mock import MagicMock

import pytest

from recce.adapter.dbt_adapter import DbtAdapter, load_catalog, load_manifest
from recce.core import RecceContext, set_default_context
from recce.models import Check
from recce.run import schema_diff_should_be_approved
from recce.tasks.schema import SchemaDiffResultDiffer
from tests.dbt_flags import temporarily_set_state_modified_compare_flag


def test_validator():
    from recce.tasks.schema import SchemaDiffCheckValidator

    validator = SchemaDiffCheckValidator()

    def validate(params: dict):
        validator.validate(
            {
                "name": "test",
                "type": "schema_diff",
                "params": params,
            }
        )

    # Select all models
    validate({})

    # Select by node name
    validate(
        {
            "node_id": "abc",
        }
    )
    validate(
        {
            "node_id": ["abc"],
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


test_root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestSchemaDiffAutoApprove(TestCase):

    def setUp(self):
        self.default_context = MagicMock(spec=RecceContext)
        self.addCleanup(temporarily_set_state_modified_compare_flag())
        manifest = load_manifest(path=os.path.join(test_root_path, "manifest.json"))
        catalog = load_catalog(path=os.path.join(test_root_path, "catalog.json"))
        dbt_adapter = DbtAdapter(curr_manifest=manifest, curr_catalog=catalog)
        self.default_context.adapter = dbt_adapter

        dbt_adapter.adapter = MagicMock()
        dbt_adapter.adapter.type.return_value = None

        dbt_adapter.select_nodes = MagicMock()
        # Base and Current will be the same
        self.default_context.get_lineage.return_value = dbt_adapter.get_lineage()
        set_default_context(self.default_context)

    def test_schema_diff_should_be_approved(self):
        # Node_id is string
        is_approved = schema_diff_should_be_approved(
            {
                "node_id": "model.jaffle_shop.customers",
            }
        )
        assert is_approved is True

        # Node_id is list
        is_approved = schema_diff_should_be_approved(
            {
                "node_id": ["model.jaffle_shop.customers"],
            }
        )
        assert is_approved is True

        # Select all models
        self.default_context.adapter.select_nodes.return_value = ["model.jaffle_shop.customers"]
        is_approved = schema_diff_should_be_approved(
            {
                "select": "customers",
            }
        )
        assert is_approved is True


def test_schema_diff_result_differ_keeps_verified_changes_and_filters_unchecked_nodes():
    checked_id = "model.project.verified"
    unchecked_id = "model.project.not_rebuilt"
    check = Check(
        name="schema",
        type="schema_diff",
        params={"node_id": [checked_id, unchecked_id]},
    )
    base_lineage = {
        "nodes": {
            checked_id: {
                "name": "verified",
                "resource_type": "model",
                "config": {"materialized": "table"},
                "catalog_status": "covered",
                "columns": {"id": {"type": "integer"}, "removed": {"type": "text"}},
            },
            unchecked_id: {
                "name": "not_rebuilt",
                "resource_type": "model",
                "config": {"materialized": "table"},
                "catalog_status": "covered",
                "columns": {"id": {"type": "integer"}, "not_removed": {"type": "text"}},
            },
        }
    }
    current_lineage = {
        "nodes": {
            checked_id: {
                "name": "verified",
                "resource_type": "model",
                "config": {"materialized": "table"},
                "catalog_status": "covered",
                "columns": {"id": {"type": "integer"}},
            },
            unchecked_id: {
                "name": "not_rebuilt",
                "resource_type": "model",
                "config": {"materialized": "table"},
                "catalog_status": "unchecked",
            },
        }
    }

    differ = SchemaDiffResultDiffer(check, base_lineage, current_lineage)

    assert differ.schema_coverage.status == "partial"
    assert differ.schema_coverage.checked_node_ids == frozenset({checked_id})
    assert differ.schema_coverage.unchecked_node_ids == frozenset({unchecked_id})
    assert differ.changes is not None
    assert differ.changed_nodes == ["verified"]


def test_schema_diff_result_differ_keeps_a_one_sided_model_removal_visible():
    """AC5: a model present on only one manifest side stays in the PR summary.

    It has no two-sided column comparison, so it lands in neither the checked
    nor the unchecked bucket. Reporting only checked nodes would drop a dropped
    model out of the summary entirely — the reviewer would never see it.
    """
    dropped_id = "model.project.dropped"
    kept_id = "model.project.kept"
    check = Check(
        name="schema",
        type="schema_diff",
        params={"node_id": [dropped_id, kept_id]},
    )

    def node(name, columns):
        return {
            "name": name,
            "resource_type": "model",
            "config": {"materialized": "table"},
            "catalog_status": "covered",
            "columns": {column: {"type": "text"} for column in columns},
        }

    base_lineage = {
        "nodes": {
            dropped_id: node("dropped", ["id", "gone"]),
            kept_id: node("kept", ["id"]),
        }
    }
    current_lineage = {"nodes": {kept_id: node("kept", ["id"])}}

    differ = SchemaDiffResultDiffer(check, base_lineage, current_lineage)

    assert differ.changes is not None
    assert differ.changed_nodes == ["dropped"]
    # The removal is verified, not unchecked: it must not be reported as a
    # coverage gap that needs a regenerated catalog.
    assert differ.schema_coverage.status == "complete"
    assert differ.schema_coverage.unchecked_node_ids == frozenset()
