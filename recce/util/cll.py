import hashlib
import json
import logging
import os
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import sqlglot.expressions as exp
from sqlglot import Dialect, parse_one
from sqlglot.errors import OptimizeError, SqlglotError
from sqlglot.optimizer import Scope, traverse_scope
from sqlglot.optimizer.qualify import qualify

from recce.exceptions import RecceException
from recce.models.types import CllColumn, CllColumnDep

logger = logging.getLogger("recce")

CllResult = Tuple[
    List[CllColumnDep],  # Model to column dependencies
    Dict[str, CllColumn],  # Column to column dependencies
]

_DEFAULT_DB_PATH = os.path.join(os.path.expanduser("~"), ".recce", "cll_cache.db")

# Schema version for the cache DB — bump when the table schema changes.
_CACHE_SCHEMA_VERSION = 2

# Default TTL: entries not accessed for this many seconds are evicted.
_DEFAULT_TTL_SECONDS = 7 * 24 * 3600  # 7 days


class CllCache:
    """Per-node CllData cache backed by SQLite.

    Stores the full CllData result of ``get_cll_cached()`` per node, keyed
    by a content hash of the node's inputs (node_id, raw_code, parent_list,
    column_names).  This is cross-environment: base and current share entries
    for unchanged models.

    - SQLite with WAL mode for concurrent readers.
    - TTL eviction: entries not accessed within ``ttl_seconds`` are deleted.
    - Single file at ``~/.recce/cll_cache.db`` (configurable).
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        ttl_seconds: int = _DEFAULT_TTL_SECONDS,
    ):
        self._db_path: Optional[str] = None
        self._ttl_seconds = ttl_seconds
        if db_path:
            self._db_path = db_path
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
            self._init_db()

    def _init_db(self):
        with self._connect() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS cll_node_cache ("
                "  key TEXT PRIMARY KEY,"
                "  value TEXT NOT NULL,"
                "  last_accessed REAL NOT NULL DEFAULT 0"
                ")"
            )
            conn.execute(
                "CREATE TABLE IF NOT EXISTS cache_meta ("
                "  key TEXT PRIMARY KEY,"
                "  value TEXT NOT NULL"
                ")"
            )
            conn.execute(
                "INSERT OR REPLACE INTO cache_meta (key, value) VALUES ('schema_version', ?)",
                (str(_CACHE_SCHEMA_VERSION),),
            )

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, timeout=10)
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def evict_stale(self) -> int:
        """Delete entries not accessed within the TTL. Returns count of deleted rows."""
        if not self._db_path:
            return 0
        cutoff = time.time() - self._ttl_seconds
        try:
            with self._connect() as conn:
                deleted = conn.execute(
                    "DELETE FROM cll_node_cache WHERE last_accessed > 0 AND last_accessed < ?",
                    (cutoff,),
                ).rowcount
                if deleted:
                    logger.info("[cll cache] evicted %d stale entries (TTL %dd)", deleted, self._ttl_seconds // 86400)
                return deleted
        except Exception:
            return 0

    @staticmethod
    def make_node_key(node_id: str, content_key: str) -> str:
        """Build a cache key for a per-node CllData entry."""
        h = hashlib.sha256()
        h.update(node_id.encode("utf-8"))
        h.update(content_key.encode("utf-8"))
        return h.hexdigest()

    def get_node(self, node_id: str, content_key: str) -> Optional[str]:
        """Get cached CllData JSON for a node. Returns JSON string or None."""
        if not self._db_path:
            return None
        key = self.make_node_key(node_id, content_key)
        try:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT value FROM cll_node_cache WHERE key = ?", (key,)
                ).fetchone()
            if row:
                now = time.time()
                with self._connect() as conn:
                    conn.execute(
                        "UPDATE cll_node_cache SET last_accessed = ? WHERE key = ?",
                        (now, key),
                    )
                return row[0]
        except Exception:
            pass
        return None

    def put_node(self, node_id: str, content_key: str, value_json: str):
        """Store a per-node CllData JSON entry."""
        if not self._db_path:
            return
        key = self.make_node_key(node_id, content_key)
        try:
            now = time.time()
            with self._connect() as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO cll_node_cache (key, value, last_accessed)"
                    " VALUES (?, ?, ?)",
                    (key, value_json, now),
                )
        except Exception:
            pass

    def put_nodes_batch(self, entries: List[Tuple[str, str, str]]):
        """Batch-insert per-node CllData entries. Each entry: (node_id, content_key, value_json)."""
        if not self._db_path or not entries:
            return
        now = time.time()
        try:
            with self._connect() as conn:
                conn.executemany(
                    "INSERT OR REPLACE INTO cll_node_cache (key, value, last_accessed)"
                    " VALUES (?, ?, ?)",
                    [(self.make_node_key(nid, ck), val, now) for nid, ck, val in entries],
                )
        except Exception:
            pass

    def clear(self):
        """No-op. Retained so callers (e.g. adapter.refresh) don't need changes."""

    @property
    def stats(self) -> Dict[str, int]:
        """Return count of entries in the SQLite cache."""
        if not self._db_path:
            return {"entries": 0}
        try:
            with self._connect() as conn:
                count = conn.execute("SELECT COUNT(*) FROM cll_node_cache").fetchone()[0]
            return {"entries": count}
        except Exception:
            return {"entries": 0}


