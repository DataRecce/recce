"""
ProfileDistributionTask (DRC-3390 phase 2)
==========================================

Produces paired distribution data per column for a single model. The frontend
consumes the result to render `PairedHistogramDiscreteCell` / `Continuous`
cells in the schema view.

For each column we probe cardinality (`COUNT(DISTINCT col)` on current) and
dispatch to either a topk-style or histogram-style paired query:

  - Boolean / string columns, or any column with cardinality <= ~30:
      → topk: paired counts per category value (full outer join).
  - Numeric (int/float/decimal) and datetime/timestamp columns above the
      threshold → histogram: uniform-bin paired counts.
  - Anything else (struct, array, json, …) → null distribution.

Output shape mirrors the frontend's `ColumnDistribution`:

  {
    "columns": {
      "FULL_NAME": {
        "kind": "topk",
        "values": [...], "base_counts": [...], "current_counts": [...],
        "base_total": N, "current_total": M, "trimmed": bool
      },
      "AMOUNT": {
        "kind": "histogram",
        "bin_edges": [...], "base_counts": [...], "current_counts": [...],
        "base_total": N, "current_total": M
      },
      "COMPLEX_STRUCT": null
    }
  }
"""

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel

from recce.core import default_context
from recce.tasks import Task

logger = logging.getLogger("uvicorn")

# Distinct-value cap below which we ship topk instead of histogram.
DEFAULT_LOW_CARD_THRESHOLD = 30
# How many rows the topk query returns; charts beyond ~12 slots get cramped
# at cell density, so keep `values` short.
DEFAULT_TOPK_LIMIT = 12
# Histogram bin count. 18 bins read cleanly in a 140-px cell.
DEFAULT_HISTOGRAM_BINS = 18

# Type-classification mirrors the lowercase substring tests used in profile.py
# so the same column shape we already accept for profile_diff also gets a
# distribution chart.
_NUMERIC_TYPE_TOKENS = (
    "int",
    "bigint",
    "smallint",
    "tinyint",
    "float",
    "double",
    "real",
    "decimal",
    "numeric",
    "number",
    "money",
)
_DATETIME_TYPE_TOKENS = (
    "date",
    "timestamp",
    "datetime",
    "time",
)
_BOOLEAN_TYPE_TOKENS = (
    "bool",
    "boolean",
)
_STRING_TYPE_TOKENS = (
    "char",
    "varchar",
    "nvarchar",
    "string",
    "text",
)


def _classify_column_type(column_type: str) -> str:
    """Return one of: 'boolean', 'numeric', 'datetime', 'string', 'other'."""
    t = (column_type or "").lower()
    if any(tok in t for tok in _BOOLEAN_TYPE_TOKENS):
        return "boolean"
    # Order matters: 'timestamp' shouldn't be matched as numeric just because
    # of a trailing 'int' anywhere.
    if any(tok in t for tok in _DATETIME_TYPE_TOKENS):
        return "datetime"
    if any(tok in t for tok in _NUMERIC_TYPE_TOKENS):
        return "numeric"
    if any(tok in t for tok in _STRING_TYPE_TOKENS):
        return "string"
    return "other"


class ProfileDistributionParams(BaseModel):
    model: str
    columns: Optional[List[str]] = None
    low_card_threshold: Optional[int] = None
    topk_limit: Optional[int] = None
    histogram_bins: Optional[int] = None


