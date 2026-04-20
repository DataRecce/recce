from recce.models.types import (
    MergedEdge,
    MergedLineage,
    MergedNode,
    NodeChange,
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

    def test_tags_default_to_empty_list(self):
        node = MergedNode(name="n", resource_type="model", package_name="pkg")
        assert node.tags == []
        data = node.model_dump(exclude_none=True, by_alias=True)
        assert data["tags"] == []


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
