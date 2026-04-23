"""Unit tests for the per-node SQLite emitter (DRC-3295 PR 1)."""

from __future__ import annotations

import json
import sqlite3

import pytest

from recce.util.per_node_db import (
    SCHEMA_VERSION,
    ColumnRow,
    EdgeRow,
    NodeRow,
    NodeTestRow,
    PerNodeDbWriter,
    extract_rows_from_artifacts,
)


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "per_node.db"


def _open(db_path) -> sqlite3.Connection:
    return sqlite3.connect(str(db_path))


def _node_row(node_id: str, env: str = "current", **overrides) -> NodeRow:
    payload = {"name": node_id.split(".")[-1]}
    kwargs = dict(
        node_id=node_id,
        env=env,
        name=payload["name"],
        resource_type="model",
        package_name="pkg",
        raw_code="select 1",
        compiled_code="select 1",
        primary_key=None,
        node_json=json.dumps(payload).encode("utf-8"),
    )
    kwargs.update(overrides)
    return NodeRow(**kwargs)


def test_schema_created_with_wal_mode(db_path):
    with PerNodeDbWriter(db_path):
        pass

    conn = _open(db_path)
    try:
        journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        user_version = conn.execute("PRAGMA user_version").fetchone()[0]
        assert journal_mode.lower() == "wal"
        assert user_version == SCHEMA_VERSION

        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
        assert {"meta", "nodes", "columns", "edges", "node_tests"}.issubset(tables)

        indexes = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index'").fetchall()}
        assert "idx_edges_child_env" in indexes
        # Plan doc dropped this redundant index -- make sure we did not ship it.
        assert "idx_columns_node_env" not in indexes
    finally:
        conn.close()


def test_write_nodes_roundtrip(db_path):
    rows = [
        _node_row("model.pkg.a"),
        _node_row("model.pkg.b", primary_key="id"),
        _node_row("model.pkg.c", env="base", raw_code=None, compiled_code=None),
    ]
    with PerNodeDbWriter(db_path) as w:
        w.write_nodes(rows)

    conn = _open(db_path)
    try:
        fetched = conn.execute(
            "SELECT node_id, env, name, resource_type, package_name, raw_code, "
            "compiled_code, primary_key, node_json FROM nodes ORDER BY node_id, env"
        ).fetchall()
    finally:
        conn.close()

    assert len(fetched) == 3
    # Round-trip: confirm all columns survive, including None-valued raw/compiled code.
    assert fetched[0][0] == "model.pkg.a"
    assert fetched[1][7] == "id"
    assert fetched[2][5] is None and fetched[2][6] is None
    assert json.loads(fetched[0][8]) == {"name": "a"}


def test_write_columns_with_null_type(db_path):
    rows = [
        ColumnRow(node_id="model.pkg.a", env="current", column_name="id", data_type=None),
        ColumnRow(node_id="model.pkg.a", env="current", column_name="name", data_type="VARCHAR"),
    ]
    with PerNodeDbWriter(db_path) as w:
        w.write_columns(rows)

    conn = _open(db_path)
    try:
        fetched = conn.execute(
            "SELECT column_name, data_type FROM columns " "WHERE node_id = ? AND env = ? ORDER BY column_name",
            ("model.pkg.a", "current"),
        ).fetchall()
    finally:
        conn.close()

    assert fetched == [("id", None), ("name", "VARCHAR")]


def test_write_edges(db_path):
    rows = [
        EdgeRow(parent_id="model.pkg.a", child_id="model.pkg.b", env="current"),
        EdgeRow(parent_id="model.pkg.a", child_id="model.pkg.c", env="current"),
        EdgeRow(parent_id="model.pkg.b", child_id="model.pkg.c", env="current"),
    ]
    with PerNodeDbWriter(db_path) as w:
        w.write_edges(rows)

    conn = _open(db_path)
    try:
        count_pk = conn.execute(
            "SELECT COUNT(*) FROM edges WHERE parent_id = ? AND env = ?",
            ("model.pkg.a", "current"),
        ).fetchone()[0]
        assert count_pk == 2

        # Child-direction lookup should be served by idx_edges_child_env.
        parents = [
            row[0]
            for row in conn.execute(
                "SELECT parent_id FROM edges WHERE child_id = ? AND env = ? ORDER BY parent_id",
                ("model.pkg.c", "current"),
            ).fetchall()
        ]
        assert parents == ["model.pkg.a", "model.pkg.b"]

        plan = conn.execute(
            "EXPLAIN QUERY PLAN SELECT parent_id FROM edges WHERE child_id = ? AND env = ?",
            ("model.pkg.c", "current"),
        ).fetchall()
        assert any("idx_edges_child_env" in str(row) for row in plan)
    finally:
        conn.close()


