import hashlib
import json
import logging
import os
import sqlite3
import time
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import sqlglot
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


_ERROR_MARKER = "__error__"

_DEFAULT_DB_PATH = os.path.join(os.path.expanduser("~"), ".recce", "cll_cache.db")

# Schema version for the cache DB — bump when the table schema changes.
_CACHE_SCHEMA_VERSION = 1

# Default TTL: entries not accessed for this many seconds are evicted.
_DEFAULT_TTL_SECONDS = 7 * 24 * 3600  # 7 days


def _current_sqlglot_version() -> str:
    return sqlglot.__version__


class CllCache:
    """Content-addressed cache for CLL results, backed by SQLite.

    Keyed by hash of (sql, dialect) so that identical compiled SQL reuses
    results across environments and across server restarts.

    - In-memory dict for fast lookups within a session.
    - SQLite database for disk persistence — survives restarts, supports
      concurrent readers (WAL mode), and stores everything in a single file.
    - Cache versioning: entries are tagged with the sqlglot version that
      produced them.  On version mismatch the entry is treated as a miss
      and recomputed.
    - TTL eviction: entries not accessed within ``ttl_seconds`` are deleted
      on startup (``evict_stale``).
    """

    _SENTINEL = object()

    def __init__(
        self,
        db_path: Optional[str] = None,
        ttl_seconds: int = _DEFAULT_TTL_SECONDS,
    ):
        self._mem: Dict[str, object] = {}
        self._hits = 0
        self._misses = 0
        self._db_path: Optional[str] = None
        self._ttl_seconds = ttl_seconds
        self._sqlglot_version = _current_sqlglot_version()
        if db_path:
            self._db_path = db_path
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
            self._init_db()

    def _init_db(self):
        with self._connect() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS cll_cache ("
                "  key TEXT PRIMARY KEY,"
                "  value TEXT NOT NULL,"
                "  sqlglot_version TEXT NOT NULL DEFAULT '',"
                "  last_accessed REAL NOT NULL DEFAULT 0"
                ")"
            )
            # Migrate: add columns if upgrading from older schema
            self._migrate(conn)
            # Store metadata
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

    def _migrate(self, conn: sqlite3.Connection):
        """Add columns that may be missing from an older cache DB."""
        columns = {row[1] for row in conn.execute("PRAGMA table_info(cll_cache)").fetchall()}
        if "sqlglot_version" not in columns:
            conn.execute("ALTER TABLE cll_cache ADD COLUMN sqlglot_version TEXT NOT NULL DEFAULT ''")
        if "last_accessed" not in columns:
            conn.execute("ALTER TABLE cll_cache ADD COLUMN last_accessed REAL NOT NULL DEFAULT 0")

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
                cursor = conn.execute(
                    "DELETE FROM cll_cache WHERE last_accessed > 0 AND last_accessed < ?",
                    (cutoff,),
                )
                deleted = cursor.rowcount
                if deleted:
                    logger.info("[cll cache] evicted %d stale entries (TTL %dd)", deleted, self._ttl_seconds // 86400)
                return deleted
        except Exception:
            return 0

    @staticmethod
    def _make_key(sql: str, dialect: Optional[str]) -> str:
        h = hashlib.sha256()
        h.update(sql.encode("utf-8"))
        if dialect is not None:
            h.update(str(dialect).encode("utf-8"))
        return h.hexdigest()

    @staticmethod
    def _serialize(result: CllResult) -> str:
        m2c, c2c_map = result
        return json.dumps({
            "m2c": [dep.model_dump() for dep in m2c],
            "c2c": {name: col.model_dump() for name, col in c2c_map.items()},
        })

    @staticmethod
    def _deserialize(data_str: str) -> CllResult:
        data = json.loads(data_str)
        m2c = [CllColumnDep(**d) for d in data["m2c"]]
        c2c_map = {name: CllColumn(**d) for name, d in data["c2c"].items()}
        return m2c, c2c_map

    def get(self, sql: str, dialect: Optional[str]) -> object:
        """Returns CllResult, raises cached exception, or returns _SENTINEL on miss."""
        key = self._make_key(sql, dialect)

        # Check in-memory first
        entry = self._mem.get(key, self._SENTINEL)
        if entry is not self._SENTINEL:
            self._hits += 1
            if isinstance(entry, str) and entry == _ERROR_MARKER:
                raise RecceException("CLL computation failed (cached)")
            return deepcopy(entry)

        # Check SQLite
        if self._db_path:
            try:
                now = time.time()
                with self._connect() as conn:
                    row = conn.execute(
                        "SELECT value, sqlglot_version FROM cll_cache WHERE key = ?", (key,)
                    ).fetchone()
                if row:
                    data = json.loads(row[0])
                    if data.get("status") == "error":
                        self._mem[key] = _ERROR_MARKER
                        self._hits += 1
                        # Touch last_accessed
                        with self._connect() as conn:
                            conn.execute(
                                "UPDATE cll_cache SET last_accessed = ? WHERE key = ?",
                                (now, key),
                            )
                        raise RecceException("CLL computation failed (cached)")
                    result = self._deserialize(row[0])
                    self._mem[key] = result
                    self._hits += 1
                    # Touch last_accessed
                    with self._connect() as conn:
                        conn.execute(
                            "UPDATE cll_cache SET last_accessed = ? WHERE key = ?",
                            (now, key),
                        )
                    return deepcopy(result)
            except RecceException:
                raise
            except Exception:
                pass  # corrupted entry, treat as miss

        self._misses += 1
        return self._SENTINEL

    def put(self, sql: str, dialect: Optional[str], result: CllResult):
        key = self._make_key(sql, dialect)
        self._mem[key] = deepcopy(result)
        if self._db_path:
            try:
                value = self._serialize(result)
                now = time.time()
                with self._connect() as conn:
                    conn.execute(
                        "INSERT OR REPLACE INTO cll_cache (key, value, sqlglot_version, last_accessed)"
                        " VALUES (?, ?, ?, ?)",
                        (key, value, self._sqlglot_version, now),
                    )
            except Exception:
                pass  # disk write failure is non-fatal

    def put_error(self, sql: str, dialect: Optional[str], error: Exception):
        key = self._make_key(sql, dialect)
        self._mem[key] = _ERROR_MARKER
        if self._db_path:
            try:
                value = json.dumps({"status": "error", "message": str(error)})
                now = time.time()
                with self._connect() as conn:
                    conn.execute(
                        "INSERT OR REPLACE INTO cll_cache (key, value, sqlglot_version, last_accessed)"
                        " VALUES (?, ?, ?, ?)",
                        (key, value, self._sqlglot_version, now),
                    )
            except Exception:
                pass

    def clear(self):
        self._mem.clear()
        self._hits = 0
        self._misses = 0
        # Note: does NOT delete SQLite rows — they may be shared across instances

    @property
    def stats(self) -> Dict[str, int]:
        total = self._hits + self._misses
        return {
            "hits": self._hits,
            "misses": self._misses,
            "total": total,
            "hit_rate_pct": round(self._hits / total * 100, 1) if total > 0 else 0,
            "size": len(self._mem),
        }


def _init_cll_cache() -> CllCache:
    """Initialize the CLL cache with SQLite persistence if configured.

    Off by default (experimental). Enable with ENABLE_CLL_CONTENT_CACHE=1.
    Set CLL_CACHE_DB to override the default path (~/.recce/cll_cache.db).
    """
    if os.environ.get("ENABLE_CLL_CONTENT_CACHE", "0") != "1":
        return CllCache()
    db_path = os.environ.get("CLL_CACHE_DB", _DEFAULT_DB_PATH)
    return CllCache(db_path=db_path)


# Module-level cache shared across all calls
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


def _is_content_cache_enabled() -> bool:
    # Cache is off by default (experimental). Enable with ENABLE_CLL_CONTENT_CACHE=1.
    return os.environ.get("ENABLE_CLL_CONTENT_CACHE", "0") == "1"


def _normalize_sql_for_cache(expression: exp.Expression, dialect=None) -> str:
    """Strip database and schema qualifiers from Table and Column nodes.

    CLL depends on table names and column names, not on which database or
    schema they live in.  Normalizing lets base and current environments
    share cache entries when the SQL logic is identical but the fully-
    qualified paths differ (e.g. ``db.schema.table`` vs ``table``).

    Operates on a *copy* so the original AST is not mutated.
    """
    tree = expression.copy()
    for node in tree.walk(bfs=False):
        if isinstance(node, (exp.Table, exp.Column)):
            node.set("db", None)
            node.set("catalog", None)
    return tree.sql(dialect=dialect)


def cll(sql, schema=None, dialect=None) -> CllResult:
    t_start = time.perf_counter()
    dialect = Dialect.get(dialect) if dialect is not None else None
    dialect_str = str(dialect) if dialect is not None else None

    cache_enabled = _is_content_cache_enabled()
    cache_key_sql = sql  # default; replaced with normalized version after parse

    # For unparseable SQL, check cache with raw SQL to return cached errors.
    try:
        expression = parse_one(sql, dialect=dialect)
    except SqlglotError as e:
        if cache_enabled:
            cached = _cll_cache.get(sql, dialect_str)
            if cached is not CllCache._SENTINEL:
                return cached  # pragma: no cover — raises cached RecceException
        exc = RecceException(f"Failed to parse SQL: {str(e)}")
        if cache_enabled:
            _cll_cache.put_error(sql, dialect_str, exc)
        raise exc

    # Use normalized SQL (without db/schema qualifiers) as the cache key
    # so that base and current environments share entries.
    if cache_enabled:
        cache_key_sql = _normalize_sql_for_cache(expression, dialect=dialect)
        cached = _cll_cache.get(cache_key_sql, dialect_str)
        if cached is not CllCache._SENTINEL:
            return cached

    try:
        expression = qualify(expression, schema=schema, dialect=dialect)
    except OptimizeError as e:
        exc = RecceException(f"Failed to optimize SQL: {str(e)}")
        if cache_enabled:
            _cll_cache.put_error(cache_key_sql, dialect_str, exc)
        raise exc
    except SqlglotError as e:
        exc = RecceException(f"Failed to qualify SQL: {str(e)}")
        if cache_enabled:
            _cll_cache.put_error(cache_key_sql, dialect_str, exc)
        raise exc

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
        exc = RecceException("Failed to extract CLL from SQL")
        if cache_enabled:
            _cll_cache.put_error(cache_key_sql, dialect_str, exc)
        raise exc

    elapsed_ms = (time.perf_counter() - t_start) * 1000
    if elapsed_ms > 100:
        logger.info("[cll] computed in %.1fms (sql length=%d)", elapsed_ms, len(sql))

    if cache_enabled:
        _cll_cache.put(cache_key_sql, dialect_str, result)
    return result


def get_cll_cache() -> CllCache:
    """Access the module-level CLL cache (for stats/clearing)."""
    return _cll_cache
