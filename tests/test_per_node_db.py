"""Unit tests for the per-node SQLite emitter (DRC-3295 PR 1)."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

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


def test_schema_created_with_rollback_journal(db_path):
    with PerNodeDbWriter(db_path):
        pass

    conn = _open(db_path)
    try:
        journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        user_version = conn.execute("PRAGMA user_version").fetchone()[0]
        # We deliberately stay on the default rollback journal rather than
        # WAL: this file is uploaded as a single artifact with no -wal/-shm
        # sidecars, so the main file must be self-contained at close.
        assert journal_mode.lower() != "wal", f"unexpected journal_mode={journal_mode!r}"
        assert user_version == SCHEMA_VERSION

        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
        assert {"meta", "nodes", "columns", "edges", "node_tests"}.issubset(tables)

        indexes = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index'").fetchall()}
        assert "idx_edges_child_env" in indexes
        # Plan doc dropped this redundant index -- make sure we did not ship it.
        assert "idx_columns_node_env" not in indexes

        # The main file must be fully self-contained — no residual -wal/-shm
        # sidecars for the uploader to miss.
        assert not Path(f"{db_path}-wal").exists()
        assert not Path(f"{db_path}-shm").exists()
    finally:
        conn.close()


def test_no_wal_sidecars_after_writes(db_path):
    """After writing and closing, only the main file exists on disk."""
    with PerNodeDbWriter(db_path) as w:
        w.write_nodes([_node_row("model.pkg.a")])
        w.write_edges([EdgeRow(parent_id="model.pkg.a", child_id="model.pkg.b", env="current")])

    assert Path(db_path).exists()
    assert not Path(f"{db_path}-wal").exists()
    assert not Path(f"{db_path}-shm").exists()


def test_rollback_on_exception(db_path):
    """An exception inside the with-block rolls back row writes."""

    class _Boom(RuntimeError):
        pass

    with pytest.raises(_Boom):
        with PerNodeDbWriter(db_path) as w:
            w.write_nodes([_node_row("model.pkg.a")])
            raise _Boom("writer should rollback")

    conn = _open(db_path)
    try:
        # Schema DDL was committed at __enter__ (by design) so the table
        # exists — but no row should have persisted from the failed txn.
        count = conn.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
        assert count == 0, f"expected 0 nodes after rollback, got {count}"
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


def test_catalog_is_authoritative_when_present():
    """When the catalog covers a node, it is the only source of truth for
    that node's column list:

    * Catalog casing (UPPERCASE on Snowflake) wins over schema.yml casing,
      so columns appear once instead of as ``ID`` + ``id`` duplicates.
    * Test column names (parsed from dbt-generated lowercase test names)
      are remapped to catalog casing so ``node_tests.column_name`` joins
      ``columns.column_name`` and ``_pick_primary_key`` recovers a PK.
    * schema.yml columns and tests on columns the warehouse doesn't have
      (phantom / drift) are dropped — surfacing them produces false
      schema-change alarms across sessions and SQL errors on profile.
    """
    manifest = {
        "nodes": {
            "model.pkg.m": {
                "name": "m",
                "resource_type": "model",
                "package_name": "pkg",
                "columns": {
                    "id": {"name": "id"},
                    "amount": {"name": "amount"},
                    "phantom_col": {"name": "phantom_col"},
                },
            },
            "test.pkg.unique_m_id.aaa": {
                "name": "unique_m_id",
                "resource_type": "test",
                "package_name": "pkg",
            },
            "test.pkg.not_null_m_amount.bbb": {
                "name": "not_null_m_amount",
                "resource_type": "test",
                "package_name": "pkg",
            },
            "test.pkg.not_null_m_phantom_col.ccc": {
                "name": "not_null_m_phantom_col",
                "resource_type": "test",
                "package_name": "pkg",
            },
        },
        "child_map": {
            "model.pkg.m": [
                "test.pkg.unique_m_id.aaa",
                "test.pkg.not_null_m_amount.bbb",
                "test.pkg.not_null_m_phantom_col.ccc",
            ],
        },
    }
    catalog = {
        "nodes": {
            "model.pkg.m": {
                "columns": {
                    "ID": {"type": "INTEGER"},
                    "AMOUNT": {"type": "NUMBER"},
                },
            },
        },
    }

    nodes, columns, _, tests = extract_rows_from_artifacts(manifest, catalog, "current")

    # phantom_col was declared in schema.yml but the catalog doesn't have
    # it, so the warehouse can't confirm it. It is dropped.
    names = [c.column_name for c in columns]
    assert names == ["ID", "AMOUNT"]
    by_name = {c.column_name: c for c in columns}
    assert by_name["ID"].data_type == "INTEGER"
    assert by_name["AMOUNT"].data_type == "NUMBER"

    # Tests on phantom_col are also dropped — node_tests must stay
    # joinable to columns.
    test_cols = {(t.column_name, t.test_type) for t in tests}
    assert ("ID", "unique") in test_cols
    assert ("AMOUNT", "not_null") in test_cols
    assert not any(t.column_name.lower() == "phantom_col" for t in tests)

    # primary_key derived from the column ↔ unique-test join, catalog-cased.
    by_node = {n.node_id: n for n in nodes}
    assert by_node["model.pkg.m"].primary_key == "ID"


def test_manifest_fallback_when_catalog_has_no_entry_for_node():
    """If the catalog has no entry for a node (model never built, or no
    catalog at all), the manifest's ``columns`` block is the best-effort
    fallback — preserve manifest casing exactly.
    """
    manifest = {
        "nodes": {
            "model.pkg.unbuilt": {
                "name": "unbuilt",
                "resource_type": "model",
                "package_name": "pkg",
                "columns": {
                    "alpha": {"name": "alpha"},
                    "beta": {"name": "beta"},
                },
            },
        },
        "child_map": {"model.pkg.unbuilt": []},
    }
    catalog = {"nodes": {}}  # node absent from catalog

    _, columns, _, _ = extract_rows_from_artifacts(manifest, catalog, "current")

    names = [c.column_name for c in columns]
    assert names == ["alpha", "beta"]
    assert all(c.data_type is None for c in columns)


def test_primary_key_follows_catalog_column_order_with_multiple_unique_tests():
    """When a model has two unique tests, primary_key matches the column that
    comes first in catalog order — which is the warehouse column order that
    ``DbtAdapter.get_model`` also walks when picking its tiebreaker. This
    previously diverged: the emitter picked by child_map order which bears
    no relation to warehouse order.
    """
    manifest = {
        "nodes": {
            "model.pkg.m": {
                "name": "m",
                "resource_type": "model",
                "package_name": "pkg",
                "columns": {"a": {"name": "a"}, "b": {"name": "b"}},
            },
            "test.pkg.unique_m_b.x": {
                "name": "unique_m_b",
                "resource_type": "test",
                "package_name": "pkg",
            },
            "test.pkg.unique_m_a.y": {
                "name": "unique_m_a",
                "resource_type": "test",
                "package_name": "pkg",
            },
        },
        # NOTE: child_map lists unique_m_b BEFORE unique_m_a. The old
        # derivation would pick "b" here, but catalog column order says "a".
        "child_map": {
            "model.pkg.m": ["test.pkg.unique_m_b.x", "test.pkg.unique_m_a.y"],
            "test.pkg.unique_m_b.x": [],
            "test.pkg.unique_m_a.y": [],
        },
    }
    catalog = {
        "nodes": {
            "model.pkg.m": {
                "columns": {
                    "a": {"type": "INTEGER"},
                    "b": {"type": "INTEGER"},
                }
            }
        }
    }

    nodes, _, _, tests = extract_rows_from_artifacts(manifest, catalog, "current")
    m = next(n for n in nodes if n.node_id == "model.pkg.m")

    # Both unique tests must still be recorded (consumers may re-derive).
    unique_cols = {t.column_name for t in tests if t.test_type == "unique"}
    assert unique_cols == {"a", "b"}

    # primary_key follows catalog column order — "a" wins even though "b"
    # appears first in child_map.
    assert m.primary_key == "a"


def test_primary_key_falls_back_to_manifest_column_order_without_catalog():
    """With no catalog, manifest column order is the only signal we have.
    It still beats child_map order because manifest column declarations
    typically match column definition order in the model SQL.
    """
    manifest = {
        "nodes": {
            "model.pkg.m": {
                "name": "m",
                "resource_type": "model",
                "package_name": "pkg",
                # Manifest columns: a first, then b.
                "columns": {"a": {"name": "a"}, "b": {"name": "b"}},
            },
            "test.pkg.unique_m_b.x": {
                "name": "unique_m_b",
                "resource_type": "test",
                "package_name": "pkg",
            },
            "test.pkg.unique_m_a.y": {
                "name": "unique_m_a",
                "resource_type": "test",
                "package_name": "pkg",
            },
        },
        # child_map order is b-first; emitter must not use it as the tiebreaker.
        "child_map": {
            "model.pkg.m": ["test.pkg.unique_m_b.x", "test.pkg.unique_m_a.y"],
        },
    }

    nodes, _, _, _ = extract_rows_from_artifacts(manifest, None, "current")
    m = next(n for n in nodes if n.node_id == "model.pkg.m")
    assert m.primary_key == "a"
