from recce.models.lineage import build_merged_lineage
from recce.models.types import (
    LineageDiff,
    MergedEdge,
    MergedLineage,
    MergedNode,
    NodeChange,
    NodeDiff,
)


class TestMergedNodeSerialization:
    """Verify MergedNode model_dump honors exclude_none and by_alias."""

    def test_unchanged_node_omits_change_fields(self):
        """An unchanged node must NOT have change_status or change in output."""
        node = MergedNode(
            name="my_model",
            resource_type="model",
            package_name="pkg",
            schema_name="public",
            materialized="table",
        )
        data = node.model_dump(exclude_none=True, by_alias=True)
        assert "change_status" not in data
        assert "change" not in data

    def test_by_alias_emits_schema_not_schema_name(self):
        """Field `schema_name` must serialize as `schema` via alias."""
        node = MergedNode(
            name="n",
            resource_type="model",
            package_name="pkg",
            schema_name="public",
        )
        data = node.model_dump(exclude_none=True, by_alias=True)
        assert "schema" in data
        assert "schema_name" not in data
        assert data["schema"] == "public"

    def test_modified_node_includes_change_status_and_change(self):
        node = MergedNode(
            name="n",
            resource_type="model",
            package_name="pkg",
            change_status="modified",
            change=NodeChange(category="breaking", columns={"col_a": "added"}),
        )
        data = node.model_dump(exclude_none=True, by_alias=True)
        assert data["change_status"] == "modified"
        assert data["change"]["category"] == "breaking"
        assert data["change"]["columns"] == {"col_a": "added"}

    def test_added_node_has_change_status_no_change(self):
        node = MergedNode(
            name="n",
            resource_type="model",
            package_name="pkg",
            change_status="added",
        )
        data = node.model_dump(exclude_none=True, by_alias=True)
        assert data["change_status"] == "added"
        assert "change" not in data

    def test_extra_fields_ignored_on_construction(self):
        """Unknown fields like 'id' or 'source_name' must not raise."""
        node = MergedNode(
            name="n",
            resource_type="model",
            package_name="pkg",
            id="model.pkg.n",  # extra — should be ignored
            unknown_field="whatever",  # extra — should be ignored
        )
        assert node.name == "n"

    def test_accepts_schema_as_input(self):
        """populate_by_name lets 'schema' work as input (not just 'schema_name')."""
        node = MergedNode(
            name="n",
            resource_type="model",
            package_name="pkg",
            schema="analytics",
        )
        assert node.schema_name == "analytics"

    def test_source_node_with_source_name(self):
        node = MergedNode(
            name="raw_events",
            resource_type="source",
            package_name="pkg",
            source_name="external",
        )
        data = node.model_dump(exclude_none=True, by_alias=True)
        assert data["source_name"] == "external"

    def test_tags_default_to_none_omitted(self):
        node = MergedNode(name="n", resource_type="model", package_name="pkg")
        assert node.tags is None
        data = node.model_dump(exclude_none=True, by_alias=True)
        assert "tags" not in data

    def test_tags_present_when_provided(self):
        node = MergedNode(name="n", resource_type="model", package_name="pkg", tags=["finance"])
        data = node.model_dump(exclude_none=True, by_alias=True)
        assert data["tags"] == ["finance"]

    def test_package_name_defaults_to_empty_string(self):
        """SqlMesh adapters may omit package_name; default prevents ValidationError."""
        node = MergedNode(name="n", resource_type="model")
        assert node.package_name == ""
        data = node.model_dump(exclude_none=True, by_alias=True)
        assert data["package_name"] == ""


class TestMergedEdgeSerialization:

    def test_unchanged_edge_omits_change_status(self):
        edge = MergedEdge(source="model.a", target="model.b")
        data = edge.model_dump(exclude_none=True)
        assert "change_status" not in data

    def test_added_edge_includes_change_status(self):
        edge = MergedEdge(source="model.a", target="model.b", change_status="added")
        data = edge.model_dump(exclude_none=True)
        assert data["change_status"] == "added"

    def test_removed_edge_includes_change_status(self):
        edge = MergedEdge(source="model.a", target="model.b", change_status="removed")
        data = edge.model_dump(exclude_none=True)
        assert data["change_status"] == "removed"


