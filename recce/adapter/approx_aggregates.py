"""Per-dialect SQL rendering for approximate-aggregate primitives (DRC-3390).

Pairs with :mod:`recce.adapter.capabilities`. ``capabilities.py`` answers
"can this adapter do X?"; this module answers "what's the SQL for X on this
adapter?". The :class:`ProfileDistributionTask` orchestration layer calls
these to compose the six-query ``approx_all`` pipeline:

  1. ``APPROX_COUNT_DISTINCT`` probe (one batched query)
  2. ``APPROX_PERCENTILE``      x base + current  (continuous columns)
  3. ``APPROX_TOP_K``           x base + current  (categorical columns)

**Stage B scope (DuckDB-only):** the renderers here keep only their DuckDB
branch. Every other adapter raises :class:`UnsupportedAggregateError`. Stage D
will restore Snowflake / BigQuery / Databricks / Spark / Athena / Trino /
Presto / ClickHouse / Redshift.

Each renderer returns a SQL fragment suitable for inclusion in a ``SELECT``
list. Callers are responsible for column-identifier quoting (typically via
``adapter.quote(column_name)``).
"""

from __future__ import annotations

from typing import Sequence


class UnsupportedAggregateError(ValueError):
    """Raised when the requested approximate aggregate has no native rendering for the adapter."""


def _normalize(adapter_type: str | None) -> str:
    return (adapter_type or "").lower()


def render_approx_count_distinct(adapter_type: str | None, column_expr: str) -> str:
    """Return a SQL fragment computing approximate distinct count via HLL.

    ``column_expr`` is the (already-quoted) identifier or expression for the
    target column. The fragment is suitable for use directly in a
    ``SELECT`` list.

    Stage B: DuckDB only. Other adapters raise
    :class:`UnsupportedAggregateError`; Stage D restores polyglot support.
    """
    db = _normalize(adapter_type)

    if db == "duckdb":
        return f"approx_count_distinct({column_expr})"

    raise UnsupportedAggregateError(f"approx_count_distinct is not supported on adapter type {adapter_type!r}")


def render_approx_top_k(adapter_type: str | None, column_expr: str, k: int) -> str:
    """Return a SQL fragment computing the approximate top-K values.

    DuckDB's ``approx_top_k`` returns a ``LIST`` of values only — **no counts**.
    The orchestration layer treats ``counts == None`` as a valid payload
    meaning "the sketch didn't expose counts"; the frontend renders gap-on-
    absent semantics regardless.

    Stage B: DuckDB only. Other adapters raise
    :class:`UnsupportedAggregateError`; Stage D restores polyglot support.
    """
    if k <= 0:
        raise ValueError(f"k must be positive, got {k}")
    db = _normalize(adapter_type)

    if db == "duckdb":
        return f"approx_top_k({column_expr}, {k})"

    raise UnsupportedAggregateError(f"approx_top_k is not supported on adapter type {adapter_type!r}")


def render_approx_percentile(
    adapter_type: str | None,
    column_expr: str,
    quantiles: Sequence[float],
) -> str:
    """Return a SQL fragment computing approximate percentiles at ``quantiles``.

    ``quantiles`` is a sequence of values in [0, 1]. The returned fragment
    produces a list of percentile values in the same order.

    Stage B: DuckDB only. Other adapters raise
    :class:`UnsupportedAggregateError`; Stage D restores polyglot support.
    """
    if not quantiles:
        raise ValueError("quantiles must be a non-empty sequence")
    if any(q < 0.0 or q > 1.0 for q in quantiles):
        raise ValueError(f"quantiles must each lie in [0, 1], got {list(quantiles)}")

    db = _normalize(adapter_type)
    quantile_csv = ", ".join(f"{q}" for q in quantiles)

    if db == "duckdb":
        # DuckDB's ``approx_quantile`` accepts a list and returns a list.
        return f"approx_quantile({column_expr}, [{quantile_csv}])"

    raise UnsupportedAggregateError(f"approx_percentile is not supported on adapter type {adapter_type!r}")