def _init_cll_cache() -> CllCache:
    """Initialize the module-level CLL node cache.

    Off by default (experimental). Enable with ENABLE_CLL_CONTENT_CACHE=1
    to persist per-node CllData in SQLite (~/.recce/cll_cache.db).
    Set CLL_CACHE_DB to override the default path.

    ``recce init`` bypasses this by setting ``_cll_cache`` directly.
    """
    if os.environ.get("ENABLE_CLL_CONTENT_CACHE", "0") != "1":
        return CllCache()
    db_path = os.environ.get("CLL_CACHE_DB", _DEFAULT_DB_PATH)
    return CllCache(db_path=db_path)


# Module-level node cache shared across all calls.
_cll_cache = _init_cll_cache()


@dataclass
class CLLPerformanceTracking:
    lineage_start = None
    lineage_elapsed = None
    column_lineage_start = None
    column_lineage_elapsed = None

    total_nodes = None
    sqlglot_error_nodes = 0
    other_error_nodes = 0

    def start_lineage(self):
        self.lineage_start = time.perf_counter_ns()

    def end_lineage(self):
        if self.lineage_start is None:
            return
        self.lineage_elapsed = (time.perf_counter_ns() - self.lineage_start) / 1000000

    def start_column_lineage(self):
        self.column_lineage_start = time.perf_counter_ns()

    def end_column_lineage(self):
        if self.column_lineage_start is None:
            return
        self.column_lineage_elapsed = (time.perf_counter_ns() - self.column_lineage_start) / 1000000

    def set_total_nodes(self, total_nodes):
        self.total_nodes = total_nodes

    def increment_sqlglot_error_nodes(self):
        self.sqlglot_error_nodes += 1

    def increment_other_error_nodes(self):
        self.other_error_nodes += 1

    def to_dict(self):
        return {
            "lineage_elapsed_ms": self.lineage_elapsed,
            "column_lineage_elapsed_ms": self.column_lineage_elapsed,
            "total_nodes": self.total_nodes,
            "sqlglot_error_nodes": self.sqlglot_error_nodes,
            "other_error_nodes": self.other_error_nodes,
        }

    def reset(self):
        self.lineage_start = None
        self.lineage_elapsed = None
        self.column_lineage_start = None
        self.column_lineage_elapsed = None

        self.total_nodes = None
        self.sqlglot_error_nodes = 0
        self.other_error_nodes = 0


def _dedeup_depends_on(depends_on: List[CllColumnDep]) -> List[CllColumnDep]:
    # deduplicate the depends_on list
    dedup_set = set()
    dedup_list = []
    for col_dep in depends_on:
        node_col = col_dep.node + "." + col_dep.column
        if node_col not in dedup_set:
            dedup_list.append(col_dep)
            dedup_set.add(node_col)
    return dedup_list