class TestMergedLineage:

    def test_constructs_with_nodes_edges_metadata(self):
        node = MergedNode(name="m", resource_type="model", package_name="pkg")
        edge = MergedEdge(source="model.a", target="model.b")
        lineage = MergedLineage(
            nodes={"model.pkg.m": node},
            edges=[edge],
            metadata={"generated_at": "2024-01-01"},
        )
        assert "model.pkg.m" in lineage.nodes
        assert len(lineage.edges) == 1
        assert lineage.metadata["generated_at"] == "2024-01-01"


def _make_lineage_diff(
    *,
    base_nodes=None,
    current_nodes=None,
    diff=None,
    base_parent_map=None,
    current_parent_map=None,
    base_metadata=None,
    current_metadata=None,
) -> LineageDiff:
    """Helper to build a LineageDiff from minimal inputs."""
    base = {"nodes": base_nodes or {}, "parent_map": base_parent_map or {}}
    current = {"nodes": current_nodes or {}, "parent_map": current_parent_map or {}}
    if base_metadata:
        base["manifest_metadata"] = base_metadata.get("manifest_metadata", {})
        base["catalog_metadata"] = base_metadata.get("catalog_metadata", {})
    if current_metadata:
        current["manifest_metadata"] = current_metadata.get("manifest_metadata", {})
        current["catalog_metadata"] = current_metadata.get("catalog_metadata", {})

    node_diffs = {}
    for node_id, d in (diff or {}).items():
        if isinstance(d, NodeDiff):
            node_diffs[node_id] = d
        else:
            node_diffs[node_id] = NodeDiff(**d)

    return LineageDiff(base=base, current=current, diff=node_diffs)