def test_write_tests(db_path):
    rows = [
        NodeTestRow(
            node_id="model.pkg.a",
            env="current",
            column_name="id",
            test_name="test.pkg.unique_a_id.123",
            test_type="unique",
        ),
        NodeTestRow(
            node_id="model.pkg.a",
            env="current",
            column_name="id",
            test_name="test.pkg.not_null_a_id.456",
            test_type="not_null",
        ),
    ]
    with PerNodeDbWriter(db_path) as w:
        w.write_tests(rows)

    conn = _open(db_path)
    try:
        fetched = conn.execute(
            "SELECT column_name, test_name, test_type FROM node_tests "
            "WHERE node_id = ? AND env = ? ORDER BY test_name",
            ("model.pkg.a", "current"),
        ).fetchall()
    finally:
        conn.close()

    assert fetched == [
        ("id", "test.pkg.not_null_a_id.456", "not_null"),
        ("id", "test.pkg.unique_a_id.123", "unique"),
    ]


def _synthetic_manifest() -> dict:
    """3 nodes (a -> b -> c), 1 unique test on a.id, 1 not_null test on b.name."""
    return {
        "nodes": {
            "model.pkg.a": {
                "name": "a",
                "resource_type": "model",
                "package_name": "pkg",
                "raw_code": "select 1 as id",
                "compiled_code": "select 1 as id",
                "columns": {"id": {"name": "id"}},
            },
            "model.pkg.b": {
                "name": "b",
                "resource_type": "model",
                "package_name": "pkg",
                "raw_code": "select * from {{ ref('a') }}",
                "compiled_code": "select * from a",
                "columns": {"name": {"name": "name"}},
            },
            "model.pkg.c": {
                "name": "c",
                "resource_type": "model",
                "package_name": "pkg",
                "raw_code": "select * from {{ ref('b') }}",
                "compiled_code": "select * from b",
            },
            "test.pkg.unique_a_id.abc": {
                "name": "unique_a_id",
                "resource_type": "test",
                "package_name": "pkg",
            },
            "test.pkg.not_null_b_name.def": {
                "name": "not_null_b_name",
                "resource_type": "test",
                "package_name": "pkg",
            },
        },
        "child_map": {
            "model.pkg.a": ["model.pkg.b", "test.pkg.unique_a_id.abc"],
            "model.pkg.b": ["model.pkg.c", "test.pkg.not_null_b_name.def"],
            "model.pkg.c": [],
            "test.pkg.unique_a_id.abc": [],
            "test.pkg.not_null_b_name.def": [],
        },
    }


def test_extract_rows_from_artifacts_basic():
    manifest = _synthetic_manifest()
    catalog = {
        "nodes": {
            "model.pkg.a": {"columns": {"id": {"type": "INTEGER"}}},
            "model.pkg.b": {"columns": {"name": {"type": "VARCHAR"}}},
        }
    }

    nodes, columns, edges, tests = extract_rows_from_artifacts(manifest, catalog, "current")

    by_id = {n.node_id: n for n in nodes}
    # Manifest contains 3 models + 2 tests; tests are iterated but have no
    # columns/edges of interest for this assertion.
    assert {"model.pkg.a", "model.pkg.b", "model.pkg.c"}.issubset(by_id.keys())
    assert by_id["model.pkg.a"].primary_key == "id"
    assert by_id["model.pkg.b"].primary_key is None  # only not_null, no unique test
    assert by_id["model.pkg.a"].env == "current"

    cols_by_node = {(c.node_id, c.column_name): c for c in columns}
    assert cols_by_node[("model.pkg.a", "id")].data_type == "INTEGER"
    assert cols_by_node[("model.pkg.b", "name")].data_type == "VARCHAR"

    edge_pairs = {(e.parent_id, e.child_id) for e in edges}
    assert ("model.pkg.a", "model.pkg.b") in edge_pairs
    assert ("model.pkg.b", "model.pkg.c") in edge_pairs

    test_types = {(t.node_id, t.test_type) for t in tests}
    assert ("model.pkg.a", "unique") in test_types
    assert ("model.pkg.b", "not_null") in test_types


def test_extract_rows_with_null_catalog():
    manifest = _synthetic_manifest()
    _, columns, _, _ = extract_rows_from_artifacts(manifest, None, "base")
    assert columns, "expected columns derived from manifest even without catalog"
    assert all(c.data_type is None for c in columns)
    assert all(c.env == "base" for c in columns)


def test_empty_manifest():
    nodes, columns, edges, tests = extract_rows_from_artifacts({}, None, "current")
    assert nodes == []
    assert columns == []
    assert edges == []
    assert tests == []
