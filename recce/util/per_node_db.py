"""Per-node SQLite emitter for lineage precompute (DRC-3295).

This module produces a ``per_node.db`` SQLite file containing pure-artifact
data derived from a dbt manifest (and optional catalog). Cloud consumers can
stream rows out of the DB to serve lineage API responses without proxying to
an ephemeral Recce instance.

PR 1 of 3 (stacked):
  * PR 1 (this module) -- pure emitter + unit tests, no CLI wiring.
  * PR 2 -- wire into ``recce init --cloud``.
  * PR 3 -- scale tests against real artifacts.

The emitter is dependency-light on purpose: ``json`` is used for
``node_json`` payloads instead of msgpack so we don't pull in a new runtime
dep. If/when msgpack is added to ``pyproject.toml`` we can swap the encoder
behind ``_encode_node`` without changing the schema.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Literal, Optional

SCHEMA_VERSION = 1

Env = Literal["base", "current"]

_MANIFEST_NODE_SECTIONS = (
    "nodes",
    "sources",
    "exposures",
    "metrics",
    "semantic_models",
)


@dataclass(frozen=True)
class NodeRow:
    node_id: str
    env: Env
    name: str
    resource_type: str
    package_name: Optional[str]
    raw_code: Optional[str]
    compiled_code: Optional[str]
    primary_key: Optional[str]
    node_json: bytes  # JSON-encoded raw manifest dict for the node (see module docstring).


@dataclass(frozen=True)
class ColumnRow:
    node_id: str
    env: Env
    column_name: str
    data_type: Optional[str]


@dataclass(frozen=True)
class EdgeRow:
    parent_id: str
    child_id: str
    env: Env


@dataclass(frozen=True)
class NodeTestRow:
    node_id: str
    env: Env
    column_name: str
    test_name: str
    test_type: Literal["not_null", "unique"]


_SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS nodes (
        node_id TEXT NOT NULL,
        env TEXT NOT NULL,
        name TEXT,
        resource_type TEXT,
        package_name TEXT,
        raw_code TEXT,
        compiled_code TEXT,
        primary_key TEXT,
        node_json BLOB,
        PRIMARY KEY (node_id, env)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS columns (
        node_id TEXT NOT NULL,
        env TEXT NOT NULL,
        column_name TEXT NOT NULL,
        data_type TEXT,
        PRIMARY KEY (node_id, env, column_name)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS edges (
        parent_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        env TEXT NOT NULL,
        PRIMARY KEY (parent_id, child_id, env)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_edges_child_env ON edges(child_id, env)",
    """
    CREATE TABLE IF NOT EXISTS node_tests (
        node_id TEXT NOT NULL,
        env TEXT NOT NULL,
        column_name TEXT NOT NULL,
        test_name TEXT NOT NULL,
        test_type TEXT NOT NULL,
        PRIMARY KEY (node_id, env, column_name, test_name)
    )
    """,
)


def _encode_node(node: dict) -> bytes:
    """Encode a manifest node dict to bytes for the ``node_json`` BLOB.

    Uses JSON so the emitter has no extra runtime dependency. ``default=str``
    handles non-serialisable values (e.g. enums, ``datetime``) by stringifying,
    matching dbt's own relaxed serialisation behaviour.
    """
    return json.dumps(node, default=str, separators=(",", ":")).encode("utf-8")


class PerNodeDbWriter:
    """Write dbt-derived rows into a per-node SQLite file.

    The writer is a context manager. It commits on clean exit and rolls back
    on exception. Schema is created idempotently on open. ``PRAGMA
    journal_mode = WAL`` and ``PRAGMA user_version = SCHEMA_VERSION`` are
    applied once at open time.
    """

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = str(db_path)
        self._conn: Optional[sqlite3.Connection] = None

    def __enter__(self) -> "PerNodeDbWriter":
        self._conn = sqlite3.connect(self._db_path)
        # WAL mode is persisted on the DB file, not the connection.
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        for stmt in _SCHEMA_STATEMENTS:
            self._conn.execute(stmt)
        self._conn.commit()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        assert self._conn is not None
        try:
            if exc_type is None:
                self._conn.commit()
            else:
                self._conn.rollback()
        finally:
            self._conn.close()
            self._conn = None

    @contextmanager
    def _txn(self) -> Iterator[sqlite3.Connection]:
        if self._conn is None:
            raise RuntimeError("PerNodeDbWriter is not open; use it as a context manager.")
        yield self._conn

    def write_meta(self, **kv: str) -> None:
        with self._txn() as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
                list(kv.items()),
            )

    def write_nodes(self, rows: Iterable[NodeRow]) -> None:
        with self._txn() as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO nodes
                    (node_id, env, name, resource_type, package_name,
                     raw_code, compiled_code, primary_key, node_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        r.node_id,
                        r.env,
                        r.name,
                        r.resource_type,
                        r.package_name,
                        r.raw_code,
                        r.compiled_code,
                        r.primary_key,
                        r.node_json,
                    )
                    for r in rows
                ],
            )

    def write_columns(self, rows: Iterable[ColumnRow]) -> None:
        with self._txn() as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO columns (node_id, env, column_name, data_type)
                VALUES (?, ?, ?, ?)
                """,
                [(r.node_id, r.env, r.column_name, r.data_type) for r in rows],
            )

    def write_edges(self, rows: Iterable[EdgeRow]) -> None:
        with self._txn() as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO edges (parent_id, child_id, env) VALUES (?, ?, ?)",
                [(r.parent_id, r.child_id, r.env) for r in rows],
            )

    def write_tests(self, rows: Iterable[NodeTestRow]) -> None:
        with self._txn() as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO node_tests
                    (node_id, env, column_name, test_name, test_type)
                VALUES (?, ?, ?, ?, ?)
                """,
                [(r.node_id, r.env, r.column_name, r.test_name, r.test_type) for r in rows],
            )


def _iter_manifest_nodes(manifest: dict) -> Iterator[tuple[str, dict]]:
    """Yield ``(node_id, node_dict)`` pairs from all supported manifest sections."""
    for section in _MANIFEST_NODE_SECTIONS:
        items = manifest.get(section) or {}
        for node_id, node in items.items():
            if isinstance(node, dict):
                yield node_id, node


def _derive_tests_and_primary_key(
    node_id: str,
    node: dict,
    manifest: dict,
    env: Env,
) -> tuple[list[NodeTestRow], Optional[str]]:
    """Derive ``node_tests`` rows and a ``primary_key`` for a single node.

    Mirrors ``DbtAdapter.get_model`` (recce/adapter/dbt_adapter/__init__.py:459-474):
    looks at ``child_map[node_id]`` for test children named
    ``not_null_<name>_<col>`` or ``unique_<name>_<col>``. The first column with
    a ``unique_`` test wins as primary_key.
    """
    child_map = manifest.get("child_map") or {}
    children = child_map.get(node_id) or []
    node_name = node.get("name")
    if not node_name:
        return [], None

    tests: list[NodeTestRow] = []
    primary_key: Optional[str] = None
    not_null_prefix = f"not_null_{node_name}_"
    unique_prefix = f"unique_{node_name}_"

    for child_id in children:
        comps = child_id.split(".")
        if len(comps) < 3 or comps[0] != "test":
            continue
        child_name = comps[2]
        if child_name.startswith(not_null_prefix):
            col = child_name[len(not_null_prefix) :]
            tests.append(
                NodeTestRow(
                    node_id=node_id,
                    env=env,
                    column_name=col,
                    test_name=child_id,
                    test_type="not_null",
                )
            )
        elif child_name.startswith(unique_prefix):
            col = child_name[len(unique_prefix) :]
            tests.append(
                NodeTestRow(
                    node_id=node_id,
                    env=env,
                    column_name=col,
                    test_name=child_id,
                    test_type="unique",
                )
            )
            if primary_key is None:
                primary_key = col

    return tests, primary_key


def extract_rows_from_artifacts(
    manifest: dict,
    catalog: Optional[dict],
    env: Env,
) -> tuple[list[NodeRow], list[ColumnRow], list[EdgeRow], list[NodeTestRow]]:
    """Produce flat row lists from a (manifest, catalog) pair.

    - ``manifest`` must be a raw dict (e.g. ``json.load(manifest.json)``).
    - ``catalog`` may be ``None``; when absent, all ``data_type`` are ``None``.
    - Column names come from the catalog when available; otherwise from the
      manifest's ``columns`` section (tests-as-columns).
    """
    catalog_nodes = ((catalog or {}).get("nodes") or {}) if catalog else {}
    node_rows: list[NodeRow] = []
    column_rows: list[ColumnRow] = []
    test_rows: list[NodeTestRow] = []

    for node_id, node in _iter_manifest_nodes(manifest):
        tests, primary_key = _derive_tests_and_primary_key(node_id, node, manifest, env)
        test_rows.extend(tests)

        node_rows.append(
            NodeRow(
                node_id=node_id,
                env=env,
                name=node.get("name") or "",
                resource_type=node.get("resource_type") or "",
                package_name=node.get("package_name"),
                raw_code=node.get("raw_code"),
                compiled_code=node.get("compiled_code"),
                primary_key=primary_key,
                node_json=_encode_node(node),
            )
        )

        catalog_node = catalog_nodes.get(node_id) if catalog_nodes else None
        catalog_cols = (catalog_node or {}).get("columns") or {}
        manifest_cols = node.get("columns") or {}

        # Union of catalog + manifest column names preserves ordering:
        # catalog first (dtypes authoritative), then any manifest-only cols.
        seen: set[str] = set()
        for col_name, col_info in catalog_cols.items():
            if col_name in seen:
                continue
            seen.add(col_name)
            column_rows.append(
                ColumnRow(
                    node_id=node_id,
                    env=env,
                    column_name=col_name,
                    data_type=(col_info or {}).get("type"),
                )
            )
        for col_name in manifest_cols.keys():
            if col_name in seen:
                continue
            seen.add(col_name)
            column_rows.append(ColumnRow(node_id=node_id, env=env, column_name=col_name, data_type=None))

    edge_rows: list[EdgeRow] = []
    for parent_id, children in (manifest.get("child_map") or {}).items():
        for child_id in children or []:
            edge_rows.append(EdgeRow(parent_id=parent_id, child_id=child_id, env=env))

    return node_rows, column_rows, edge_rows, test_rows