class ProfileDistributionTask(Task):
    """Cardinality-probe + dispatch task; returns per-column paired distributions."""

    def __init__(self, params):
        super().__init__()
        self.params = ProfileDistributionParams(**params)
        self.connection = None

    # ------------------------------------------------------------------ helpers

    def _probe_distinct_count(
        self,
        dbt_adapter,
        curr_relation,
        column_name: str,
    ) -> Optional[int]:
        sql_template = r"""
        select count(distinct {{ adapter.quote(column) }}) as distinct_count
        from {{ relation }}
        """
        sql = dbt_adapter.generate_sql(
            sql_template,
            context=dict(relation=curr_relation, column=column_name),
        )
        try:
            _, table = dbt_adapter.execute(sql, fetch=True)
        except Exception as e:
            logger.warning(
                "profile_distribution: distinct probe failed for %s: %s",
                column_name,
                e,
            )
            return None
        if not table or table[0][0] is None:
            return None
        try:
            return int(table[0][0])
        except (TypeError, ValueError):
            return None

    def _query_topk(
        self,
        dbt_adapter,
        base_relation,
        curr_relation,
        column_name: str,
        k: int,
        present_base: bool,
        present_curr: bool,
    ) -> Tuple[List[Optional[str]], List[int], List[int], int, int, bool, int]:
        """
        Returns (values, base_counts, current_counts, base_total, current_total,
        trimmed, _). The full outer join + limit pattern is lifted from
        TopKDiffTask; reused so behavior stays consistent. When a column only
        exists on one side (added/removed), we skip that side's query and
        zero-fill the corresponding counts.
        """
        # Build per-side category counts. Empty list when column is missing
        # in that environment.
        def _category_counts(relation):
            sql = dbt_adapter.generate_sql(
                r"""
                select
                    coalesce(cast({{ adapter.quote(column) }} as {{ dbt.type_string() }}), '__null__') as category,
                    count(*) as c
                from {{ relation }}
                group by 1
                """,
                context=dict(relation=relation, column=column_name),
            )
            _, rows = dbt_adapter.execute(sql, fetch=True)
            return {row[0]: int(row[1] or 0) for row in rows}

        base_map = _category_counts(base_relation) if present_base else {}
        self.check_cancel()
        curr_map = _category_counts(curr_relation) if present_curr else {}

        all_keys = set(base_map.keys()) | set(curr_map.keys())
        ranked = sorted(
            all_keys,
            key=lambda c: (-max(base_map.get(c, 0), curr_map.get(c, 0)), c),
        )
        trimmed = len(ranked) > k
        kept = ranked[:k]

        values: List[Optional[str]] = []
        base_counts: List[int] = []
        curr_counts: List[int] = []
        for cat in kept:
            values.append(None if cat == "__null__" else cat)
            base_counts.append(base_map.get(cat, 0))
            curr_counts.append(curr_map.get(cat, 0))

        base_total = sum(base_map.values())
        curr_total = sum(curr_map.values())
        return values, base_counts, curr_counts, base_total, curr_total, trimmed, 0

    def _query_histogram(
        self,
        dbt_adapter,
        base_relation,
        curr_relation,
        column_name: str,
        num_bins: int,
        present_base: bool,
        present_curr: bool,
    ) -> Optional[Tuple[List[float], List[int], List[int], int, int]]:
        """
        Uniform-bin paired counts. min/max sourced from the side(s) where the
        column exists (added/removed columns only probe the present side).
        """
        if not present_base and not present_curr:
            return None
        if present_base and present_curr:
            bounds_sql = dbt_adapter.generate_sql(
                r"""
                with combined as (
                    select {{ adapter.quote(column) }} as v from {{ base_relation }}
                    union all
                    select {{ adapter.quote(column) }} as v from {{ curr_relation }}
                )
                select min(v) as min_v, max(v) as max_v
                from combined where v is not null
                """,
                context=dict(
                    base_relation=base_relation,
                    curr_relation=curr_relation,
                    column=column_name,
                ),
            )
        else:
            only = curr_relation if present_curr else base_relation
            bounds_sql = dbt_adapter.generate_sql(
                r"""
                select min({{ adapter.quote(column) }}) as min_v,
                       max({{ adapter.quote(column) }}) as max_v
                from {{ relation }} where {{ adapter.quote(column) }} is not null
                """,
                context=dict(relation=only, column=column_name),
            )
        _, bounds = dbt_adapter.execute(bounds_sql, fetch=True)
        if not bounds:
            return None
        min_v = bounds[0][0]
        max_v = bounds[0][1]
        if min_v is None or max_v is None:
            return None

        # Bin edges in Python so SQL stays simple. Cast datetime → epoch
        # seconds so arithmetic works the same way across adapters.
        try:
            lo = float(min_v)
            hi = float(max_v)
        except (TypeError, ValueError):
            # datetime/date arithmetic — use epoch seconds.
            import datetime as _dt

            def _to_epoch(v):
                if isinstance(v, _dt.datetime):
                    return v.timestamp()
                if isinstance(v, _dt.date):
                    return _dt.datetime(v.year, v.month, v.day).timestamp()
                return None

            lo = _to_epoch(min_v)
            hi = _to_epoch(max_v)
            if lo is None or hi is None:
                return None

        if hi <= lo:
            # Single-value column — produce one bin so the chart still renders.
            edges = [lo, lo + 1.0]
            base_count = self._scalar_count(
                dbt_adapter, base_relation, column_name
            )
            curr_count = self._scalar_count(
                dbt_adapter, curr_relation, column_name
            )
            return edges, [base_count], [curr_count], base_count, curr_count

        bin_size = (hi - lo) / num_bins
        edges = [lo + i * bin_size for i in range(num_bins + 1)]

        # `num_bins - 1` is interpolated as a literal in Python rather than
        # left for dbt's Jinja env — the env we get from dbt_adapter doesn't
        # always evaluate arithmetic inside {{ }}, and undefined-after-arith
        # blows up with a confusing "num_bins is undefined" error.
        last_bin = num_bins - 1
        bin_sql_template = r"""
        with binned as (
            select
                cast(
                    floor((cast({{ adapter.quote(column) }} as {{ dbt.type_numeric() }}) - {{ lo }})
                          / {{ bin_size }}) as {{ dbt.type_bigint() }}
                ) as bin
            from {{ relation }}
            where {{ adapter.quote(column) }} is not null
        )
        select
            least(greatest(bin, 0), {{ last_bin }}) as bin_clamped,
            count(*) as c
        from binned
        group by 1
        """

        def _run(relation):
            sql = dbt_adapter.generate_sql(
                bin_sql_template,
                context=dict(
                    relation=relation,
                    column=column_name,
                    lo=lo,
                    bin_size=bin_size,
                    last_bin=last_bin,
                ),
            )
            counts = [0] * num_bins
            try:
                _, rows = dbt_adapter.execute(sql, fetch=True)
            except Exception as e:
                logger.warning(
                    "profile_distribution: histogram binning failed for %s: %s",
                    column_name,
                    e,
                )
                return counts, 0
            total = 0
            for row in rows:
                idx = int(row[0]) if row[0] is not None else None
                cnt = int(row[1]) if row[1] is not None else 0
                if idx is None:
                    continue
                idx = max(0, min(num_bins - 1, idx))
                counts[idx] += cnt
                total += cnt
            return counts, total

        if present_base:
            base_counts, base_total = _run(base_relation)
        else:
            base_counts, base_total = [0] * num_bins, 0
        self.check_cancel()
        if present_curr:
            curr_counts, curr_total = _run(curr_relation)
        else:
            curr_counts, curr_total = [0] * num_bins, 0
        return edges, base_counts, curr_counts, base_total, curr_total

    def _scalar_count(self, dbt_adapter, relation, column_name: str) -> int:
        sql = dbt_adapter.generate_sql(
            r"""
            select count(*) from {{ relation }}
            where {{ adapter.quote(column) }} is not null
            """,
            context=dict(relation=relation, column=column_name),
        )
        try:
            _, table = dbt_adapter.execute(sql, fetch=True)
            return int(table[0][0] or 0)
        except Exception:
            return 0

    # ------------------------------------------------------------------ entry

    def execute(self):
        from recce.adapter.dbt_adapter import DbtAdapter

        dbt_adapter: DbtAdapter = default_context().adapter
        model = self.params.model
        selected = self.params.columns or []
        low_card = self.params.low_card_threshold or DEFAULT_LOW_CARD_THRESHOLD
        topk_limit = self.params.topk_limit or DEFAULT_TOPK_LIMIT
        num_bins = self.params.histogram_bins or DEFAULT_HISTOGRAM_BINS

        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()
            base_relation = dbt_adapter.create_relation(model, base=True)
            curr_relation = dbt_adapter.create_relation(model, base=False)
            if base_relation is None or curr_relation is None:
                raise ValueError(f"Model '{model}' missing in base or current environment")

            # Build {col_name: column_type} from current schema, fall back to base.
            curr_cols = {c.name: c for c in dbt_adapter.get_columns(model, base=False)}
            base_cols = {c.name: c for c in dbt_adapter.get_columns(model, base=True)}
            all_names = list({*curr_cols.keys(), *base_cols.keys()})
            if selected:
                want = {n.lower() for n in selected}
                all_names = [n for n in all_names if n.lower() in want]

            total = max(1, len(all_names))
            distributions: Dict[str, Any] = {}

            for idx, name in enumerate(all_names):
                self.update_progress(
                    message=f"Distribution: {name}",
                    percentage=idx / total,
                )
                self.check_cancel()
                col = curr_cols.get(name) or base_cols.get(name)
                if col is None:
                    distributions[name] = None
                    continue
                present_base = name in base_cols
                present_curr = name in curr_cols

                kind = _classify_column_type((col.data_type or "").lower())
                if kind == "other":
                    distributions[name] = None
                    continue

                try:
                    probe_rel = curr_relation if present_curr else base_relation
                    distinct = self._probe_distinct_count(
                        dbt_adapter, probe_rel, name
                    )
                except Exception as e:
                    logger.warning(
                        "profile_distribution: probe failed for %s: %s",
                        name,
                        e,
                    )
                    distributions[name] = None
                    continue

                use_topk = (
                    kind == "boolean"
                    or kind == "string"
                    or (distinct is not None and distinct <= low_card)
                )

                try:
                    if use_topk:
                        (
                            values,
                            base_counts,
                            curr_counts,
                            base_total,
                            curr_total,
                            trimmed,
                            _,
                        ) = self._query_topk(
                            dbt_adapter,
                            base_relation,
                            curr_relation,
                            name,
                            topk_limit,
                            present_base,
                            present_curr,
                        )
                        distributions[name] = {
                            "kind": "topk",
                            "values": values,
                            "base_counts": base_counts,
                            "current_counts": curr_counts,
                            "base_total": base_total,
                            "current_total": curr_total,
                            "trimmed": trimmed,
                        }
                    else:
                        histo = self._query_histogram(
                            dbt_adapter,
                            base_relation,
                            curr_relation,
                            name,
                            num_bins,
                            present_base,
                            present_curr,
                        )
                        if histo is None:
                            distributions[name] = None
                        else:
                            edges, base_counts, curr_counts, base_total, curr_total = histo
                            distributions[name] = {
                                "kind": "histogram",
                                "bin_edges": [_safe_number(e) for e in edges],
                                "base_counts": base_counts,
                                "current_counts": curr_counts,
                                "base_total": base_total,
                                "current_total": curr_total,
                            }
                except Exception as e:
                    logger.warning(
                        "profile_distribution: build failed for %s: %s",
                        name,
                        e,
                    )
                    distributions[name] = None

            return {"columns": distributions}

    def cancel(self):
        super().cancel()
        if self.connection:
            from recce.adapter.dbt_adapter import DbtAdapter

            dbt_adapter: DbtAdapter = default_context().adapter
            with dbt_adapter.connection_named("cancel"):
                dbt_adapter.cancel(self.connection)


def _safe_number(v: Any) -> Optional[float]:
    """JSON-safe number coercion — finite floats only."""
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None