class TestBuildMergedLineageNodes:

    def test_unchanged_node_in_both_envs(self):
        node = {"name": "a", "resource_type": "model", "package_name": "pkg", "schema": "public", "id": "model.pkg.a"}
        ld = _make_lineage_diff(
            base_nodes={"model.pkg.a": node},
            current_nodes={"model.pkg.a": node},
        )
        result = build_merged_lineage(ld)
        merged = result.nodes["model.pkg.a"]
        assert merged.name == "a"
        assert merged.change_status is None
        assert merged.change is None

    def test_added_node_only_in_current(self):
        node = {"name": "new_model", "resource_type": "model", "package_name": "pkg"}
        diff = {"model.pkg.new_model": {"change_status": "added"}}
        ld = _make_lineage_diff(current_nodes={"model.pkg.new_model": node}, diff=diff)
        result = build_merged_lineage(ld)
        merged = result.nodes["model.pkg.new_model"]
        assert merged.change_status == "added"
        assert merged.name == "new_model"

    def test_removed_node_only_in_base(self):
        node = {"name": "old_model", "resource_type": "model", "package_name": "pkg"}
        diff = {"model.pkg.old_model": {"change_status": "removed"}}
        ld = _make_lineage_diff(base_nodes={"model.pkg.old_model": node}, diff=diff)
        result = build_merged_lineage(ld)
        merged = result.nodes["model.pkg.old_model"]
        assert merged.change_status == "removed"

    def test_modified_node_uses_current_metadata(self):
        base_node = {"name": "m", "resource_type": "model", "package_name": "pkg", "schema": "old_schema"}
        curr_node = {"name": "m", "resource_type": "model", "package_name": "pkg", "schema": "new_schema"}
        diff = {
            "model.pkg.m": NodeDiff(
                change_status="modified",
                change=NodeChange(category="non_breaking", columns={"col_x": "added"}),
            )
        }
        ld = _make_lineage_diff(
            base_nodes={"model.pkg.m": base_node},
            current_nodes={"model.pkg.m": curr_node},
            diff=diff,
        )
        result = build_merged_lineage(ld)
        merged = result.nodes["model.pkg.m"]
        assert merged.schema_name == "new_schema"
        assert merged.change_status == "modified"
        assert merged.change.category == "non_breaking"
        assert merged.change.columns == {"col_x": "added"}

    def test_extra_node_fields_ignored(self):
        node = {
            "name": "a",
            "resource_type": "model",
            "package_name": "pkg",
            "id": "model.pkg.a",
            "unique_id": "model.pkg.a",
            "raw_code": "SELECT 1",
            "checksum": {"name": "sha256"},
            "config": {"materialized": "table", "schema": "public"},
        }
        ld = _make_lineage_diff(
            base_nodes={"model.pkg.a": node},
            current_nodes={"model.pkg.a": node},
        )
        result = build_merged_lineage(ld)
        assert result.nodes["model.pkg.a"].name == "a"

    def test_materialized_extracted_from_config(self):
        """materialized lives inside config in dbt manifest; build_merged_lineage must extract it."""
        node = {
            "name": "orders",
            "resource_type": "model",
            "package_name": "pkg",
            "config": {"materialized": "incremental"},
        }
        ld = _make_lineage_diff(
            current_nodes={"model.pkg.orders": node},
        )
        result = build_merged_lineage(ld)
        assert result.nodes["model.pkg.orders"].materialized == "incremental"

    def test_materialized_not_overwritten_if_top_level(self):
        """If a future adapter provides top-level materialized, config should not override."""
        node = {
            "name": "orders",
            "resource_type": "model",
            "package_name": "pkg",
            "materialized": "view",
            "config": {"materialized": "table"},
        }
        ld = _make_lineage_diff(
            current_nodes={"model.pkg.orders": node},
        )
        result = build_merged_lineage(ld)
        assert result.nodes["model.pkg.orders"].materialized == "view"

    def test_materialized_none_when_config_missing(self):
        """Nodes without config (e.g., sources) should not crash."""
        node = {
            "name": "raw_events",
            "resource_type": "source",
            "package_name": "pkg",
        }
        ld = _make_lineage_diff(
            current_nodes={"source.pkg.raw_events": node},
        )
        result = build_merged_lineage(ld)
        assert result.nodes["source.pkg.raw_events"].materialized is None


class TestBuildMergedLineageEdges:

    def test_edge_in_both_envs_unchanged(self):
        node_a = {"name": "a", "resource_type": "model", "package_name": "pkg"}
        node_b = {"name": "b", "resource_type": "model", "package_name": "pkg"}
        ld = _make_lineage_diff(
            base_nodes={"model.a": node_a, "model.b": node_b},
            current_nodes={"model.a": node_a, "model.b": node_b},
            base_parent_map={"model.b": ["model.a"]},
            current_parent_map={"model.b": ["model.a"]},
        )
        result = build_merged_lineage(ld)
        assert len(result.edges) == 1
        edge = result.edges[0]
        assert edge.source == "model.a"
        assert edge.target == "model.b"
        assert edge.change_status is None

    def test_edge_only_in_current_is_added(self):
        node_a = {"name": "a", "resource_type": "model", "package_name": "pkg"}
        node_b = {"name": "b", "resource_type": "model", "package_name": "pkg"}
        ld = _make_lineage_diff(
            base_nodes={"model.a": node_a, "model.b": node_b},
            current_nodes={"model.a": node_a, "model.b": node_b},
            current_parent_map={"model.b": ["model.a"]},
        )
        result = build_merged_lineage(ld)
        assert len(result.edges) == 1
        assert result.edges[0].change_status == "added"

    def test_edge_only_in_base_is_removed(self):
        node_a = {"name": "a", "resource_type": "model", "package_name": "pkg"}
        node_b = {"name": "b", "resource_type": "model", "package_name": "pkg"}
        ld = _make_lineage_diff(
            base_nodes={"model.a": node_a, "model.b": node_b},
            current_nodes={"model.a": node_a, "model.b": node_b},
            base_parent_map={"model.b": ["model.a"]},
        )
        result = build_merged_lineage(ld)
        assert len(result.edges) == 1
        assert result.edges[0].change_status == "removed"

    def test_orphan_edge_references_filtered(self):
        node_a = {"name": "a", "resource_type": "model", "package_name": "pkg"}
        ld = _make_lineage_diff(
            base_nodes={"model.a": node_a},
            current_nodes={"model.a": node_a},
            current_parent_map={"model.b": ["model.a"]},
        )
        result = build_merged_lineage(ld)
        assert len(result.edges) == 0


