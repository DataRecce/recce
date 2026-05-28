"""Paired column-distribution task — DuckDB-only ``approx_all`` pipeline (DRC-3390 Stage B).

The pipeline shape is locked by DRC-3389's benchmark findings: six SQL
queries total, sketch-based, no sampling, no CTAS. Per-engine SQL fragment
rendering lives in :mod:`recce.adapter.approx_aggregates`. Per-engine
capability detection lives in :mod:`recce.adapter.capabilities`. This module
is the orchestration layer that composes them.

**Stage B scope (DuckDB-only):** the strategy router collapses to two
branches — ``approx_all`` (DuckDB) and ``unsupported`` (everything else).
The ``'percentile_only'`` tier and all non-DuckDB top-K shape handling
(Snowflake pairs, BigQuery / Databricks structs, Trino map) live in Stage D.

Phases per env (base + current), 6 queries total::

    1. Schema introspection                — free (from manifest/catalog)
    2. Batched APPROX_COUNT_DISTINCT       — base + current  (2 queries)
    3. Batched APPROX_PERCENTILE           — base + current  (2 queries)
    4. Batched APPROX_TOP_K                — base + current  (2 queries)

Bakes in two prototype-bug fixes:
* DRC-3504 — timestamp histogram cast: classify the column as datetime
  BEFORE rendering the percentile fragment and apply DuckDB's ``epoch()``
  conversion. The prototype used ``cast(col as decimal(28,6))`` which
  DuckDB rejected for ``TIMESTAMP``.
* DRC-3507 — DuckDB rollback on per-column failure: on any per-column
  exception, issue an explicit ROLLBACK so the connection isn't stuck in
  aborted-txn state for subsequent queries.

In-memory memoization is keyed by ``(model_unique_id, manifest_hash,
version_token)`` so repeated PROFILE_DISTRIBUTION runs against an
unchanged model/version pair return the cached payload. Cache lives in
the run-result store on the active :class:`RecceContext`.

Telemetry: ``log_performance("profile_distribution", {strategy,
total_wall_ms, phase_wall_ms, column_count, error_count, cache_hit})``
on every execute. Spec at DRC-3390 "telemetry" row.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel

from recce.adapter.approx_aggregates import (
    UnsupportedAggregateError,
    render_approx_count_distinct,
    render_approx_percentile,
    render_approx_top_k,
)
from recce.adapter.capabilities import AdapterCapabilities, detect_capabilities
from recce.core import default_context
from recce.event import log_performance
from recce.tasks import Task

logger = logging.getLogger("uvicorn")


# ---------------------------------------------------------------------------
# Frozen contract — payload schemas (do not change without coordinating with
# Stage C and updating the spec in DRC-3390).
# ---------------------------------------------------------------------------

# Quantile binning, rendered per-env. Each env's histogram is built on ITS
# OWN quantile edges: ``NUM_BINS - 1`` inner cuts plus the empirical min/max
# fences give ``NUM_BINS + 1`` edges and ``NUM_BINS`` bins, each holding
# ``1 / NUM_BINS`` of that env's rows. The density of a bin is therefore
# ``(1 / NUM_BINS) / bin_width`` — narrow bands (data concentrated) read tall,
# wide bands (data sparse) read short, and every bar carries equal *area*
# (= row-share). This is the only assumption-free rendering of percentile-only
# data: we get back approx quantiles, not bin counts, so we cannot measure an
# env's mass in some *other* env's bins.
#
# Base and current edges are emitted SEPARATELY (``base_bin_edges`` /
# ``current_bin_edges``) and intentionally do NOT line up — averaging them onto
# a shared grid would collapse both densities to an identical curve and break
# the equal-area property. Stage C overlays the two staircases on a shared
# value axis. See PR #1398 / DRC-3390 for the contract rationale.
NUM_BINS = 11  # NUM_BINS bins per env → NUM_BINS + 1 edges, NUM_BINS densities
QUANTILE_FRACTIONS: Tuple[float, ...] = tuple(round(i / NUM_BINS, 6) for i in range(1, NUM_BINS))
# (0.0909…, 0.1818…, …, 0.9090…) — 10 inner cuts between min and max.

TOP_K_DEFAULT = 12  # matches the prototype + frontend cell width budget

# DRC-3389 finding: skip top-K on columns where HLL estimate ≥ 0.95 × rows.
# Such columns are effectively unique and a top-K view is uninformative.
CAP_DEGENERATE_RATIO = 0.95


# ---------------------------------------------------------------------------
# Pydantic params + result kinds
# ---------------------------------------------------------------------------


class ProfileDistributionParams(BaseModel):
    """Input parameters for the profile-distribution task."""

    model: str
    columns: Optional[List[str]] = None


# ---------------------------------------------------------------------------
# Strategy router
# ---------------------------------------------------------------------------


def pick_strategy(capabilities: AdapterCapabilities) -> str:
    """Map :class:`AdapterCapabilities` to one of two strategy strings.

    ``approx_all``: HLL probe + APPROX_PERCENTILE + APPROX_TOP_K, all native.
    ``unsupported``: feature unavailable — a single envelope is returned
    instead of per-column payloads.

    Stage B intentionally collapses the GA matrix to these two tiers. Stage D
    will reintroduce ``percentile_only`` for Redshift (and any other adapter
    with percentiles but no top-K). See DRC-3390 adapter coverage tier table
    for the GA mapping.
    """
    if capabilities.has_approx_percentile and capabilities.has_approx_top_k:
        return "approx_all"
    return "unsupported"


# ---------------------------------------------------------------------------
# Per-adapter top-K post-processor
#
# Stage B: DuckDB returns flat ``[value, …]`` with no counts; that's the only
# branch we support here. We cannot recover counts from the SQL response
# itself — a second pass query could compute exact counts, but Stage B keeps
# the 6-query budget. Frontend treats ``counts == None`` as "trim to value-only
# rendering" (that detail is in Stage C).
#
# Stage D will restore the per-adapter shape switch (Snowflake pairs,
# BigQuery / Databricks structs, Trino map).
# ---------------------------------------------------------------------------


def _unwrap_array_value(raw: Any) -> Any:
    """Best-effort: turn whatever an adapter returned for an ARRAY/LIST
    column into a Python list.

    dbt-duckdb returns ``LIST<…>`` columns as JSON-encoded strings (e.g.
    ``'["a", "b", "c"]'``). This helper is the one place that knows about
    that shape so the rest of the post-processing logic can assume "iterable
    of items."
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        s = raw.strip()
        # dbt-duckdb wraps ARRAY/LIST columns as a JSON-encoded string at the
        # cursor boundary; the only safe parse is ``json.loads``. If parsing
        # fails (because the adapter actually returned a plain string), fall
        # back to the original value.
        if s.startswith("[") or s.startswith("{"):
            try:
                return json.loads(s)
            except (ValueError, TypeError):
                return raw
    return raw


