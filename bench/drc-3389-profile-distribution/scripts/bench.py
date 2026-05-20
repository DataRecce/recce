"""
Benchmark harness for ProfileDistributionTask (DRC-3389).

Runs the task against the duckdb wide_synth fixture and emits:
  - total wall time
  - per-column wall time, broken down by phase (probe / topk / histogram)
  - query count, total SQL time
  - result CSV: one row per (column, phase) in results/

Usage (from repo root):
    python bench/drc-3389-profile-distribution/scripts/bench.py
    python bench/drc-3389-profile-distribution/scripts/bench.py --strategy baseline
    python bench/drc-3389-profile-distribution/scripts/bench.py --strategy baseline --rows 100000

Re-runs the fixture if --rows differs from the materialized table.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shlex
import subprocess
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

# Make repo root importable so 'recce' resolves.
SCRIPT_DIR = Path(__file__).resolve().parent
BENCH_DIR = SCRIPT_DIR.parent
RESULTS_DIR = BENCH_DIR / "results"
REPO_ROOT = BENCH_DIR.parent.parent
sys.path.insert(0, str(REPO_ROOT))

# Set via --target flag. DBT_DIR is the project root that dbt should use; the
# adapter type is just for switching SQL dialect details (sample syntax).
DBT_DIR = BENCH_DIR / "dbt"
ADAPTER_KIND = "duckdb"  # 'duckdb' | 'snowflake'


@dataclass
class PhaseTiming:
    column: str
    phase: str  # 'probe' | 'topk' | 'histogram'
    wall_s: float
    sql_count: int = 0
    sql_s: float = 0.0
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BenchResult:
    strategy: str
    rows: int
    drift: float
    total_wall_s: float
    total_sql_s: float
    total_sql_count: int
    columns_total: int
    columns_topk: int
    columns_histogram: int
    columns_null: int
    timings: List[PhaseTiming] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"strategy={self.strategy}  rows={self.rows}  drift={self.drift}\n"
            f"  wall: {self.total_wall_s:.2f}s  sql: {self.total_sql_s:.2f}s ({self.total_sql_count} queries)\n"
            f"  cols: {self.columns_total} total | "
            f"{self.columns_topk} topk, {self.columns_histogram} histogram, {self.columns_null} null"
        )


# --------------------------------------------------------------------- fixture

def fixture_row_count() -> Optional[int]:
    # Snowflake: rely on the user to set up the fixture manually with the
    # setup_fixture_sf.sh script before running bench. We don't auto-check
    # row count because that itself costs a warehouse query.
    if ADAPTER_KIND == "snowflake":
        return None
    db = DBT_DIR / "perf_bench.duckdb"
    if not db.exists():
        return None
    import duckdb
    try:
        con = duckdb.connect(str(db), read_only=True)
        return con.execute("select count(*) from dev_current.wide_synth").fetchone()[0]
    except Exception:
        return None


def rebuild_fixture(rows: int, drift: float) -> None:
    if ADAPTER_KIND == "snowflake":
        raise RuntimeError(
            "Snowflake fixture must be set up manually with "
            "`scripts/setup_fixture_sf.sh` (sources env.sh + runs dbt). "
            "Skipping auto-rebuild."
        )
    env = os.environ.copy()
    env["WIDE_ROWS"] = str(rows)
    env["WIDE_DRIFT"] = str(drift)
    subprocess.run(
        [str(SCRIPT_DIR / "setup_fixture.sh")],
        check=True,
        env=env,
    )


# --------------------------------------------------------------------- timing

class TaskTimer:
    """Wraps ProfileDistributionTask methods to record per-column phase timings.

    Patching happens at instance level so each bench run is isolated.
    """

    def __init__(self, task):
        self.task = task
        self.timings: List[PhaseTiming] = []
        # Per-phase SQL accumulators populated by the wrapped dbt_adapter.execute.
        self._current_phase: Optional[str] = None
        self._current_column: Optional[str] = None
        self._sql_count_phase = 0
        self._sql_s_phase = 0.0

    def install(self, dbt_adapter) -> None:
        # Wrap adapter.execute so we can count queries + per-phase SQL time.
        # Also: on DuckDB, any error inside an open txn leaves the connection
        # in an aborted state and every later query fails with "Transaction is
        # aborted." The prototype task catches the Python exception but doesn't
        # ROLLBACK. We add a defensive rollback here so per-column timings
        # reflect real work, not cascading rollback-required noise. (Itself a
        # finding for DRC-3389 — the prototype is robustness-broken on DuckDB.)
        orig_exec = dbt_adapter.execute

        def _execute(sql, *a, **kw):
            t0 = time.perf_counter()
            try:
                return orig_exec(sql, *a, **kw)
            except Exception:
                # Clear duckdb's aborted-txn state. The wrapped connection has
                # no .rollback() but a no-op query on a fresh cursor resets it.
                try:
                    conn = dbt_adapter.adapter.connections.get_thread_connection()
                    cur = conn.handle.cursor()
                    cur.execute("ROLLBACK")
                except Exception:
                    pass
                raise
            finally:
                dt = time.perf_counter() - t0
                if self._current_phase is not None:
                    self._sql_count_phase += 1
                    self._sql_s_phase += dt

        dbt_adapter.execute = _execute

        # Wrap the three internal methods to bracket phases.
        for phase, method_name in (
            ("probe", "_probe_distinct_count"),
            ("topk", "_query_topk"),
            ("histogram", "_query_histogram"),
        ):
            original = getattr(self.task, method_name)
            setattr(self.task, method_name, self._wrap(phase, original))

    def _wrap(self, phase: str, fn: Callable) -> Callable:
        timer = self

        def wrapped(dbt_adapter, *args, **kwargs):
            # Column name is the third positional arg for all three of these
            # methods (after dbt_adapter and at least one relation arg).
            column = next(
                (a for a in args if isinstance(a, str) and not a.startswith("<")),
                "?",
            )
            timer._current_phase = phase
            timer._current_column = column
            timer._sql_count_phase = 0
            timer._sql_s_phase = 0.0
            t0 = time.perf_counter()
            try:
                return fn(dbt_adapter, *args, **kwargs)
            finally:
                dt = time.perf_counter() - t0
                timer.timings.append(
                    PhaseTiming(
                        column=column,
                        phase=phase,
                        wall_s=dt,
                        sql_count=timer._sql_count_phase,
                        sql_s=timer._sql_s_phase,
                    )
                )
                timer._current_phase = None

        return wrapped


# --------------------------------------------------------------------- runners

def load_context():
    from recce.core import RecceContext, set_default_context

    # cwd stays in DBT_DIR for the lifetime of the run — the duckdb file path
    # in profiles.yml is relative.
    os.chdir(DBT_DIR)
    ctx = RecceContext.load(
        target_path="target",
        target_base_path="target-base",
    )
    set_default_context(ctx)
    return ctx


def _run_with(task, ctx, strategy_name: str, rows: int, drift: float) -> BenchResult:
    """Common runner: install timer, execute task, summarize result."""
    timer = TaskTimer(task)
    timer.install(ctx.adapter)
    t0 = time.perf_counter()
    out = task.execute()
    wall = time.perf_counter() - t0
    cols = out["columns"]
    topk = sum(1 for v in cols.values() if v and v.get("kind") == "topk")
    histogram = sum(1 for v in cols.values() if v and v.get("kind") == "histogram")
    null_cols = sum(1 for v in cols.values() if v is None)
    return BenchResult(
        strategy=strategy_name,
        rows=rows,
        drift=drift,
        total_wall_s=wall,
        total_sql_s=sum(t.sql_s for t in timer.timings),
        total_sql_count=sum(t.sql_count for t in timer.timings),
        columns_total=len(cols),
        columns_topk=topk,
        columns_histogram=histogram,
        columns_null=null_cols,
        timings=timer.timings,
    ), out


def run_baseline(rows: int, drift: float):
    from recce.tasks import ProfileDistributionTask

    ctx = load_context()
    task = ProfileDistributionTask({"model": "wide_synth"})
    return _run_with(task, ctx, "baseline", rows, drift)


def _probe_row_count(ctx) -> int:
    """One COUNT(*) on the current relation. Uses create_relation so the
    adapter (duckdb / snowflake) resolves the fully-qualified table name."""
    full_curr = ctx.adapter.create_relation("wide_synth", base=False)
    with ctx.adapter.adapter.connection_named("probe-rowcount"):
        _, t = ctx.adapter.execute(
            f"select count(*) from {full_curr}", fetch=True
        )
        return int(t.rows[0][0])


def run_cap_degenerate(rows: int, drift: float, cap_threshold: Optional[int] = None):
    """Skip topk when distinct >= cap_threshold.

    Default cap = row_count - 1 (only catches effectively-unique columns, the
    'degenerate' case). Lower thresholds (e.g. 500, 100) catch more columns;
    used for sensitivity analysis.
    """
    from recce.tasks import ProfileDistributionTask

    ctx = load_context()
    task = ProfileDistributionTask({"model": "wide_synth"})
    row_count = _probe_row_count(ctx)
    if cap_threshold is None:
        cap_threshold = row_count - 1

    orig_probe = task._probe_distinct_count

    def patched_probe(dbt_adapter, relation, column_name):
        d = orig_probe(dbt_adapter, relation, column_name)
        task._last_distinct = d
        return d

    task._probe_distinct_count = patched_probe

    orig_topk = task._query_topk

    def topk_guarded(dbt_adapter, base_rel, curr_rel, column_name, *a, **kw):
        d = getattr(task, "_last_distinct", None)
        if d is not None and d >= cap_threshold:
            return ([], [], [], 0, 0, False, None)
        return orig_topk(dbt_adapter, base_rel, curr_rel, column_name, *a, **kw)

    task._query_topk = topk_guarded

    label = f"cap_{cap_threshold}"
    result, out = _run_with(task, ctx, label, rows, drift)
    result.columns_null = sum(
        1 for v in out["columns"].values()
        if v and v.get("kind") == "topk" and not v.get("values")
    )
    result.columns_topk -= result.columns_null
    return result, out


def _materialize_samples(ctx, sample_k: int, method: str = "bernoulli", total_rows: Optional[int] = None) -> None:
    """Create `wide_synth__sample` tables alongside both relations.

    method:
      - "bernoulli" (default): true uniform row-level sampling. Full table scan.
        sample_k = exact row count target.
      - "block": block / system sampling. Reads whole micro-partitions.
        sample_k is converted to a percentage given total_rows.
        FAST but biased on sorted/clustered data — included for the bias
        demonstration, not as a recommended default.
    """
    full_base = ctx.adapter.create_relation("wide_synth", base=True)
    full_curr = ctx.adapter.create_relation("wide_synth", base=False)
    samp_base = full_base.replace_path(identifier="wide_synth__sample")
    samp_curr = full_curr.replace_path(identifier="wide_synth__sample")

    if method == "bernoulli":
        if ADAPTER_KIND == "duckdb":
            sample_clause = f"using sample {sample_k} rows"
        elif ADAPTER_KIND == "snowflake":
            sample_clause = f"sample ({sample_k} rows)"
        else:
            raise RuntimeError(f"unknown ADAPTER_KIND={ADAPTER_KIND}")
    elif method == "block":
        if total_rows is None:
            total_rows = sample_k * 100  # default to 1%
        pct = max(0.1, 100.0 * sample_k / total_rows)
        if ADAPTER_KIND == "duckdb":
            # 'system' mode is duckdb's block-level sampler
            sample_clause = f"using sample {pct} percent (system)"
        elif ADAPTER_KIND == "snowflake":
            sample_clause = f"sample block ({pct})"
        else:
            raise RuntimeError(f"unknown ADAPTER_KIND={ADAPTER_KIND}")
    else:
        raise RuntimeError(f"unknown sample method={method}")

    with ctx.adapter.adapter.connection_named("sample-build"):
        for src, dst in ((full_base, samp_base), (full_curr, samp_curr)):
            sql = f"create or replace table {dst} as select * from {src} {sample_clause}"
            ctx.adapter.execute(sql, fetch=False)


def run_sample(rows: int, drift: float, sample_k: int = 50_000):
    """Replace both relations with sampled materialized tables.

    Sampling covers probe + bounds + counts (every adapter call). For accuracy
    the visual chart shape is what matters — distinct count and min/max become
    approximations but the histogram/topk shape carries.
    """
    from recce.tasks import ProfileDistributionTask

    ctx = load_context()
    _materialize_samples(ctx, sample_k)

    task = ProfileDistributionTask({"model": "wide_synth"})

    # Patch create_relation to redirect to the sampled table.
    orig_create = ctx.adapter.create_relation

    def patched_create(model, base=False):
        rel = orig_create(model, base=base)
        if rel is None:
            return None
        # BaseRelation has .include() / .render() — easiest is to manipulate its
        # identifier directly. dbt Relation is a frozen dataclass so use .replace.
        return rel.replace_path(identifier="wide_synth__sample")

    ctx.adapter.create_relation = patched_create

    result, out = _run_with(task, ctx, f"sample_{sample_k}", rows, drift)
    return result, out


def run_parallel(rows: int, drift: float, workers: int = 8):
    """Run the per-column phase loop on a thread pool.

    Each worker uses its own `connection_named` to avoid stepping on shared
    cursor state. DuckDB benefit is bounded (single-process); the big upside
    is Snowflake-style adapters where round-trips dominate.
    """
    import concurrent.futures
    from recce.tasks import ProfileDistributionTask

    ctx = load_context()

    # Subclass to override execute(): keep all the per-column logic, but
    # dispatch each column through a worker pool. We have to rebuild the
    # column iteration because the prototype's execute() is sequential.

    class ParallelProfileDistributionTask(ProfileDistributionTask):
        def execute(self):
            from recce.adapter.dbt_adapter import DbtAdapter

            dbt_adapter: DbtAdapter = ctx.adapter
            model = self.params.model
            low_card = self.params.low_card_threshold or 30
            topk_limit = self.params.topk_limit or 12
            num_bins = self.params.histogram_bins or 18

            with dbt_adapter.connection_named("query-coord"):
                base_relation = dbt_adapter.create_relation(model, base=True)
                curr_relation = dbt_adapter.create_relation(model, base=False)
                curr_cols = {c.name: c for c in dbt_adapter.get_columns(model, base=False)}
                base_cols = {c.name: c for c in dbt_adapter.get_columns(model, base=True)}

            all_names = list({*curr_cols.keys(), *base_cols.keys()})

            from recce.tasks.profile_distribution import _classify_column_type

            def process(name: str):
                col = curr_cols.get(name) or base_cols.get(name)
                if col is None:
                    return name, None
                present_base = name in base_cols
                present_curr = name in curr_cols
                kind = _classify_column_type((col.data_type or "").lower())
                if kind == "other":
                    return name, None
                # Each worker uses its own connection.
                with dbt_adapter.connection_named(f"col-{name}"):
                    try:
                        probe_rel = curr_relation if present_curr else base_relation
                        distinct = self._probe_distinct_count(dbt_adapter, probe_rel, name)
                    except Exception:
                        return name, None
                    use_topk = (
                        kind == "boolean"
                        or kind == "string"
                        or (distinct is not None and distinct <= low_card)
                    )
                    try:
                        if use_topk:
                            (values, b, c, bt, ct, trimmed, _) = self._query_topk(
                                dbt_adapter, base_relation, curr_relation, name,
                                topk_limit, present_base, present_curr,
                            )
                            return name, {
                                "kind": "topk", "values": values,
                                "base_counts": b, "current_counts": c,
                                "base_total": bt, "current_total": ct,
                                "trimmed": trimmed,
                            }
                        else:
                            histo = self._query_histogram(
                                dbt_adapter, base_relation, curr_relation, name,
                                num_bins, present_base, present_curr,
                            )
                            if histo is None:
                                return name, None
                            edges, b, c, bt, ct = histo
                            return name, {
                                "kind": "histogram",
                                "bin_edges": [float(e) if e is not None else None for e in edges],
                                "base_counts": b, "current_counts": c,
                                "base_total": bt, "current_total": ct,
                            }
                    except Exception:
                        return name, None

            distributions: Dict[str, Any] = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
                for name, dist in ex.map(process, all_names):
                    distributions[name] = dist
            return {"columns": distributions}

    task = ParallelProfileDistributionTask({"model": "wide_synth"})
    return _run_with(task, ctx, f"parallel_{workers}", rows, drift)


def run_cap_plus_sample(rows: int, drift: float, sample_k: int = 10_000):
    """cap_degenerate (skip distinct==N cols) + sample (K rows for non-probe).

    Probe runs on FULL table for accurate distinct counts; topk/histogram run
    on sampled tables for cost savings; degenerate columns short-circuit.
    """
    from recce.tasks import ProfileDistributionTask

    ctx = load_context()
    _materialize_samples(ctx, sample_k)

    task = ProfileDistributionTask({"model": "wide_synth"})
    row_count = _probe_row_count(ctx)

    # Pre-build the sampled relations once so we can swap them into topk/histo
    # without disrupting the full-table relations used for probing.
    full_base = ctx.adapter.create_relation("wide_synth", base=True)
    full_curr = ctx.adapter.create_relation("wide_synth", base=False)
    samp_base = full_base.replace_path(identifier="wide_synth__sample")
    samp_curr = full_curr.replace_path(identifier="wide_synth__sample")

    orig_probe = task._probe_distinct_count

    def patched_probe(dbt_adapter, relation, column_name):
        # Probe always against the full table for true distinct counts.
        d = orig_probe(dbt_adapter, full_curr, column_name)
        task._last_distinct = d
        return d

    task._probe_distinct_count = patched_probe

    orig_topk = task._query_topk
    orig_hist = task._query_histogram

    def topk_sampled(dbt_adapter, base_rel, curr_rel, column_name, *a, **kw):
        d = getattr(task, "_last_distinct", None)
        if d is not None and d >= row_count - 1:
            return ([], [], [], 0, 0, False, None)
        return orig_topk(dbt_adapter, samp_base, samp_curr, column_name, *a, **kw)

    def hist_sampled(dbt_adapter, base_rel, curr_rel, column_name, *a, **kw):
        return orig_hist(dbt_adapter, samp_base, samp_curr, column_name, *a, **kw)

    task._query_topk = topk_sampled
    task._query_histogram = hist_sampled

    result, out = _run_with(task, ctx, f"cap+sample_{sample_k}", rows, drift)
    result.columns_null = sum(
        1 for v in out["columns"].values()
        if v and v.get("kind") == "topk" and not v.get("values")
    )
    result.columns_topk -= result.columns_null
    return result, out


def run_approx_all(rows: int, drift: float):
    """All-approximate: HLL probe + APPROX_PERCENTILE state-based histogram +
    APPROX_TOP_K. No sampling, no CTAS. Snowflake-only syntax for now.

    Six queries total: schema introspection (free) + probe + percentile×2 envs +
    topk×2 envs. The pattern eliminates sample materialization entirely; the
    sketch-based aggregates stream over the full table efficiently.

    Histogram output uses quantile-based bin edges (non-uniform widths, 5% per
    bin). The paired chart visualization changes from "varying heights, fixed
    edges" to "fixed heights, varying edges" — frontend must adapt to render.
    """
    if ADAPTER_KIND != "snowflake":
        raise NotImplementedError("approx_all is Snowflake-only for now (uses APPROX_PERCENTILE_ACCUMULATE/_ESTIMATE)")

    from recce.tasks.profile_distribution import _classify_column_type

    ctx = load_context()
    dbt_adapter = ctx.adapter

    timings: List[PhaseTiming] = []
    def phase(name, fn):
        t0 = time.perf_counter()
        result = fn()
        dt = time.perf_counter() - t0
        timings.append(PhaseTiming(column="(batch)", phase=name, wall_s=dt, sql_count=1, sql_s=dt))
        return result

    wall_t0 = time.perf_counter()

    # Schema
    base_rel, curr_rel, curr_cols, base_cols = phase(
        "schema",
        lambda: _schema_intro(dbt_adapter),
    )
    all_names = sorted(set(curr_cols) | set(base_cols))

    # Classify
    col_kind = {}
    for n in all_names:
        col = curr_cols.get(n) or base_cols.get(n)
        col_kind[n] = _classify_column_type((col.data_type or "").lower())
    topk_cols = [n for n in all_names if col_kind[n] in ("boolean", "string")]
    hist_cols = [n for n in all_names if col_kind[n] in ("numeric", "datetime")]

    def quote(c): return f'"{c}"'

    def num_expr(c):
        """For percentile aggregations: timestamps need epoch conversion."""
        if col_kind.get(c) == "datetime":
            return f"date_part(epoch_second, {quote(c)})"
        return quote(c)

    # Five SQL phases (probe + percentile×2 + topk×2) — all independent, fire concurrently.
    pcts = [round(0.10 * i, 2) for i in range(0, 11)]  # 0, 0.10, ..., 1.0 (11 edges → 10 bins)

    def probe():
        sel = ", ".join(f'approx_count_distinct({quote(c)}) as dc{i}' for i, c in enumerate(all_names))
        with dbt_adapter.adapter.connection_named("approx-probe"):
            _, t = dbt_adapter.execute(f"select count(*) as rc, {sel} from {curr_rel}", fetch=True)
        rc = int(t.rows[0][0])
        d = {all_names[i]: int(t.rows[0][i+1] or 0) for i in range(len(all_names))}
        return rc, d

    def percentiles_for(rel):
        if not hist_cols:
            return {}
        states = ", ".join(f'approx_percentile_accumulate({num_expr(c)}) as s{i:02d}' for i, c in enumerate(hist_cols))
        estimates = []
        for i, c in enumerate(hist_cols):
            for j, p in enumerate(pcts):
                estimates.append(f"approx_percentile_estimate(s{i:02d}, {p}) as p{i:02d}_{j:02d}")
        sql = f"with sk as (select {states} from {rel}) select {', '.join(estimates)} from sk"
        with dbt_adapter.adapter.connection_named(f"approx-pct-{id(rel)}"):
            _, t = dbt_adapter.execute(sql, fetch=True)
        out = {}
        idx = 0
        for i, c in enumerate(hist_cols):
            edges = [float(t.rows[0][idx + j]) if t.rows[0][idx + j] is not None else None for j in range(len(pcts))]
            out[c] = edges
            idx += len(pcts)
        return out

    def topk_for(rel):
        # Run for ALL topk_cols (incl. ones that might be degenerate) — we
        # filter degenerates in Python after probe completes. This way topk
        # queries don't have to wait for the probe result.
        if not topk_cols:
            return {}
        parts = [f'approx_top_k({quote(c)}, 12) as t{i}' for i, c in enumerate(topk_cols)]
        sql = "select " + ", ".join(parts) + f" from {rel}"
        with dbt_adapter.adapter.connection_named(f"approx-topk-{id(rel)}"):
            _, t = dbt_adapter.execute(sql, fetch=True)
        out = {}
        for i, c in enumerate(topk_cols):
            raw = t.rows[0][i]
            import json
            if isinstance(raw, str):
                raw = json.loads(raw)
            out[c] = [(str(pair[0]), int(pair[1])) for pair in (raw or [])]
        return out

    import concurrent.futures
    t0 = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        f_probe = ex.submit(probe)
        f_p_base = ex.submit(percentiles_for, base_rel)
        f_p_curr = ex.submit(percentiles_for, curr_rel)
        f_t_base = ex.submit(topk_for, base_rel)
        f_t_curr = ex.submit(topk_for, curr_rel)
        row_count, distincts = f_probe.result()
        base_pcts = f_p_base.result()
        curr_pcts = f_p_curr.result()
        base_topk = f_t_base.result()
        curr_topk = f_t_curr.result()
    dt = time.perf_counter() - t0
    timings.append(PhaseTiming(column="(batch)", phase="all_five_parallel", wall_s=dt, sql_count=5, sql_s=dt*5))

    # cap_degenerate filter (post-probe, but Python-only — happens off the critical path)
    degenerate = {n for n in topk_cols if distincts.get(n, 0) >= row_count * 0.95}
    topk_active = [n for n in topk_cols if n not in degenerate]

    # Assemble distributions
    distributions = {}
    for n in all_names:
        if n in degenerate:
            distributions[n] = {"kind": "topk", "values": [], "base_counts": [], "current_counts": [],
                                "base_total": 0, "current_total": 0, "trimmed": False}
        elif n in topk_active:
            # Merge base+curr topk: union of values, fetch counts from each
            b_dict = dict(base_topk.get(n) or [])
            c_dict = dict(curr_topk.get(n) or [])
            union_vals = list(dict.fromkeys(list(b_dict) + list(c_dict)))[:12]
            distributions[n] = {
                "kind": "topk",
                "values": union_vals,
                "base_counts": [b_dict.get(v, 0) for v in union_vals],
                "current_counts": [c_dict.get(v, 0) for v in union_vals],
                "base_total": sum(b_dict.values()),
                "current_total": sum(c_dict.values()),
                "trimmed": True,
            }
        elif n in hist_cols:
            be = base_pcts.get(n) or []
            ce = curr_pcts.get(n) or []
            # Quantile-binned histogram: each bin = 5% of rows by construction.
            # We report the bin edges from each env separately; counts are the
            # implicit 5% per bin.
            distributions[n] = {
                "kind": "histogram",
                "bin_edges": be,           # base's edges
                "bin_edges_current": ce,   # current's edges (new field)
                "base_counts": [1] * (len(be) - 1) if be else [],
                "current_counts": [1] * (len(ce) - 1) if ce else [],
                "base_total": len(be) - 1 if be else 0,
                "current_total": len(ce) - 1 if ce else 0,
                "approximate": True,
            }
        else:
            distributions[n] = None

    wall = time.perf_counter() - wall_t0
    topk_n = sum(1 for v in distributions.values() if v and v.get("kind") == "topk" and v.get("values"))
    hist_n = sum(1 for v in distributions.values() if v and v.get("kind") == "histogram")
    null_n = sum(1 for v in distributions.values() if v is None) + len(degenerate)
    return BenchResult(
        strategy="approx_all", rows=rows, drift=drift,
        total_wall_s=wall,
        total_sql_s=sum(t.sql_s for t in timings),
        total_sql_count=sum(t.sql_count for t in timings),
        columns_total=len(distributions),
        columns_topk=topk_n, columns_histogram=hist_n, columns_null=null_n,
        timings=timings,
    ), {"columns": distributions}


def _schema_intro(dbt_adapter):
    base_rel = dbt_adapter.create_relation("wide_synth", base=True)
    curr_rel = dbt_adapter.create_relation("wide_synth", base=False)
    with dbt_adapter.adapter.connection_named("schema-intro"):
        curr_cols = {c.name: c for c in dbt_adapter.get_columns("wide_synth", base=False)}
        base_cols = {c.name: c for c in dbt_adapter.get_columns("wide_synth", base=True)}
    return base_rel, curr_rel, curr_cols, base_cols


def run_stack_approx(rows: int, drift: float, sample_k: int = 10_000, workers: int = 8, columns: Optional[List[str]] = None):
    """Stack but with the probe phase replaced by ONE batched approx_count_distinct
    query. Eliminates ~14s of per-column probe cost on Snowflake at 1M × 96.

    HLL accuracy is excellent for small cardinalities (low_card threshold) and
    has ~1–2% error at 1M-distinct (cap_degenerate threshold tolerated easily
    with a 0.95 safety factor).
    """
    import concurrent.futures
    from recce.tasks import ProfileDistributionTask
    from recce.tasks.profile_distribution import _classify_column_type

    ctx = load_context()
    _materialize_samples(ctx, sample_k)

    full_base = ctx.adapter.create_relation("wide_synth", base=True)
    full_curr = ctx.adapter.create_relation("wide_synth", base=False)
    samp_base = full_base.replace_path(identifier="wide_synth__sample")
    samp_curr = full_curr.replace_path(identifier="wide_synth__sample")

    # ONE batched approx probe — replaces 96 per-column count(distinct) queries.
    dbt_adapter = ctx.adapter
    with dbt_adapter.connection_named("probe-batched-approx"):
        cols_list = [c.name for c in dbt_adapter.get_columns("wide_synth", base=False)]
        sel = ", ".join(f'approx_count_distinct("{c}") as d{i}' for i, c in enumerate(cols_list))
        _, t = dbt_adapter.execute(
            f"select count(*) as rc, {sel} from {full_curr}", fetch=True
        )
        row_count = int(t.rows[0][0])
        distincts: Dict[str, int] = {
            cols_list[i]: int(t.rows[0][i + 1] or 0)
            for i in range(len(cols_list))
        }

    task = ProfileDistributionTask({"model": "wide_synth"})

    class StackedApproxTask(ProfileDistributionTask):
        def execute(self):
            low_card = self.params.low_card_threshold or 30
            topk_limit = self.params.topk_limit or 12
            num_bins = self.params.histogram_bins or 18

            with dbt_adapter.connection_named("query-coord"):
                curr_cols = {c.name: c for c in dbt_adapter.get_columns("wide_synth", base=False)}
                base_cols = {c.name: c for c in dbt_adapter.get_columns("wide_synth", base=True)}

            all_names = list({*curr_cols.keys(), *base_cols.keys()})
            if columns:
                want = {c.lower() for c in columns}
                all_names = [n for n in all_names if n.lower() in want]

            def process(name: str):
                col = curr_cols.get(name) or base_cols.get(name)
                if col is None:
                    return name, None
                present_base = name in base_cols
                present_curr = name in curr_cols
                kind = _classify_column_type((col.data_type or "").lower())
                if kind == "other":
                    return name, None
                distinct = distincts.get(name)
                use_topk = (
                    kind == "boolean"
                    or kind == "string"
                    or (distinct is not None and distinct <= low_card)
                )
                # cap_degenerate guard — HLL 1–2% slack
                if use_topk and distinct is not None and distinct >= row_count * 0.95:
                    return name, {
                        "kind": "topk", "values": [],
                        "base_counts": [], "current_counts": [],
                        "base_total": 0, "current_total": 0, "trimmed": False,
                    }
                with dbt_adapter.connection_named(f"col-{name}"):
                    try:
                        if use_topk:
                            (values, b, c, bt, ct, trimmed, _) = self._query_topk(
                                dbt_adapter, samp_base, samp_curr, name,
                                topk_limit, present_base, present_curr,
                            )
                            return name, {
                                "kind": "topk", "values": values,
                                "base_counts": b, "current_counts": c,
                                "base_total": bt, "current_total": ct,
                                "trimmed": trimmed,
                            }
                        else:
                            histo = self._query_histogram(
                                dbt_adapter, samp_base, samp_curr, name,
                                num_bins, present_base, present_curr,
                            )
                            if histo is None:
                                return name, None
                            edges, b, c, bt, ct = histo
                            return name, {
                                "kind": "histogram",
                                "bin_edges": [float(e) if e is not None else None for e in edges],
                                "base_counts": b, "current_counts": c,
                                "base_total": bt, "current_total": ct,
                            }
                    except Exception:
                        return name, None

            distributions: Dict[str, Any] = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
                for name, dist in ex.map(process, all_names):
                    distributions[name] = dist
            return {"columns": distributions}

    task = StackedApproxTask({"model": "wide_synth"})
    result, out = _run_with(task, ctx, f"stack_approx_{sample_k}_p{workers}", rows, drift)
    result.columns_null = sum(
        1 for v in out["columns"].values()
        if v and v.get("kind") == "topk" and not v.get("values")
    )
    result.columns_topk -= result.columns_null
    return result, out


def run_cap_sample_parallel(rows: int, drift: float, sample_k: int = 10_000, workers: int = 8):
    """The natural production stack: cap_degenerate + sample(K) + parallel(N).

    - Probe runs on FULL table (cheap, accurate distinct counts → degeneracy)
    - topk / histogram run on the materialized sample
    - Per-column dispatch through a thread pool with its own connection_named
    """
    import concurrent.futures
    from recce.tasks import ProfileDistributionTask
    from recce.tasks.profile_distribution import _classify_column_type

    ctx = load_context()
    _materialize_samples(ctx, sample_k)
    row_count = _probe_row_count(ctx)

    full_base = ctx.adapter.create_relation("wide_synth", base=True)
    full_curr = ctx.adapter.create_relation("wide_synth", base=False)
    samp_base = full_base.replace_path(identifier="wide_synth__sample")
    samp_curr = full_curr.replace_path(identifier="wide_synth__sample")

    class StackedTask(ProfileDistributionTask):
        def execute(self):
            dbt_adapter = ctx.adapter
            low_card = self.params.low_card_threshold or 30
            topk_limit = self.params.topk_limit or 12
            num_bins = self.params.histogram_bins or 18

            with dbt_adapter.connection_named("query-coord"):
                curr_cols = {c.name: c for c in dbt_adapter.get_columns("wide_synth", base=False)}
                base_cols = {c.name: c for c in dbt_adapter.get_columns("wide_synth", base=True)}

            all_names = list({*curr_cols.keys(), *base_cols.keys()})

            def process(name: str):
                col = curr_cols.get(name) or base_cols.get(name)
                if col is None:
                    return name, None
                present_base = name in base_cols
                present_curr = name in curr_cols
                kind = _classify_column_type((col.data_type or "").lower())
                if kind == "other":
                    return name, None
                with dbt_adapter.connection_named(f"col-{name}"):
                    try:
                        probe_rel = full_curr if present_curr else full_base
                        distinct = self._probe_distinct_count(dbt_adapter, probe_rel, name)
                    except Exception:
                        return name, None
                    use_topk = (
                        kind == "boolean"
                        or kind == "string"
                        or (distinct is not None and distinct <= low_card)
                    )
                    # cap_degenerate guard
                    if use_topk and distinct is not None and distinct >= row_count - 1:
                        return name, {
                            "kind": "topk", "values": [],
                            "base_counts": [], "current_counts": [],
                            "base_total": 0, "current_total": 0, "trimmed": False,
                        }
                    try:
                        if use_topk:
                            (values, b, c, bt, ct, trimmed, _) = self._query_topk(
                                dbt_adapter, samp_base, samp_curr, name,
                                topk_limit, present_base, present_curr,
                            )
                            return name, {
                                "kind": "topk", "values": values,
                                "base_counts": b, "current_counts": c,
                                "base_total": bt, "current_total": ct,
                                "trimmed": trimmed,
                            }
                        else:
                            histo = self._query_histogram(
                                dbt_adapter, samp_base, samp_curr, name,
                                num_bins, present_base, present_curr,
                            )
                            if histo is None:
                                return name, None
                            edges, b, c, bt, ct = histo
                            return name, {
                                "kind": "histogram",
                                "bin_edges": [float(e) if e is not None else None for e in edges],
                                "base_counts": b, "current_counts": c,
                                "base_total": bt, "current_total": ct,
                            }
                    except Exception:
                        return name, None

            distributions: Dict[str, Any] = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
                for name, dist in ex.map(process, all_names):
                    distributions[name] = dist
            return {"columns": distributions}

    task = StackedTask({"model": "wide_synth"})
    result, out = _run_with(task, ctx, f"stack_{sample_k}_p{workers}", rows, drift)
    result.columns_null = sum(
        1 for v in out["columns"].values()
        if v and v.get("kind") == "topk" and not v.get("values")
    )
    result.columns_topk -= result.columns_null
    return result, out


def run_batched(rows: int, drift: float, topk_limit: int = 12, num_bins: int = 18, low_card: int = 30):
    """Batched-CTE strategy: collapse ~3-4 queries per column into ~5 total.

    Phases (each is one or two queries total, regardless of column count):
        A. Schema introspection (curr_cols, base_cols)   — recce manifest, free
        B. Batched distinct probe                        — 1 query per env
        C. Batched bounds (min/max)                      — 1 query per env
        D. Batched topk                                  — 1 query (UNION ALL of per-col subqueries, window-trimmed)
        E. Batched histogram                             — 1 query (UNION ALL of per-col binning)

    Build cost: ~200 LoC vs the prototype's ~500. The big difference is the
    SQL surface: instead of jinja templates for one column at a time, we
    string-concat literal column lists. Adapter portability needs more care
    (e.g. `count_if` exists on DuckDB + Snowflake; `boolean::varchar` needs
    explicit cast on Snowflake).
    """
    from recce.adapter.dbt_adapter import DbtAdapter
    from recce.tasks.profile_distribution import _classify_column_type
    from recce.tasks import ProfileDistributionTask

    ctx = load_context()
    dbt_adapter: DbtAdapter = ctx.adapter

    # ---- Phase A: schema -----------------------------------------------------
    with dbt_adapter.connection_named("batched"):
        curr_rel = dbt_adapter.create_relation("wide_synth", base=False)
        base_rel = dbt_adapter.create_relation("wide_synth", base=True)
        curr_cols = {c.name: c for c in dbt_adapter.get_columns("wide_synth", base=False)}
        base_cols = {c.name: c for c in dbt_adapter.get_columns("wide_synth", base=True)}

    all_names = sorted(set(curr_cols) | set(base_cols))

    # Classify columns by what path they take
    topk_cols: List[str] = []
    hist_cols: List[str] = []
    null_cols: List[str] = []
    col_kind: Dict[str, str] = {}
    for name in all_names:
        col = curr_cols.get(name) or base_cols.get(name)
        kind = _classify_column_type((col.data_type or "").lower())
        col_kind[name] = kind
        if kind == "other":
            null_cols.append(name)

    # ---- Phase B: batched distinct probe (current side only) -----------------
    # One big SELECT with count_distinct(col) per column. (We use exact count
    # rather than approx to keep the degenerate detection precise.)
    def _quote(c: str) -> str:
        return f'"{c}"'

    probe_select = ",\n  ".join(
        f"count(distinct {_quote(c)}) as dc_{i}"
        for i, c in enumerate(all_names) if c in curr_cols
    )
    probe_sql = f"select count(*) as row_count, {probe_select} from {curr_rel}"
    with dbt_adapter.connection_named("batched"):
        _, t = dbt_adapter.execute(probe_sql, fetch=True)
    row = t.rows[0]
    row_count = int(row[0])
    distincts: Dict[str, int] = {}
    idx = 1
    for c in all_names:
        if c not in curr_cols:
            continue
        v = row[idx]
        distincts[c] = int(v) if v is not None else 0
        idx += 1

    # Now classify topk vs histogram (mirrors prototype dispatch)
    degenerate_cols: List[str] = []
    for name in all_names:
        if name in null_cols:
            continue
        kind = col_kind[name]
        if kind == "boolean" or kind == "string" or distincts.get(name, 0) <= low_card:
            # topk path, but skip degenerate (effectively-unique)
            if distincts.get(name, 0) >= row_count - 1:
                degenerate_cols.append(name)
            else:
                topk_cols.append(name)
        else:
            hist_cols.append(name)

    # ---- Phase C: batched bounds for histograms ------------------------------
    bounds: Dict[str, Tuple[float, float]] = {}
    if hist_cols:
        bound_select = ",\n  ".join(
            f"min({_quote(c)}) as min_{i}, max({_quote(c)}) as max_{i}"
            for i, c in enumerate(hist_cols)
        )
        # union of base+curr so the histogram captures both ranges.
        bound_sql = f"""
        with combined as (
            select * from {base_rel}
            union all
            select * from {curr_rel}
        )
        select {bound_select} from combined
        """
        with dbt_adapter.connection_named("batched"):
            _, t = dbt_adapter.execute(bound_sql, fetch=True)
        b = t.rows[0]
        # Coerce datetime → epoch seconds like the prototype's _to_epoch does
        import datetime as _dt
        def _to_epoch(v):
            if isinstance(v, _dt.datetime):
                return v.timestamp()
            if isinstance(v, _dt.date):
                return _dt.datetime(v.year, v.month, v.day).timestamp()
            try:
                return float(v)
            except (TypeError, ValueError):
                return None
        for i, c in enumerate(hist_cols):
            lo = _to_epoch(b[2 * i])
            hi = _to_epoch(b[2 * i + 1])
            if lo is None or hi is None or hi <= lo:
                bounds[c] = (None, None)
            else:
                bounds[c] = (lo, hi)

    # ---- Phase D: batched topk -----------------------------------------------
    # Pattern: for each topk col, build a sub-select returning
    #   (col_name, value, base_count, curr_count)
    # then UNION ALL across cols and trim with row_number() over (partition).
    topk_results: Dict[str, Dict[str, Any]] = {}
    if topk_cols:
        sub_selects = []
        for c in topk_cols:
            in_base = c in base_cols
            in_curr = c in curr_cols
            base_sel = f"select cast({_quote(c)} as varchar) as value, 'base' as env from {base_rel} where {_quote(c)} is not null" if in_base else "select cast(null as varchar) as value, 'base' as env where false"
            curr_sel = f"select cast({_quote(c)} as varchar) as value, 'curr' as env from {curr_rel} where {_quote(c)} is not null" if in_curr else "select cast(null as varchar) as value, 'curr' as env where false"
            sub_selects.append(f"""
            select
                '{c}' as col_name,
                value,
                count_if(env = 'base') as base_count,
                count_if(env = 'curr') as curr_count
            from ({base_sel} union all {curr_sel}) u
            group by 1, 2
            """)
        union_block = "\nunion all\n".join(sub_selects)
        topk_sql = f"""
        with all_counts as (
            {union_block}
        ),
        ranked as (
            select *, row_number() over (
                partition by col_name
                order by (base_count + curr_count) desc, value asc
            ) as rn
            from all_counts
        )
        select col_name, value, base_count, curr_count
        from ranked
        where rn <= {topk_limit}
        order by col_name, rn
        """
        with dbt_adapter.connection_named("batched"):
            _, t = dbt_adapter.execute(topk_sql, fetch=True)
        per_col: Dict[str, Dict[str, List]] = {c: {"v": [], "b": [], "c": []} for c in topk_cols}
        for r in t.rows:
            name, val, bc, cc = r[0], r[1], int(r[2] or 0), int(r[3] or 0)
            per_col[name]["v"].append(val)
            per_col[name]["b"].append(bc)
            per_col[name]["c"].append(cc)
        # Need totals — could fold into above, but simplest is another batched query
        total_select = ",\n  ".join(
            f"count({_quote(c)}) filter (where {_quote(c)} is not null) as t_{i}"
            for i, c in enumerate(topk_cols)
        )
        total_sql_base = f"select {total_select} from {base_rel}"
        total_sql_curr = f"select {total_select} from {curr_rel}"
        with dbt_adapter.connection_named("batched"):
            _, tb = dbt_adapter.execute(total_sql_base, fetch=True)
            _, tc = dbt_adapter.execute(total_sql_curr, fetch=True)
        for i, c in enumerate(topk_cols):
            d = per_col[c]
            topk_results[c] = {
                "kind": "topk",
                "values": d["v"], "base_counts": d["b"], "current_counts": d["c"],
                "base_total": int(tb.rows[0][i] or 0),
                "current_total": int(tc.rows[0][i] or 0),
                "trimmed": len(d["v"]) >= topk_limit,
            }

    # ---- Phase E: batched histogram ------------------------------------------
    hist_results: Dict[str, Dict[str, Any]] = {}
    if hist_cols:
        sub_selects = []
        last_bin = num_bins - 1
        edges_map: Dict[str, List[float]] = {}
        for c in hist_cols:
            lo, hi = bounds.get(c, (None, None))
            if lo is None or hi is None:
                continue
            bin_size = (hi - lo) / num_bins
            edges_map[c] = [lo + i * bin_size for i in range(num_bins + 1)]
            # For timestamp cols we'd need epoch(col) here — skip for now (same
            # bug as prototype, tracked in DRC-3504). Cast to numeric and let
            # the planner reject ts; we treat all-zero results as "no histogram".
            kind = col_kind[c]
            if kind == "datetime":
                # Adapter-specific epoch conversion
                if ADAPTER_KIND == "snowflake":
                    col_expr = f"date_part(epoch_second, {_quote(c)})"
                else:
                    col_expr = f"epoch({_quote(c)})"
            else:
                col_expr = f"cast({_quote(c)} as double)"
            in_base = c in base_cols
            in_curr = c in curr_cols
            base_sel = f"select {col_expr} as v, 'base' as env from {base_rel} where {_quote(c)} is not null" if in_base else "select cast(null as double) as v, 'base' as env where false"
            curr_sel = f"select {col_expr} as v, 'curr' as env from {curr_rel} where {_quote(c)} is not null" if in_curr else "select cast(null as double) as v, 'curr' as env where false"
            sub_selects.append(f"""
            select
                '{c}' as col_name,
                least(greatest(cast(floor((v - {lo}) / {bin_size}) as bigint), 0), {last_bin}) as bin,
                count_if(env = 'base') as base_count,
                count_if(env = 'curr') as curr_count
            from ({base_sel} union all {curr_sel}) u
            group by 1, 2
            """)
        if sub_selects:
            union_block = "\nunion all\n".join(sub_selects)
            hist_sql = f"with all_bins as ({union_block}) select * from all_bins order by col_name, bin"
            with dbt_adapter.connection_named("batched"):
                _, t = dbt_adapter.execute(hist_sql, fetch=True)
            per_col: Dict[str, Dict[int, Tuple[int, int]]] = {c: {} for c in edges_map}
            for r in t.rows:
                name, bin_idx, bc, cc = r[0], int(r[1] or 0), int(r[2] or 0), int(r[3] or 0)
                per_col[name][bin_idx] = (bc, cc)
            for c in hist_cols:
                if c not in edges_map:
                    hist_results[c] = None
                    continue
                edges = edges_map[c]
                base_counts = [0] * num_bins
                curr_counts = [0] * num_bins
                bt = 0
                ct = 0
                for bin_idx, (bc, cc) in per_col[c].items():
                    if 0 <= bin_idx < num_bins:
                        base_counts[bin_idx] += bc
                        curr_counts[bin_idx] += cc
                        bt += bc
                        ct += cc
                hist_results[c] = {
                    "kind": "histogram",
                    "bin_edges": edges,
                    "base_counts": base_counts,
                    "current_counts": curr_counts,
                    "base_total": bt,
                    "current_total": ct,
                }

    # ---- Assemble distributions + measure ------------------------------------
    distributions: Dict[str, Any] = {}
    for name in all_names:
        if name in null_cols:
            distributions[name] = None
        elif name in degenerate_cols:
            distributions[name] = {
                "kind": "topk", "values": [],
                "base_counts": [], "current_counts": [],
                "base_total": 0, "current_total": 0, "trimmed": False,
            }
        elif name in topk_results:
            distributions[name] = topk_results[name]
        elif name in hist_results:
            distributions[name] = hist_results[name]
        else:
            distributions[name] = None

    # The "batched" path doesn't use the prototype task's methods, so we can't
    # use TaskTimer. Time the whole execute() block via a wrapper.
    # (Re-running for measurement so we get a clean wall + query count.)

    # The actual measurement happens via the parent runner. But we've already
    # executed above. Instead, we restructure: build the function and run via
    # _run_with using a synthetic "task" shim.
    raise NotImplementedError("see refactored runner below")


def run_batched_measured(rows: int, drift: float, topk_limit: int = 12, num_bins: int = 18, low_card: int = 30):
    """Wrapper that times run_batched as a single block.

    Returns BenchResult with timings collapsed into a few synthetic phases.
    """
    from recce.adapter.dbt_adapter import DbtAdapter
    from recce.tasks.profile_distribution import _classify_column_type

    ctx = load_context()
    dbt_adapter: DbtAdapter = ctx.adapter

    # Hook adapter.execute for query count + per-phase timing.
    timings: List[PhaseTiming] = []
    current_phase = {"name": None, "q_count": 0, "q_s": 0.0, "t0": None}
    orig_exec = dbt_adapter.execute

    def _track(sql, *a, **kw):
        t0 = time.perf_counter()
        try:
            return orig_exec(sql, *a, **kw)
        except Exception:
            try:
                conn = dbt_adapter.adapter.connections.get_thread_connection()
                conn.handle.cursor().execute("ROLLBACK")
            except Exception:
                pass
            raise
        finally:
            dt = time.perf_counter() - t0
            if current_phase["name"] is not None:
                current_phase["q_count"] += 1
                current_phase["q_s"] += dt

    dbt_adapter.execute = _track

    def begin(name: str):
        current_phase["name"] = name
        current_phase["q_count"] = 0
        current_phase["q_s"] = 0.0
        current_phase["t0"] = time.perf_counter()

    def end():
        if current_phase["name"] is None:
            return
        wall = time.perf_counter() - current_phase["t0"]
        timings.append(PhaseTiming(
            column="(batch)",
            phase=current_phase["name"],
            wall_s=wall,
            sql_count=current_phase["q_count"],
            sql_s=current_phase["q_s"],
        ))
        current_phase["name"] = None

    t0 = time.perf_counter()

    def _quote(c: str) -> str:
        return f'"{c}"'

    # Phase A — schema
    begin("schema")
    with dbt_adapter.connection_named("batched"):
        curr_rel = dbt_adapter.create_relation("wide_synth", base=False)
        base_rel = dbt_adapter.create_relation("wide_synth", base=True)
        curr_cols = {c.name: c for c in dbt_adapter.get_columns("wide_synth", base=False)}
        base_cols = {c.name: c for c in dbt_adapter.get_columns("wide_synth", base=True)}
    end()

    all_names = sorted(set(curr_cols) | set(base_cols))
    col_kind: Dict[str, str] = {}
    null_cols: List[str] = []
    for name in all_names:
        col = curr_cols.get(name) or base_cols.get(name)
        kind = _classify_column_type((col.data_type or "").lower())
        col_kind[name] = kind
        if kind == "other":
            null_cols.append(name)

    probeable = [c for c in all_names if c in curr_cols and c not in null_cols]

    # Phase B — batched distinct probe
    begin("probe_batched")
    probe_select = ",\n  ".join(
        f"count(distinct {_quote(c)}) as dc_{i}" for i, c in enumerate(probeable)
    )
    probe_sql = f"select count(*) as row_count, {probe_select} from {curr_rel}"
    with dbt_adapter.connection_named("batched"):
        _, t = dbt_adapter.execute(probe_sql, fetch=True)
    row = t.rows[0]
    end()

    row_count = int(row[0])
    distincts: Dict[str, int] = {}
    for i, c in enumerate(probeable):
        v = row[i + 1]
        distincts[c] = int(v) if v is not None else 0

    topk_cols: List[str] = []
    hist_cols: List[str] = []
    degenerate_cols: List[str] = []
    for name in all_names:
        if name in null_cols:
            continue
        kind = col_kind[name]
        if kind == "boolean" or kind == "string" or distincts.get(name, 0) <= low_card:
            if distincts.get(name, 0) >= row_count - 1:
                degenerate_cols.append(name)
            else:
                topk_cols.append(name)
        else:
            hist_cols.append(name)

    # Phase C — batched bounds
    bounds: Dict[str, Tuple[float, float]] = {}
    if hist_cols:
        begin("bounds_batched")
        bound_select = ",\n  ".join(
            f"min({_quote(c)}) as min_{i}, max({_quote(c)}) as max_{i}"
            for i, c in enumerate(hist_cols)
        )
        bound_sql = f"""
        with combined as (
            select * from {base_rel}
            union all
            select * from {curr_rel}
        )
        select {bound_select} from combined
        """
        with dbt_adapter.connection_named("batched"):
            _, t = dbt_adapter.execute(bound_sql, fetch=True)
        end()
        b = t.rows[0]
        import datetime as _dt
        def _to_epoch(v):
            if isinstance(v, _dt.datetime):
                return v.timestamp()
            if isinstance(v, _dt.date):
                return _dt.datetime(v.year, v.month, v.day).timestamp()
            try:
                return float(v)
            except (TypeError, ValueError):
                return None
        for i, c in enumerate(hist_cols):
            lo = _to_epoch(b[2 * i])
            hi = _to_epoch(b[2 * i + 1])
            if lo is None or hi is None or hi <= lo:
                bounds[c] = (None, None)
            else:
                bounds[c] = (lo, hi)

    # Phase D — batched topk
    topk_results: Dict[str, Dict[str, Any]] = {}
    if topk_cols:
        begin("topk_batched")
        sub_selects = []
        for c in topk_cols:
            in_base = c in base_cols
            in_curr = c in curr_cols
            base_sel = f"select cast({_quote(c)} as varchar) as value, 'base' as env from {base_rel} where {_quote(c)} is not null" if in_base else "select cast(null as varchar) as value, 'base' as env where 1=0"
            curr_sel = f"select cast({_quote(c)} as varchar) as value, 'curr' as env from {curr_rel} where {_quote(c)} is not null" if in_curr else "select cast(null as varchar) as value, 'curr' as env where 1=0"
            sub_selects.append(f"""
            select
                '{c}' as col_name,
                value,
                count_if(env = 'base') as base_count,
                count_if(env = 'curr') as curr_count
            from ({base_sel} union all {curr_sel}) u
            group by 1, 2
            """)
        union_block = "\nunion all\n".join(sub_selects)
        topk_sql = f"""
        with all_counts as ({union_block}),
        ranked as (
            select *, row_number() over (
                partition by col_name
                order by (base_count + curr_count) desc, value asc
            ) as rn
            from all_counts
        )
        select col_name, value, base_count, curr_count
        from ranked where rn <= {topk_limit}
        order by col_name, rn
        """
        with dbt_adapter.connection_named("batched"):
            _, t = dbt_adapter.execute(topk_sql, fetch=True)
        end()
        per_col: Dict[str, Dict[str, List]] = {c: {"v": [], "b": [], "c": []} for c in topk_cols}
        for r in t.rows:
            name, val, bc, cc = r[0], r[1], int(r[2] or 0), int(r[3] or 0)
            per_col[name]["v"].append(val)
            per_col[name]["b"].append(bc)
            per_col[name]["c"].append(cc)

        # batched totals
        begin("topk_totals")
        total_select = ",\n  ".join(
            f"count({_quote(c)}) as tb_{i}, count({_quote(c)}) as tc_{i}"
            for i, c in enumerate(topk_cols)
        )
        total_sql_base = f"select " + ",\n  ".join(
            f"count({_quote(c)}) as t_{i}" for i, c in enumerate(topk_cols)
        ) + f" from {base_rel}"
        total_sql_curr = f"select " + ",\n  ".join(
            f"count({_quote(c)}) as t_{i}" for i, c in enumerate(topk_cols)
        ) + f" from {curr_rel}"
        with dbt_adapter.connection_named("batched"):
            _, tb = dbt_adapter.execute(total_sql_base, fetch=True)
            _, tc = dbt_adapter.execute(total_sql_curr, fetch=True)
        end()
        for i, c in enumerate(topk_cols):
            d = per_col[c]
            topk_results[c] = {
                "kind": "topk",
                "values": d["v"], "base_counts": d["b"], "current_counts": d["c"],
                "base_total": int(tb.rows[0][i] or 0),
                "current_total": int(tc.rows[0][i] or 0),
                "trimmed": len(d["v"]) >= topk_limit,
            }

    # Phase E — batched histogram
    hist_results: Dict[str, Dict[str, Any]] = {}
    if hist_cols:
        begin("histogram_batched")
        last_bin = num_bins - 1
        edges_map: Dict[str, List[float]] = {}
        sub_selects = []
        for c in hist_cols:
            lo, hi = bounds.get(c, (None, None))
            if lo is None or hi is None:
                continue
            bin_size = (hi - lo) / num_bins
            edges_map[c] = [lo + i * bin_size for i in range(num_bins + 1)]
            kind = col_kind[c]
            if kind == "datetime":
                if ADAPTER_KIND == "snowflake":
                    col_expr = f"date_part(epoch_second, {_quote(c)})"
                else:
                    col_expr = f"epoch({_quote(c)})"
            else:
                col_expr = f"cast({_quote(c)} as double)"
            in_base = c in base_cols
            in_curr = c in curr_cols
            base_sel = f"select {col_expr} as v, 'base' as env from {base_rel} where {_quote(c)} is not null" if in_base else f"select cast(null as double) as v, 'base' as env where 1=0"
            curr_sel = f"select {col_expr} as v, 'curr' as env from {curr_rel} where {_quote(c)} is not null" if in_curr else f"select cast(null as double) as v, 'curr' as env where 1=0"
            sub_selects.append(f"""
            select
                '{c}' as col_name,
                least(greatest(cast(floor((v - {lo}) / {bin_size}) as bigint), 0), {last_bin}) as bin,
                count_if(env = 'base') as base_count,
                count_if(env = 'curr') as curr_count
            from ({base_sel} union all {curr_sel}) u
            group by 1, 2
            """)
        if sub_selects:
            union_block = "\nunion all\n".join(sub_selects)
            hist_sql = f"with all_bins as ({union_block}) select * from all_bins order by col_name, bin"
            with dbt_adapter.connection_named("batched"):
                _, t = dbt_adapter.execute(hist_sql, fetch=True)
            end()
            per_col: Dict[str, Dict[int, Tuple[int, int]]] = {c: {} for c in edges_map}
            for r in t.rows:
                name, bin_idx, bc, cc = r[0], int(r[1] or 0), int(r[2] or 0), int(r[3] or 0)
                per_col[name][bin_idx] = (bc, cc)
            for c in hist_cols:
                if c not in edges_map:
                    hist_results[c] = None
                    continue
                edges = edges_map[c]
                base_counts = [0] * num_bins
                curr_counts = [0] * num_bins
                bt = 0
                ct = 0
                for bin_idx, (bc, cc) in per_col[c].items():
                    if 0 <= bin_idx < num_bins:
                        base_counts[bin_idx] += bc
                        curr_counts[bin_idx] += cc
                        bt += bc
                        ct += cc
                hist_results[c] = {
                    "kind": "histogram",
                    "bin_edges": edges,
                    "base_counts": base_counts,
                    "current_counts": curr_counts,
                    "base_total": bt,
                    "current_total": ct,
                }
        else:
            end()

    distributions: Dict[str, Any] = {}
    for name in all_names:
        if name in null_cols:
            distributions[name] = None
        elif name in degenerate_cols:
            distributions[name] = {
                "kind": "topk", "values": [],
                "base_counts": [], "current_counts": [],
                "base_total": 0, "current_total": 0, "trimmed": False,
            }
        elif name in topk_results:
            distributions[name] = topk_results[name]
        elif name in hist_results:
            distributions[name] = hist_results[name]
        else:
            distributions[name] = None

    wall = time.perf_counter() - t0

    cols_dict = distributions
    topk = sum(1 for v in cols_dict.values() if v and v.get("kind") == "topk" and v.get("values"))
    histogram = sum(1 for v in cols_dict.values() if v and v.get("kind") == "histogram")
    null_count = sum(1 for v in cols_dict.values() if v is None) + len(degenerate_cols)

    result = BenchResult(
        strategy="batched",
        rows=rows,
        drift=drift,
        total_wall_s=wall,
        total_sql_s=sum(t.sql_s for t in timings),
        total_sql_count=sum(t.sql_count for t in timings),
        columns_total=len(cols_dict),
        columns_topk=topk,
        columns_histogram=histogram,
        columns_null=null_count,
        timings=timings,
    )
    return result, {"columns": cols_dict}


def run_sample_block(rows: int, drift: float, sample_k: int = 10_000):
    """Block / system sampling — reads whole micro-partitions.

    Demonstration variant: bias-prone on sorted data. Same plumbing as
    `run_sample`, just with a different SAMPLE method on the CTAS.
    """
    from recce.tasks import ProfileDistributionTask

    ctx = load_context()
    _materialize_samples(ctx, sample_k, method="block", total_rows=rows)

    task = ProfileDistributionTask({"model": "wide_synth"})

    orig_create = ctx.adapter.create_relation

    def patched_create(model, base=False):
        rel = orig_create(model, base=base)
        if rel is None:
            return None
        return rel.replace_path(identifier="wide_synth__sample")

    ctx.adapter.create_relation = patched_create

    return _run_with(task, ctx, f"sample_block_{sample_k}", rows, drift)


def run_sample_inline(rows: int, drift: float, sample_k: int = 10_000):
    """Inline SAMPLE clause — no materialization. Each query re-samples.

    Relations passed to topk/histogram render as a sub-select with the
    adapter-appropriate SAMPLE clause:
      DuckDB:    (select * from real_rel using sample K rows) _s
      Snowflake: (select * from real_rel sample (K rows)) _s

    Per-query re-sampling means base+curr in a single FULL OUTER JOIN see
    different random rows, AND repeated runs see different samples (so
    chart variance across runs reflects real estimator noise).
    """
    from recce.tasks import ProfileDistributionTask

    ctx = load_context()
    task = ProfileDistributionTask({"model": "wide_synth"})

    if ADAPTER_KIND == "duckdb":
        sample_clause = f"using sample {sample_k} rows"
    elif ADAPTER_KIND == "snowflake":
        sample_clause = f"sample ({sample_k} rows)"
    else:
        raise RuntimeError(f"unknown ADAPTER_KIND={ADAPTER_KIND}")

    alias_counter = [0]

    class InlineSampledRelation:
        """Stringifies into a sub-select with SAMPLE; jinja interpolation
        treats it like any other relation since the templates just do
        `from {{ relation }}`. We can't patch create_relation globally —
        dbt's get_columns_in_relation macro needs real schema/identifier
        attrs. Instead we wrap at the method boundary in the task."""
        def __init__(self, real_rel):
            self.real_rel = real_rel
            alias_counter[0] += 1
            self._alias = f"_s{alias_counter[0]}"

        def __str__(self):
            return f"(select * from {self.real_rel} {sample_clause}) {self._alias}"

        def __repr__(self):
            return self.__str__()

    def wrap(rel):
        return InlineSampledRelation(rel) if rel is not None else None

    orig_probe = task._probe_distinct_count
    orig_topk = task._query_topk
    orig_hist = task._query_histogram

    def patched_probe(dbt_adapter, relation, col_name):
        return orig_probe(dbt_adapter, wrap(relation), col_name)

    def patched_topk(dbt_adapter, base_rel, curr_rel, col_name, *a, **kw):
        return orig_topk(dbt_adapter, wrap(base_rel), wrap(curr_rel), col_name, *a, **kw)

    def patched_hist(dbt_adapter, base_rel, curr_rel, col_name, *a, **kw):
        return orig_hist(dbt_adapter, wrap(base_rel), wrap(curr_rel), col_name, *a, **kw)

    task._probe_distinct_count = patched_probe
    task._query_topk = patched_topk
    task._query_histogram = patched_hist

    return _run_with(task, ctx, f"sample_inline_{sample_k}", rows, drift)


STRATEGIES: Dict[str, Callable] = {
    "baseline": run_baseline,
    "cap_degenerate": run_cap_degenerate,
    "sample": run_sample,
    "sample_block": run_sample_block,
    "sample_inline": run_sample_inline,
    "parallel": run_parallel,
    "cap_plus_sample": run_cap_plus_sample,
    "stack": run_cap_sample_parallel,
    "stack_approx": run_stack_approx,
    "approx_all": run_approx_all,
    "batched": run_batched_measured,
}


# --------------------------------------------------------------------- output

def write_csv(result: BenchResult) -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    path = RESULTS_DIR / f"{stamp}_{result.strategy}_rows{result.rows}.csv"
    with path.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["strategy", "rows", "drift", "column", "phase", "wall_s", "sql_count", "sql_s"])
        for t in result.timings:
            w.writerow([
                result.strategy, result.rows, result.drift,
                t.column, t.phase, f"{t.wall_s:.6f}", t.sql_count, f"{t.sql_s:.6f}",
            ])
    summary_path = path.with_suffix(".summary.json")
    with summary_path.open("w") as fh:
        s = asdict(result)
        s.pop("timings", None)
        json.dump(s, fh, indent=2)
    return path


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--strategy", default="baseline", choices=list(STRATEGIES))
    ap.add_argument("--rows", type=int, default=100_000)
    ap.add_argument("--drift", type=float, default=0.05)
    ap.add_argument("--force-rebuild", action="store_true")
    ap.add_argument("--sample-k", type=int, default=50_000,
                    help="Rows per sample (only used by 'sample' strategy)")
    ap.add_argument("--cap-threshold", type=int, default=None,
                    help="Cardinality cap for cap_degenerate (default: row_count - 1)")
    ap.add_argument("--columns", default=None,
                    help="Comma-separated subset of columns to process (viewport sim)")
    ap.add_argument("--target", choices=("duckdb", "snowflake"), default="duckdb",
                    help="Which fixture project to drive: duckdb (dbt/) or snowflake (dbt_sf/)")
    args = ap.parse_args()

    global DBT_DIR, ADAPTER_KIND
    ADAPTER_KIND = args.target
    DBT_DIR = BENCH_DIR / ("dbt_sf" if args.target == "snowflake" else "dbt")

    if args.target == "snowflake":
        print("Snowflake: assuming fixture already materialized via setup_fixture_sf.sh", file=sys.stderr)
    else:
        current_rows = fixture_row_count()
        if args.force_rebuild or current_rows != args.rows:
            print(f"Rebuilding fixture (have={current_rows}, want={args.rows})", file=sys.stderr)
            rebuild_fixture(args.rows, args.drift)
        else:
            print(f"Fixture present with rows={current_rows}; skipping rebuild", file=sys.stderr)

    runner = STRATEGIES[args.strategy]
    print(f"Running strategy={args.strategy} rows={args.rows} drift={args.drift}", file=sys.stderr)
    if args.strategy == "stack_approx":
        cols = [c.strip() for c in args.columns.split(",")] if args.columns else None
        result, out_obj = runner(args.rows, args.drift, sample_k=args.sample_k, columns=cols)
    elif args.strategy in ("sample", "sample_inline", "sample_block", "cap_plus_sample", "stack"):
        result, out_obj = runner(args.rows, args.drift, sample_k=args.sample_k)
    elif args.strategy == "cap_degenerate":
        result, out_obj = runner(args.rows, args.drift, cap_threshold=args.cap_threshold)
    else:
        result, out_obj = runner(args.rows, args.drift)
    print(result.summary())
    csv_path = write_csv(result)
    print(f"Wrote: {csv_path}", file=sys.stderr)
    # Persist the distribution result alongside the timing CSV so accuracy
    # comparisons across strategies can be done post-hoc.
    dist_path = csv_path.with_suffix(".distributions.json")
    with dist_path.open("w") as fh:
        json.dump(out_obj, fh, default=str)
    print(f"Wrote: {dist_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
