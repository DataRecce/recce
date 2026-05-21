"""Per-dialect SQL rendering for approximate-aggregate primitives (DRC-3390).

Pairs with :mod:`recce.adapter.capabilities`. ``capabilities.py`` answers
"can this adapter do X?"; this module answers "what's the SQL for X on this
adapter?". The :class:`ProfileDistributionTask` orchestration layer (PR 2)
calls these to compose the six-query ``approx_all`` pipeline:

  1. ``APPROX_COUNT_DISTINCT`` probe (one batched query)
  2. ``APPROX_PERCENTILE``      x base + current  (continuous columns)
  3. ``APPROX_TOP_K``           x base + current  (categorical columns)

Each renderer returns a SQL fragment suitable for inclusion in a ``SELECT``
list. Callers are responsible for column-identifier quoting (typically via
``adapter.quote(column_name)``) and for handling the per-adapter result-shape
variation in post-processing — e.g., DuckDB's ``approx_top_k`` returns a
list of values only, while Snowflake's ``APPROX_TOP_K`` returns an array of
``(value, count)`` pairs.

Raises :class:`UnsupportedAggregateError` when called for an adapter that
doesn't expose the aggregate natively. Strategy router in
:class:`ProfileDistributionTask` should consult
:func:`recce.adapter.capabilities.detect_capabilities` before dispatch and
should never call into a renderer for an unsupported adapter — the raise is
a defense-in-depth backstop.
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
    """
    db = _normalize(adapter_type)

    if db in {
        "snowflake",
        "bigquery",
        "duckdb",
        "databricks",
        "spark",
    }:
        return f"approx_count_distinct({column_expr})"

    if db in {"athena", "trino", "presto"}:
        return f"approx_distinct({column_expr})"

    if db == "clickhouse":
        # ClickHouse's default ``uniq`` uses an adaptive sampling + HLL hybrid.
        return f"uniq({column_expr})"

    if db == "redshift":
        # Redshift exposes APPROX inside a regular ``count(distinct …)``.
        return f"approximate count(distinct {column_expr})"

    raise UnsupportedAggregateError(f"approx_count_distinct is not supported on adapter type {adapter_type!r}")


def render_approx_top_k(adapter_type: str | None, column_expr: str, k: int) -> str:
    """Return a SQL fragment computing the approximate top-K values + counts.

    The shape of the returned value is **not** uniform across adapters:

    - Snowflake: ``ARRAY`` of ``[value, count]`` two-element arrays.
    - BigQuery: ``ARRAY<STRUCT<value …, count INT64>>``.
    - DuckDB: ``LIST`` of values only — **no counts**; callers must derive
      counts via a follow-up query if they need them.
    - Databricks / Spark 3.5+: ``ARRAY<STRUCT<item …, count BIGINT>>``.
    - ClickHouse: ``Array`` of values via ``topK(k)(col)`` — no counts.

    The strategy router (PR 2) is responsible for handling these shapes in
    post-processing. PR 1 only renders the SQL.
    """
    if k <= 0:
        raise ValueError(f"k must be positive, got {k}")
    db = _normalize(adapter_type)

    if db in {"snowflake", "duckdb", "databricks", "spark"}:
        return f"approx_top_k({column_expr}, {k})"

    if db == "bigquery":
        return f"approx_top_count({column_expr}, {k})"

    if db in {"athena", "trino", "presto"}:
        # ``approx_most_frequent(buckets, value, capacity)`` — Presto/Trino-style
        # space-saving sketch. Capacity is the sketch's working-set size; the
        # docs recommend roughly k * 10 for good error bounds. We use a fixed
        # 10x ratio at the lower bound of common k (k=12 → capacity=120).
        capacity = max(k * 10, 100)
        return f"approx_most_frequent({k}, {column_expr}, {capacity})"

    if db == "clickhouse":
        # ClickHouse parametrized aggregate: ``topK(k)(col)``.
        return f"topK({k})({column_expr})"

    raise UnsupportedAggregateError(f"approx_top_k is not supported on adapter type {adapter_type!r}")


def render_approx_percentile(
    adapter_type: str | None,
    column_expr: str,
    quantiles: Sequence[float],
) -> str:
    """Return a SQL fragment computing approximate percentiles at ``quantiles``.

    ``quantiles`` is a sequence of values in [0, 1]. The returned fragment
    produces an array (or array-like) of percentile values in the same order.

    As with :func:`render_approx_top_k`, the result *shape* varies across
    adapters; orchestration handles that in post-processing.
    """
    if not quantiles:
        raise ValueError("quantiles must be a non-empty sequence")
    if any(q < 0.0 or q > 1.0 for q in quantiles):
        raise ValueError(f"quantiles must each lie in [0, 1], got {list(quantiles)}")

    db = _normalize(adapter_type)
    quantile_csv = ", ".join(f"{q}" for q in quantiles)

    if db == "snowflake":
        # Snowflake's single-quantile ``APPROX_PERCENTILE(col, q)`` does not
        # accept an array. The orchestration layer (PR 2) is expected to use
        # the state-based ``APPROX_PERCENTILE_ACCUMULATE`` /
        # ``APPROX_PERCENTILE_ESTIMATE`` pair for multi-quantile efficiency.
        # PR 1's fragment renders ``ARRAY_CONSTRUCT(APPROX_PERCENTILE(col, q1), …)``
        # so a SELECT can produce all quantiles in one column.
        calls = ", ".join(f"approx_percentile({column_expr}, {q})" for q in quantiles)
        return f"array_construct({calls})"

    if db == "bigquery":
        # ``APPROX_QUANTILES`` divides the column into N+1 buckets and returns
        # all N+1 boundaries. We render the full call and let the orchestration
        # layer slice out the percentiles it cares about; that's simpler than
        # rendering N separate single-quantile fragments and stitching them.
        # ``IGNORE NULLS`` matches recce's existing precedent.
        # NOTE: For a fixed quantile set like [0.05, 0.10, …], the canonical
        # divisor is 100 (returning an array of 101 percentile boundaries).
        return f"approx_quantiles({column_expr}, 100 IGNORE NULLS)"

    if db == "duckdb":
        # DuckDB's ``approx_quantile`` accepts a list and returns a list.
        return f"approx_quantile({column_expr}, [{quantile_csv}])"

    if db in {"databricks", "spark"}:
        return f"approx_percentile({column_expr}, array({quantile_csv}))"

    if db in {"athena", "trino", "presto"}:
        return f"approx_percentile({column_expr}, ARRAY[{quantile_csv}])"

    if db == "clickhouse":
        # ``quantilesTDigest(p1, p2, …)(col)`` returns an array of length len(quantiles).
        return f"quantilesTDigest({quantile_csv})({column_expr})"

    if db == "redshift":
        # Redshift only supports a single percentile per call via
        # ``APPROXIMATE PERCENTILE_DISC(q) WITHIN GROUP (ORDER BY col)``. The
        # multi-quantile form is composed by the orchestration layer as
        # separate aggregates in a single SELECT. PR 1 renders the single-
        # quantile form per ``quantiles[i]`` and joins via comma; the caller
        # gets a comma-separated set of SQL fragments rather than one array
        # expression. Document the divergence so the strategy router handles
        # it explicitly.
        calls = [f"approximate percentile_disc({q}) within group (order by {column_expr})" for q in quantiles]
        return ", ".join(calls)

    raise UnsupportedAggregateError(f"approx_percentile is not supported on adapter type {adapter_type!r}")