def parse_topk_result(adapter_type: Optional[str], raw: Any) -> Tuple[List[Any], Optional[List[int]]]:
    """Normalize an adapter's raw ``APPROX_TOP_K``-style result.

    Returns ``(values, counts)``. For DuckDB ``counts`` is always ``None``
    because DuckDB's ``approx_top_k`` returns values only.

    Stage B is DuckDB-only. Non-DuckDB adapter types raise :class:`ValueError`
    — the strategy router short-circuits before this code runs for them, but
    the raise is a defense-in-depth backstop. Stage D will restore the
    per-adapter shape switch.

    Strict about what it expects: if DuckDB returns ``None`` (e.g., a row
    with all-NULL data), returns ``([], None)`` rather than raising — empty
    top-K is a valid payload meaning "this column had nothing to rank."
    """
    raw = _unwrap_array_value(raw)
    if raw is None:
        return [], None

    db = (adapter_type or "").lower()

    # DuckDB: flat ``[value, …]`` — no counts. (Stage D restores other adapters.)
    if db == "duckdb":
        return list(raw or []), None

    raise ValueError(f"parse_topk_result: adapter type {adapter_type!r} is not supported in Stage B")


# ---------------------------------------------------------------------------
# Column type classification
# ---------------------------------------------------------------------------

# Lower-cased substrings (so ``decimal(28,6)`` matches ``decimal``).
NUMERIC_TYPE_TOKENS = (
    "int",
    "bigint",
    "smallint",
    "tinyint",
    "decimal",
    "numeric",
    "number",
    "double",
    "float",
    "real",
    "money",
)

DATETIME_TYPE_TOKENS = (
    "date",
    "timestamp",
    "datetime",
    "time",
)

# Types we should *not* attempt — distribution is undefined or extremely
# expensive (blob/JSON/struct columns are skipped at the schema phase).
SKIPPED_TYPE_TOKENS = (
    "json",
    "struct",
    "array",
    "map",
    "binary",
    "blob",
    "geography",
    "geometry",
    "variant",
    "object",
)


def classify_column_type(column_type: Optional[str]) -> str:
    """Return one of ``'numeric' | 'datetime' | 'categorical' | 'skip'``.

    Used to decide whether a column ends up in the percentile batch (numeric
    or datetime — both go through histograms) or the top-K batch
    (categorical text/boolean).
    """
    if not column_type:
        return "skip"
    t = column_type.lower()
    if any(tok in t for tok in SKIPPED_TYPE_TOKENS):
        return "skip"
    # Datetime check first — "date" is a substring of nothing else important
    # but "time" overlaps with nothing we care about here.
    if any(t.startswith(tok) or f" {tok}" in t for tok in DATETIME_TYPE_TOKENS):
        return "datetime"
    if any(tok in t for tok in NUMERIC_TYPE_TOKENS):
        return "numeric"
    return "categorical"