class TestBuildMergedLineageMetadata:

    def test_metadata_contains_both_envs(self):
        ld = _make_lineage_diff(
            base_metadata={"manifest_metadata": {"project_id": "base_proj"}},
            current_metadata={"manifest_metadata": {"project_id": "curr_proj"}},
        )
        result = build_merged_lineage(ld)
        assert result.metadata["base"]["manifest_metadata"]["project_id"] == "base_proj"
        assert result.metadata["current"]["manifest_metadata"]["project_id"] == "curr_proj"

    def test_missing_metadata_defaults_to_empty(self):
        ld = _make_lineage_diff()
        result = build_merged_lineage(ld)
        assert result.metadata["base"]["manifest_metadata"] == {}
        assert result.metadata["current"]["catalog_metadata"] == {}

    def test_explicit_none_metadata_normalized_to_empty(self):
        """Adapters may set manifest_metadata/catalog_metadata to None explicitly."""
        ld = LineageDiff(
            base={"nodes": {}, "parent_map": {}, "manifest_metadata": None, "catalog_metadata": None},
            current={"nodes": {}, "parent_map": {}, "manifest_metadata": None, "catalog_metadata": None},
            diff={},
        )
        result = build_merged_lineage(ld)
        assert result.metadata["base"]["manifest_metadata"] == {}
        assert result.metadata["base"]["catalog_metadata"] == {}
        assert result.metadata["current"]["manifest_metadata"] == {}
        assert result.metadata["current"]["catalog_metadata"] == {}


class TestBuildMergedLineageWireFormat:

    def test_full_serialization_contract(self):
        base_node = {
            "name": "a",
            "resource_type": "model",
            "package_name": "pkg",
            "schema": "public",
            "id": "model.pkg.a",
        }
        curr_node = {
            "name": "a",
            "resource_type": "model",
            "package_name": "pkg",
            "schema": "public",
            "id": "model.pkg.a",
        }
        new_node = {"name": "b", "resource_type": "model", "package_name": "pkg"}

        diff = {
            "model.pkg.b": NodeDiff(change_status="added"),
        }
        ld = _make_lineage_diff(
            base_nodes={"model.pkg.a": base_node},
            current_nodes={"model.pkg.a": curr_node, "model.pkg.b": new_node},
            base_parent_map={},
            current_parent_map={"model.pkg.b": ["model.pkg.a"]},
            diff=diff,
        )
        result = build_merged_lineage(ld)
        wire = result.model_dump(exclude_none=True, by_alias=True)

        node_a = wire["nodes"]["model.pkg.a"]
        assert "change_status" not in node_a
        assert "change" not in node_a
        assert node_a["schema"] == "public"
        assert "schema_name" not in node_a

        node_b = wire["nodes"]["model.pkg.b"]
        assert node_b["change_status"] == "added"

        assert len(wire["edges"]) == 1
        edge = wire["edges"][0]
        assert edge["source"] == "model.pkg.a"
        assert edge["target"] == "model.pkg.b"
        assert edge["change_status"] == "added"

    def test_empty_lineage(self):
        ld = _make_lineage_diff()
        result = build_merged_lineage(ld)
        wire = result.model_dump(exclude_none=True, by_alias=True)
        assert wire["nodes"] == {}
        assert wire["edges"] == []