def _cll_set_scope(scope: Scope, scope_cll_map: dict[Scope, CllResult]) -> CllResult:
    # model-to-column
    m2c: List[CllColumnDep] = []
    # column-to-column
    c2c_map: Dict[str, CllColumn] = {}

    for union_scope in scope.union_scopes:
        sub_scope_result = scope_cll_map.get(union_scope)
        if sub_scope_result is None:
            raise RecceException(f"Scope {union_scope} not found in scope_cll_map")
        sub_m2c, sub_c2c_map = sub_scope_result

        for k, v in sub_c2c_map.items():
            if k not in c2c_map:
                c2c_map[k] = v
            else:
                c2c_map[k].depends_on.extend(v.depends_on)
                c2c_map[k].transformation_type = "derived"

        m2c.extend(sub_m2c)
    return m2c, c2c_map


def _resolve_scope_cll(source: Scope, scope_cll_map: dict[Scope, CllResult]) -> Optional[CllResult]:
    """Look up CLL results for a scope, falling back to expression identity matching.

    For recursive CTEs, sqlglot creates a stub Scope for the self-referential
    CTE that isn't yielded by traverse_scope. This fallback matches the stub
    to the real processed scope by comparing expression objects.
    """
    result = scope_cll_map.get(source)
    if result is None:
        for processed_scope, r in scope_cll_map.items():
            if processed_scope.expression is source.expression:
                result = r
                break
    return result


def _cll_select_scope(scope: Scope, scope_cll_map: dict[Scope, CllResult]) -> CllResult:
    assert scope.expression.key == "select"

    # model-to-column
    m2c: List[CllColumnDep] = []
    # column-to-column
    c2c_map: Dict[str, CllColumn] = {}

    table_alias_map = {t.alias_or_name: t.name for t in scope.tables}
    select = scope.expression

    def source_column_dependency(ref_column: exp.Column) -> Optional[CllColumn]:
        column_name = ref_column.name
        table_name = ref_column.table if ref_column.table != "" else next(iter(table_alias_map.values()))
        source = scope.sources.get(table_name, None)  # transformation_type: exp.Table | Scope
        if isinstance(source, Scope):
            ref_cll_result = _resolve_scope_cll(source, scope_cll_map)
            if ref_cll_result is None:
                return None
            _, sub_c2c_map = ref_cll_result
            return sub_c2c_map.get(column_name)
        elif isinstance(source, exp.Table):
            return CllColumn(
                name=column_name,
                transformation_type="passthrough",
                depends_on=[CllColumnDep(node=source.name, column=column_name)],
            )
        else:
            return None

    def subquery_cll(subquery: exp.Subquery) -> Optional[CllResult]:
        select = subquery.find(exp.Select)
        if select is None:
            return None

        matched_scope = None
        for sub_scope in scope.subquery_scopes:
            if sub_scope.expression == select:
                matched_scope = sub_scope
                break
        if matched_scope is None:
            return None

        return scope_cll_map.get(matched_scope)

    for proj in scope.expression.selects:
        transformation_type = "source"
        column_depends_on: List[CllColumnDep] = []
        root = proj.this if isinstance(proj, exp.Alias) else proj
        for expression in root.walk(bfs=False):
            if isinstance(expression, exp.Column):
                ref_column_dependency = source_column_dependency(expression)
                if ref_column_dependency is not None:
                    column_depends_on.extend(ref_column_dependency.depends_on)
                    if ref_column_dependency.transformation_type == "derived":
                        transformation_type = "derived"
                    elif ref_column_dependency.transformation_type == "renamed":
                        if transformation_type == "source" or transformation_type == "passthrough":
                            transformation_type = "renamed"
                    elif ref_column_dependency.transformation_type == "passthrough":
                        if transformation_type == "source":
                            transformation_type = "passthrough"
                else:
                    column_depends_on.append(CllColumnDep(node=expression.table, column=expression.name))
                    if transformation_type == "source":
                        transformation_type = "passthrough"

            elif isinstance(expression, (exp.Paren, exp.Identifier)):
                pass
            else:
                transformation_type = "derived"

        column_depends_on = _dedeup_depends_on(column_depends_on)

        if len(column_depends_on) == 0 and transformation_type != "source":
            transformation_type = "source"

        if isinstance(proj, exp.Alias):
            alias = proj
            if transformation_type == "passthrough" and column_depends_on[0].column != alias.alias_or_name:
                transformation_type = "renamed"

        c2c_map[proj.alias_or_name] = CllColumn(
            name=proj.alias_or_name, transformation_type=transformation_type, depends_on=column_depends_on
        )

    def selected_column_dependency(ref_column: exp.Column) -> Optional[CllColumn]:
        column_name = ref_column.name
        return c2c_map.get(column_name)

    # joins clause: Reference the source columns
    if select.args.get("joins"):
        joins = select.args.get("joins")
        for join in joins:
            if isinstance(join, exp.Join):
                for ref_column in join.find_all(exp.Column):
                    if source_column_dependency(ref_column) is not None:
                        m2c.extend(source_column_dependency(ref_column).depends_on)

    # where clauses: Reference the source columns
    if select.args.get("where"):
        where = select.args.get("where")
        if isinstance(where, exp.Where):
            for ref_column in where.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    m2c.extend(source_column_dependency(ref_column).depends_on)
            for subquery in where.find_all(exp.Subquery):
                sub_cll = subquery_cll(subquery)
                if sub_cll is not None:
                    sub_m2c, sub_c2c_map = sub_cll
                    m2c.extend(sub_m2c)
                    for sub_c in sub_c2c_map.values():
                        m2c.extend(sub_c.depends_on)

    # group by clause: Reference the source columns, column index
    if select.args.get("group"):
        group = select.args.get("group")
        if isinstance(group, exp.Group):
            for ref_column in group.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    m2c.extend(source_column_dependency(ref_column).depends_on)

    # having clause: Reference the source columns, selected columns
    if select.args.get("having"):
        having = select.args.get("having")
        if isinstance(having, exp.Having):
            for ref_column in having.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    m2c.extend(source_column_dependency(ref_column).depends_on)
                elif selected_column_dependency(ref_column) is not None:
                    m2c.extend(selected_column_dependency(ref_column).depends_on)
            for subquery in having.find_all(exp.Subquery):
                sub_cll = subquery_cll(subquery)
                if sub_cll is not None:
                    sub_m2c, sub_c2c_map = sub_cll
                    m2c.extend(sub_m2c)
                    for sub_c in sub_c2c_map.values():
                        m2c.extend(sub_c.depends_on)

    # order by clause: Reference the source columns, selected columns, column index
    if select.args.get("order"):
        order = select.args.get("order")
        if isinstance(order, exp.Order):
            for ref_column in order.find_all(exp.Column):
                if source_column_dependency(ref_column) is not None:
                    m2c.extend(source_column_dependency(ref_column).depends_on)
                elif selected_column_dependency(ref_column) is not None:
                    m2c.extend(selected_column_dependency(ref_column).depends_on)

    for source in scope.sources.values():
        if not isinstance(source, Scope):
            continue
        scope_cll_result = _resolve_scope_cll(source, scope_cll_map)
        if scope_cll_result is None:
            continue
        sub_m2c, _ = scope_cll_result
        m2c.extend(sub_m2c)

    m2c = _dedeup_depends_on(m2c)

    return m2c, c2c_map