def render_epoch_cast(adapter_type: Optional[str], column_expr: str) -> str:
    """Return SQL that converts a datetime column to a numeric epoch (seconds).

    Bakes in the DRC-3504 fix. The prototype used
    ``cast(col as decimal(28,6))`` which DuckDB rejected for ``TIMESTAMP``.
    DuckDB's in-SQL conversion is ``epoch(col)``. Apply this BEFORE handing
    the expression to the percentile renderer.

    Stage B: DuckDB only. Non-DuckDB adapter types raise :class:`ValueError`;
    Stage D will restore Snowflake / BigQuery / Databricks / Spark / Trino /
    Athena / Presto / ClickHouse / Redshift epoch conversions.
    """
    db = (adapter_type or "").lower()
    if db == "duckdb":
        return f"epoch({column_expr})"
    raise ValueError(f"render_epoch_cast: adapter type {adapter_type!r} is not supported in Stage B")


# ---------------------------------------------------------------------------
# Memoization
# ---------------------------------------------------------------------------


def _get_cache() -> Dict[Tuple[str, str, str], Dict[str, Any]]:
    """Return the in-memory profile-distribution cache attached to the context.

    The cache is created lazily on first access. Lives for the lifetime of
    the active RecceContext; per DRC-3390 GA scope, file-backed persistence
    is intentionally out of scope.
    """
    ctx = default_context()
    if ctx is None:
        # Test contexts that never call set_default_context — fall back to
        # a module-level dict. Tests should clean it up themselves.
        return _fallback_cache
    cache = getattr(ctx, "_profile_distribution_cache", None)
    if cache is None:
        cache = {}
        setattr(ctx, "_profile_distribution_cache", cache)
    return cache


# Module-level fallback for contexts where ``default_context()`` returns
# None (e.g., a freshly constructed task in a unit test). Tests reset this
# explicitly.
_fallback_cache: Dict[Tuple[str, str, str], Dict[str, Any]] = {}


def _manifest_hash(dbt_adapter, base: bool) -> str:
    """Stable hash for the manifest in a given env.

    Uses ``manifest.metadata.generated_at`` if present, falling back to
    ``id(manifest)`` — the cache key only needs to invalidate on artifact
    refresh, which always rotates ``generated_at``.
    """
    try:
        manifest = dbt_adapter.curr_manifest if not base else dbt_adapter.base_manifest
        gen_at = getattr(manifest.metadata, "generated_at", None)
        if gen_at is not None:
            return hashlib.md5(str(gen_at).encode("utf-8")).hexdigest()
    except Exception:
        pass
    return f"id-{id(dbt_adapter)}"


def _cache_key(model: str, dbt_adapter, columns: Optional[List[str]]) -> Tuple[str, str, str]:
    """Compute ``(model_unique_id, manifest_hash, version_token)``.

    ``version_token`` distinguishes runs that differ only by their selected
    columns subset — caching the full-model run shouldn't be served when a
    sub-column run is requested.
    """
    base_hash = _manifest_hash(dbt_adapter, base=True)
    curr_hash = _manifest_hash(dbt_adapter, base=False)
    combined = f"{base_hash}:{curr_hash}"
    cols_token = ",".join(sorted(columns)) if columns else "*"
    version_token = hashlib.md5(cols_token.encode("utf-8")).hexdigest()
    return (model, combined, version_token)


# ---------------------------------------------------------------------------
# Result-payload builders
# ---------------------------------------------------------------------------


def _env_edges_and_density(
    quantile_values: List[float],
    min_value: Optional[float],
    max_value: Optional[float],
) -> Tuple[List[float], List[float]]:
    """Build one env's ``(bin_edges, density)`` from its own quantiles.

    Edges are this env's empirical ``min`` + its inner quantile values +
    ``max``; each gap holds the cumulative-fraction delta between the
    quantiles that bound it (``1 / NUM_BINS`` in the normal full-quantile
    case). Density = ``Δfraction / bin_width`` so bar *area* reads as
    row-share. A zero (or negative, from sketch noise) width or fraction
    delta emits ``0.0`` — a heavily-tied column collapses adjacent quantiles
    onto the same value, which we surface as an empty bin rather than an
    infinite spike.

    Returns ``([], [])`` when the env has no usable bounds (all-NULL column).
    """
    if min_value is None or max_value is None:
        return [], []

    # Pair each present quantile value with its cumulative fraction, bracketed
    # by the min (fraction 0.0) and max (fraction 1.0) fences.
    points: List[Tuple[float, float]] = [(float(min_value), 0.0)]
    for frac, v in zip(QUANTILE_FRACTIONS, quantile_values or []):
        if v is not None:
            points.append((float(v), float(frac)))
    points.append((float(max_value), 1.0))

    # Sort by value — out-of-order quantiles from sketch noise would otherwise
    # produce negative bin widths. Fractions ride along so the per-bin Δfraction
    # is computed against the (possibly reordered) neighbours.
    points.sort(key=lambda p: p[0])

    edges: List[float] = [p[0] for p in points]
    density: List[float] = []
    for i in range(len(edges) - 1):
        width = edges[i + 1] - edges[i]
        dfrac = points[i + 1][1] - points[i][1]
        if width <= 0 or dfrac <= 0:
            density.append(0.0)
        else:
            density.append(dfrac / width)
    return edges, density


def _build_histogram_payload(
    quantile_values_base: List[float],
    quantile_values_current: List[float],
    base_total: int,
    current_total: int,
    base_min: Optional[float],
    base_max: Optional[float],
    current_min: Optional[float],
    current_max: Optional[float],
) -> Dict[str, Any]:
    """Compose the locked ``kind: histogram`` payload for a single column.

    Base and current each get their OWN edge array built from their OWN
    quantiles (see :func:`_env_edges_and_density`). The two staircases are
    rendered overlaid on a shared value axis by Stage C but their edges
    deliberately do NOT line up — this is the equal-area, percentile-only
    rendering locked in PR #1398. ``base_bin_edges`` and ``current_bin_edges``
    each hold ``NUM_BINS + 1`` values; the paired density arrays hold
    ``NUM_BINS`` each (one per bin). An env with no data yields empty arrays
    for that side while keeping the ``kind`` tag.
    """
    base_edges, base_density = _env_edges_and_density(quantile_values_base, base_min, base_max)
    current_edges, current_density = _env_edges_and_density(quantile_values_current, current_min, current_max)

    return {
        "kind": "histogram",
        "base_bin_edges": base_edges,
        "current_bin_edges": current_edges,
        "base_density": base_density,
        "current_density": current_density,
        "base_total": int(base_total or 0),
        "current_total": int(current_total or 0),
    }


def _build_topk_payload(
    base_values: List[Any],
    base_counts: Optional[List[int]],
    current_values: List[Any],
    current_counts: Optional[List[int]],
    k: int,
) -> Dict[str, Any]:
    """Compose the locked ``kind: topk`` payload for a single column.

    Aligns ``base`` and ``current`` onto a unified value-axis so Stage C can
    render gap-on-absent semantics. ``trimmed`` tells Stage C whether either
    env had more values than fit in the top-K slice.
    """
    # Union of value sets, preserving order from current-then-base (mirrors
    # the prototype's "what's important now" frame).
    seen: Dict[Any, int] = {}
    for v in current_values or []:
        if v not in seen:
            seen[v] = len(seen)
    for v in base_values or []:
        if v not in seen:
            seen[v] = len(seen)
    union = list(seen.keys())[:k]

    base_index = {v: i for i, v in enumerate(base_values or [])}
    curr_index = {v: i for i, v in enumerate(current_values or [])}

    # Two distinct semantics for ``None`` in the aligned counts list:
    # * The adapter's sketch returned no counts at all (DuckDB in Stage B)
    #   — the WHOLE side is None. Stage C renders rank-only with no bar
    #   heights.
    # * Stage D will add adapters that *do* return counts (Snowflake /
    #   BigQuery); in that case None on a slot means "this value isn't in
    #   this env's top-K" and Stage C draws the gap-on-absent marker.
    base_aligned: Optional[List[Optional[int]]]
    curr_aligned: Optional[List[Optional[int]]]
    if base_counts is None:
        base_aligned = None
    else:
        base_aligned = []
        for v in union:
            if v in base_index:
                base_aligned.append(int(base_counts[base_index[v]]))
            else:
                base_aligned.append(None)
    if current_counts is None:
        curr_aligned = None
    else:
        curr_aligned = []
        for v in union:
            if v in curr_index:
                curr_aligned.append(int(current_counts[curr_index[v]]))
            else:
                curr_aligned.append(None)

    # ``trimmed`` answers "did either env hit the sketch's k cap?" — i.e. the
    # underlying domain had more distinct values than we asked for. We can't
    # see "what got dropped" from the SQL response alone; checking whether
    # either env hit exactly ``k`` is the cheap proxy that matches Stage C's
    # rendering needs (it draws the "+more" marker on a trimmed cell).
    trimmed = (len(current_values or []) >= k) or (len(base_values or []) >= k)

    return {
        "kind": "topk",
        "values": union,
        "base_counts": base_aligned,
        "current_counts": curr_aligned,
        "trimmed": trimmed,
    }


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------