def cll(sql, schema=None, dialect=None) -> CllResult:
    """Compute column-level lineage from SQL using sqlglot."""
    t_start = time.perf_counter()
    dialect = Dialect.get(dialect) if dialect is not None else None

    try:
        expression = parse_one(sql, dialect=dialect)
    except SqlglotError as e:
        raise RecceException(f"Failed to parse SQL: {str(e)}")

    try:
        expression = qualify(expression, schema=schema, dialect=dialect)
    except OptimizeError as e:
        raise RecceException(f"Failed to optimize SQL: {str(e)}")
    except SqlglotError as e:
        raise RecceException(f"Failed to qualify SQL: {str(e)}")

    result = None
    scope_cll_map = {}
    for scope in traverse_scope(expression):
        scope_type = scope.expression.key
        if scope_type == "union" or scope_type == "intersect" or scope_type == "except":
            result = _cll_set_scope(scope, scope_cll_map)
        elif scope_type == "select":
            result = _cll_select_scope(scope, scope_cll_map)
        else:
            continue

        scope_cll_map[scope] = result

    if result is None:
        raise RecceException("Failed to extract CLL from SQL")

    elapsed_ms = (time.perf_counter() - t_start) * 1000
    if elapsed_ms > 100:
        logger.info("[cll] computed in %.1fms (sql length=%d)", elapsed_ms, len(sql))

    return result


def get_cll_cache() -> CllCache:
    """Access the module-level CLL cache (for stats/clearing)."""
    return _cll_cache