class ProfileDistributionTask(Task):
    """Paired column-distribution backend (DRC-3390 Stage B, DuckDB-only)."""

    def __init__(self, params):
        super().__init__()
        self.params = ProfileDistributionParams(**params)
        self.connection = None

    # -- Public entrypoint --------------------------------------------------

    def execute(self) -> Dict[str, Any]:
        from recce.adapter.dbt_adapter import DbtAdapter

        dbt_adapter: DbtAdapter = default_context().adapter
        adapter_type = dbt_adapter.adapter.type().lower()
        capabilities = detect_capabilities(adapter_type)
        strategy = pick_strategy(capabilities)

        wall_start = time.perf_counter()
        phase_wall: Dict[str, float] = {}
        error_count = 0

        # Unsupported tier: short-circuit with a single envelope per the
        # frozen payload contract.
        if strategy == "unsupported":
            elapsed_ms = int((time.perf_counter() - wall_start) * 1000)
            _emit_telemetry(strategy, elapsed_ms, phase_wall, 0, 0, cache_hit=False)
            return {
                "status": "unsupported",
                "reason": f"Adapter {adapter_type!r} does not support APPROX_PERCENTILE.",
                "columns": {},
            }

        # Memoization check.
        cache = _get_cache()
        key = _cache_key(self.params.model, dbt_adapter, self.params.columns)
        if key in cache:
            elapsed_ms = int((time.perf_counter() - wall_start) * 1000)
            _emit_telemetry(strategy, elapsed_ms, phase_wall, 0, 0, cache_hit=True)
            # Return a shallow copy so callers can't mutate the cache by
            # accident.
            cached = cache[key]
            return {**cached, "cache_hit": True}

        # ---------- Phase 1: schema introspection ----------
        t0 = time.perf_counter()
        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()

            try:
                base_cols = dbt_adapter.get_columns(self.params.model, base=True)
            except Exception:
                base_cols = []
            try:
                curr_cols = dbt_adapter.get_columns(self.params.model, base=False)
            except Exception:
                curr_cols = []

            # Use current env as the source-of-truth column list; fall back
            # to base if current is empty.
            source_cols = curr_cols or base_cols
            column_records: List[Tuple[str, str, str]] = []  # (name, type, classification)
            selected = set(self.params.columns) if self.params.columns else None
            for c in source_cols:
                name = getattr(c, "name", None) or getattr(c, "column", None)
                if not name:
                    continue
                if selected is not None and name not in selected:
                    continue
                dtype = (getattr(c, "dtype", None) or getattr(c, "data_type", None) or "").lower()
                cls = classify_column_type(dtype)
                if cls == "skip":
                    continue
                column_records.append((name, dtype, cls))
            phase_wall["schema_ms"] = (time.perf_counter() - t0) * 1000

            if not column_records:
                elapsed_ms = int((time.perf_counter() - wall_start) * 1000)
                payload = {"status": "ok", "strategy": strategy, "columns": {}}
                cache[key] = payload
                _emit_telemetry(strategy, elapsed_ms, phase_wall, 0, 0, cache_hit=False)
                return payload

            base_relation = dbt_adapter.create_relation(self.params.model, base=True)
            curr_relation = dbt_adapter.create_relation(self.params.model, base=False)

            # ---------- Phase 2: HLL probe + row count ----------
            t0 = time.perf_counter()
            base_card, base_total, base_min_max, p2_errs = self._probe_phase(
                dbt_adapter, adapter_type, base_relation, column_records, base=True
            )
            curr_card, curr_total, curr_min_max, p2_errs_c = self._probe_phase(
                dbt_adapter, adapter_type, curr_relation, column_records, base=False
            )
            error_count += p2_errs + p2_errs_c
            phase_wall["probe_ms"] = (time.perf_counter() - t0) * 1000

            # Dispatch columns into continuous (percentile) vs categorical
            # (top-K) bins. ``cap_degenerate`` rule: if HLL ≥ 0.95 × rows,
            # the column is effectively unique — emit an empty top-K slot
            # rather than wasting the sketch.
            continuous: List[Tuple[str, str, str]] = []  # (name, type, epoch_expr_flag)
            categorical: List[Tuple[str, str]] = []
            degenerate: List[str] = []
            for name, dtype, cls in column_records:
                if cls in {"numeric", "datetime"}:
                    continuous.append((name, dtype, cls))
                else:  # categorical
                    # Cap-degenerate: use the larger of the two env cardinalities
                    # against the larger row count; we want to skip top-K when
                    # *either* env is effectively unique.
                    card = max(base_card.get(name, 0) or 0, curr_card.get(name, 0) or 0)
                    total = max(base_total or 0, curr_total or 0)
                    if total > 0 and card >= CAP_DEGENERATE_RATIO * total:
                        degenerate.append(name)
                    else:
                        categorical.append((name, dtype))

            # ---------- Phase 3: APPROX_PERCENTILE per env ----------
            t0 = time.perf_counter()
            base_pct, p3_errs = self._percentile_phase(dbt_adapter, adapter_type, base_relation, continuous, base=True)
            curr_pct, p3_errs_c = self._percentile_phase(
                dbt_adapter, adapter_type, curr_relation, continuous, base=False
            )
            error_count += p3_errs + p3_errs_c
            phase_wall["percentile_ms"] = (time.perf_counter() - t0) * 1000

            # ---------- Phase 4: APPROX_TOP_K per env ----------
            t0 = time.perf_counter()
            base_topk, p4_errs = self._topk_phase(dbt_adapter, adapter_type, base_relation, categorical, base=True)
            curr_topk, p4_errs_c = self._topk_phase(dbt_adapter, adapter_type, curr_relation, categorical, base=False)
            error_count += p4_errs + p4_errs_c
            phase_wall["topk_ms"] = (time.perf_counter() - t0) * 1000

        # ---------- Assemble per-column payloads ----------
        columns: Dict[str, Dict[str, Any]] = {}

        for name, dtype, cls in continuous:
            try:
                base_min, base_max = base_min_max.get(name, (None, None))
                curr_min, curr_max = curr_min_max.get(name, (None, None))
                columns[name] = _build_histogram_payload(
                    quantile_values_base=base_pct.get(name, []),
                    quantile_values_current=curr_pct.get(name, []),
                    base_total=base_total or 0,
                    current_total=curr_total or 0,
                    base_min=base_min,
                    base_max=base_max,
                    current_min=curr_min,
                    current_max=curr_max,
                )
            except Exception:
                logger.debug("profile_distribution: failed to assemble histogram for %s", name, exc_info=True)
                error_count += 1
                columns[name] = {"kind": None}

        for name, dtype in categorical:
            try:
                bv, bc = base_topk.get(name, ([], None))
                cv, cc = curr_topk.get(name, ([], None))
                columns[name] = _build_topk_payload(bv, bc, cv, cc, TOP_K_DEFAULT)
            except Exception:
                logger.debug("profile_distribution: failed to assemble topk for %s", name, exc_info=True)
                error_count += 1
                columns[name] = {"kind": None}

        # ``cap_degenerate`` columns get an explicit empty top-K slot, so
        # the frontend knows to render the "effectively unique" tag rather
        # than treating the column as "no data."
        for name in degenerate:
            columns[name] = {
                "kind": "topk",
                "values": [],
                "base_counts": [],
                "current_counts": [],
                "trimmed": False,
            }

        result = {
            "status": "ok",
            "strategy": strategy,
            "columns": columns,
            "base_total": int(base_total or 0),
            "current_total": int(curr_total or 0),
        }

        # Stash in cache and emit telemetry.
        cache[key] = result
        total_ms = int((time.perf_counter() - wall_start) * 1000)
        _emit_telemetry(strategy, total_ms, phase_wall, len(column_records), error_count, cache_hit=False)
        return result

    # -- Phase implementations ---------------------------------------------

    def _probe_phase(
        self,
        dbt_adapter,
        adapter_type: str,
        relation,
        column_records: List[Tuple[str, str, str]],
        base: bool,
    ) -> Tuple[Dict[str, int], int, Dict[str, Tuple[Any, Any]], int]:
        """One batched SELECT producing per-column HLL + row-count + min/max.

        Returns ``(per_column_cardinality, total_rows, per_column_min_max,
        error_count)``. Min/max come along for free (it's one ``MIN(col)``
        + ``MAX(col)`` per column in the same SELECT) and feed the
        histogram bin-edge envelope.
        """
        if relation is None:
            return {}, 0, {}, 1

        fragments: List[str] = ["count(*) as __row_count__"]
        for name, dtype, cls in column_records:
            quoted = self._quote(dbt_adapter, name)
            try:
                hll_frag = render_approx_count_distinct(adapter_type, quoted)
            except UnsupportedAggregateError:
                # Shouldn't reach here — pick_strategy already rules out
                # adapters without HLL — but guard for defense in depth.
                continue
            fragments.append(f"{hll_frag} as {self._alias(name, 'hll')}")
            # Min/max for the envelope. Wrap datetime columns in the epoch
            # cast so the values fed to the histogram are numeric — this is
            # the *value* side of the DRC-3504 fix.
            if cls == "datetime":
                expr = render_epoch_cast(adapter_type, quoted)
                fragments.append(f"min({expr}) as {self._alias(name, 'min')}")
                fragments.append(f"max({expr}) as {self._alias(name, 'max')}")
            elif cls == "numeric":
                fragments.append(f"min({quoted}) as {self._alias(name, 'min')}")
                fragments.append(f"max({quoted}) as {self._alias(name, 'max')}")

        sql = "select " + ", ".join(fragments) + f" from {relation}"

        rows = self._execute_with_rollback(dbt_adapter, sql)
        if rows is None or not rows or not rows[0]:
            return {}, 0, {}, 1

        row = rows[0]
        col_names = self._row_column_names(rows)

        # Build a value-by-alias lookup.
        by_alias: Dict[str, Any] = {}
        for idx, alias in enumerate(col_names):
            by_alias[alias.lower()] = row[idx]

        total = int(by_alias.get("__row_count__", 0) or 0)
        per_card: Dict[str, int] = {}
        per_min_max: Dict[str, Tuple[Any, Any]] = {}
        for name, dtype, cls in column_records:
            hll_alias = self._alias(name, "hll").lower()
            if hll_alias in by_alias:
                v = by_alias[hll_alias]
                try:
                    per_card[name] = int(v) if v is not None else 0
                except (TypeError, ValueError):
                    per_card[name] = 0
            if cls in {"numeric", "datetime"}:
                mn = by_alias.get(self._alias(name, "min").lower())
                mx = by_alias.get(self._alias(name, "max").lower())
                per_min_max[name] = (mn, mx)

        return per_card, total, per_min_max, 0

    def _percentile_phase(
        self,
        dbt_adapter,
        adapter_type: str,
        relation,
        continuous: List[Tuple[str, str, str]],
        base: bool,
    ) -> Tuple[Dict[str, List[float]], int]:
        """One batched SELECT producing per-column APPROX_PERCENTILE arrays.

        Per-column failure isolation: if the batched SELECT fails entirely,
        retry each column in isolation so one bad column doesn't blank the
        whole env. The DRC-3507 fix (explicit ROLLBACK in
        ``_execute_with_rollback``) makes the per-column retries safe.
        """
        if relation is None or not continuous:
            return {}, 0

        # Compose per-column percentile fragments. Datetime columns get the
        # epoch cast (DRC-3504 fix). Aliases are deterministic so we can map
        # them back to column names.
        fragments: List[str] = []
        for name, dtype, cls in continuous:
            quoted = self._quote(dbt_adapter, name)
            expr = render_epoch_cast(adapter_type, quoted) if cls == "datetime" else quoted
            try:
                frag = render_approx_percentile(adapter_type, expr, QUANTILE_FRACTIONS)
            except UnsupportedAggregateError:
                continue
            fragments.append(f"{frag} as {self._alias(name, 'pct')}")

        if not fragments:
            return {}, 0

        sql = "select " + ", ".join(fragments) + f" from {relation}"
        rows = self._execute_with_rollback(dbt_adapter, sql)

        if rows is None:
            # Whole batch failed — retry per column so one bad column doesn't
            # tank the rest. DRC-3507's ROLLBACK has already been issued by
            # _execute_with_rollback for DuckDB; safe to issue more.
            per_col: Dict[str, List[float]] = {}
            errs = 0
            for name, dtype, cls in continuous:
                quoted = self._quote(dbt_adapter, name)
                expr = render_epoch_cast(adapter_type, quoted) if cls == "datetime" else quoted
                try:
                    frag = render_approx_percentile(adapter_type, expr, QUANTILE_FRACTIONS)
                except UnsupportedAggregateError:
                    continue
                single = "select " + f"{frag} as {self._alias(name, 'pct')}" + f" from {relation}"
                r = self._execute_with_rollback(dbt_adapter, single)
                if r is None or not r:
                    errs += 1
                    continue
                per_col[name] = _coerce_percentile_array(adapter_type, r[0][0])
            return per_col, errs

        if not rows or not rows[0]:
            return {}, 1

        row = rows[0]
        col_names = self._row_column_names(rows)
        by_alias: Dict[str, Any] = {a.lower(): row[i] for i, a in enumerate(col_names)}

        per_col = {}
        for name, dtype, cls in continuous:
            v = by_alias.get(self._alias(name, "pct").lower())
            per_col[name] = _coerce_percentile_array(adapter_type, v)
        return per_col, 0

    def _topk_phase(
        self,
        dbt_adapter,
        adapter_type: str,
        relation,
        categorical: List[Tuple[str, str]],
        base: bool,
    ) -> Tuple[Dict[str, Tuple[List[Any], Optional[List[int]]]], int]:
        """One batched SELECT producing per-column APPROX_TOP_K results."""
        if relation is None or not categorical:
            return {}, 0

        fragments: List[str] = []
        for name, dtype in categorical:
            quoted = self._quote(dbt_adapter, name)
            try:
                frag = render_approx_top_k(adapter_type, quoted, TOP_K_DEFAULT)
            except UnsupportedAggregateError:
                continue
            fragments.append(f"{frag} as {self._alias(name, 'topk')}")

        if not fragments:
            return {}, 0

        sql = "select " + ", ".join(fragments) + f" from {relation}"
        rows = self._execute_with_rollback(dbt_adapter, sql)

        if rows is None:
            # Per-column retry. Same rationale as the percentile phase.
            per_col: Dict[str, Tuple[List[Any], Optional[List[int]]]] = {}
            errs = 0
            for name, dtype in categorical:
                quoted = self._quote(dbt_adapter, name)
                try:
                    frag = render_approx_top_k(adapter_type, quoted, TOP_K_DEFAULT)
                except UnsupportedAggregateError:
                    continue
                single = "select " + f"{frag} as {self._alias(name, 'topk')}" + f" from {relation}"
                r = self._execute_with_rollback(dbt_adapter, single)
                if r is None or not r:
                    errs += 1
                    continue
                per_col[name] = parse_topk_result(adapter_type, r[0][0])
            return per_col, errs

        if not rows or not rows[0]:
            return {}, 1

        row = rows[0]
        col_names = self._row_column_names(rows)
        by_alias: Dict[str, Any] = {a.lower(): row[i] for i, a in enumerate(col_names)}

        per_col = {}
        for name, dtype in categorical:
            raw = by_alias.get(self._alias(name, "topk").lower())
            per_col[name] = parse_topk_result(adapter_type, raw)
        return per_col, 0

    # -- Helpers -----------------------------------------------------------

    @staticmethod
    def _alias(column_name: str, suffix: str) -> str:
        """Build a deterministic, SQL-safe alias.

        Collapses non-alphanumerics to underscores so quoting/case-folding
        in the warehouse can't lose the round trip. Suffix disambiguates
        per-phase aggregations.
        """
        safe = "".join(ch if ch.isalnum() else "_" for ch in column_name)
        # Hash the original for collision safety on heavily-symbol-bearing
        # column names. The hash isn't trying to be cryptographically
        # secure — it just keeps two columns from aliasing onto each other.
        h = hashlib.md5(column_name.encode("utf-8")).hexdigest()[:8]
        return f"pd_{safe}_{h}_{suffix}"

    @staticmethod
    def _quote(dbt_adapter, column_name: str) -> str:
        """Quote a column name using the adapter's quoting rules."""
        try:
            return dbt_adapter.adapter.quote(column_name)
        except Exception:
            # Fallback to ANSI double-quote.
            return f'"{column_name}"'

    @staticmethod
    def _row_column_names(rows) -> List[str]:
        """Pull column names off whatever shape ``execute`` returned.

        ``dbt_adapter.execute(sql, fetch=True)`` returns ``(response, table)``
        where ``table`` is an agate Table. We pass ``rows`` here after the
        unwrap — when present, it's an agate Table; when missing, callers
        produce a list of tuples.
        """
        try:
            return list(rows.column_names)
        except AttributeError:
            # In retry paths we hand back tuples from a manual fetch — but
            # those only arise in unit tests with synthetic rows; production
            # paths always go through ``dbt_adapter.execute``.
            return []

    def _execute_with_rollback(self, dbt_adapter, sql: str):
        """Execute ``sql`` and, on failure, issue a defensive ROLLBACK.

        Bakes in the DRC-3507 fix: on DuckDB, a failed query leaves the
        connection in aborted-txn state. Without an explicit ROLLBACK,
        every subsequent query in the same connection fails with
        ``TransactionContext Error``. We catch any per-statement exception,
        log it, attempt to rollback, and return ``None`` so the caller can
        fall back to per-column retries.

        Returns the agate Table on success, ``None`` on failure.
        """
        self.check_cancel()
        try:
            _, table = dbt_adapter.execute(sql, fetch=True)
            return table
        except Exception as e:
            logger.debug("profile_distribution: batched SQL failed; rolling back: %s", e)
            try:
                # DRC-3507 fix: explicit ROLLBACK so the connection is usable
                # for the next query. Wrapped in its own try/except because
                # the connection layout differs across adapters and we don't
                # want a missing handle to mask the original error.
                conn = dbt_adapter.adapter.connections.get_thread_connection()
                cursor = conn.handle.cursor()
                cursor.execute("ROLLBACK")
            except Exception:
                # No-op rollback failures are expected on some adapters
                # (e.g., BigQuery, which has no transactional state).
                pass
            return None

    def cancel(self):
        super().cancel()
        if self.connection:
            from recce.adapter.dbt_adapter import DbtAdapter

            dbt_adapter: DbtAdapter = default_context().adapter
            try:
                with dbt_adapter.connection_named("cancel"):
                    dbt_adapter.cancel(self.connection)
            except Exception:
                logger.debug("profile_distribution: cancel failed", exc_info=True)


# ---------------------------------------------------------------------------
# Module-level helpers (kept out of the class for testability)
# ---------------------------------------------------------------------------


def _coerce_percentile_array(adapter_type: Optional[str], raw: Any) -> List[float]:
    """Normalize an adapter's percentile aggregate return to a flat list of floats.

    Stage B: DuckDB returns a ``LIST`` (encoded as a JSON string at the cursor
    boundary, which :func:`_unwrap_array_value` handles). The result is a flat
    list of floats with one entry per requested quantile. Stage D will add
    BigQuery's 101-element slicing and any other dialect-specific coercions.
    """
    raw = _unwrap_array_value(raw)
    if raw is None:
        return []

    # DuckDB: list-like with one entry per quantile.
    try:
        return [float(v) for v in raw if v is not None]
    except (TypeError, ValueError):
        return []


def _emit_telemetry(
    strategy: str,
    total_wall_ms: int,
    phase_wall_ms: Dict[str, float],
    column_count: int,
    error_count: int,
    cache_hit: bool,
) -> None:
    """Emit an Amplitude ``[Performance] profile_distribution`` event.

    Failures here are swallowed — telemetry is best-effort and must never
    take down a user-facing run.
    """
    try:
        log_performance(
            "profile_distribution",
            {
                "strategy": strategy,
                "total_wall_ms": total_wall_ms,
                "phase_wall_ms": {k: int(v) for k, v in phase_wall_ms.items()},
                "column_count": column_count,
                "error_count": error_count,
                "cache_hit": cache_hit,
            },
        )
    except Exception:
        logger.debug("profile_distribution: telemetry emit failed", exc_info=True)
