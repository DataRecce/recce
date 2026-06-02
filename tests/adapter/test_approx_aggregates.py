"""SQL snapshot tests for :mod:`recce.adapter.approx_aggregates` (DRC-3390 Stage B).

Stage B ships DuckDB-only renderers. Every other adapter raises
:class:`UnsupportedAggregateError`. Stage D will reintroduce per-dialect
snapshot tests for Snowflake / BigQuery / Databricks / Spark / Athena /
Trino / Presto / ClickHouse / Redshift.

These exist because dialect mistakes in the renderers are silent at unit-test
time — they only surface when a real warehouse rejects the query. Asserting
the exact rendered string catches dialect bugs in CI without requiring real
warehouse credentials.

The strings here are the contract — if a renderer changes, the test should
change in the same commit and the diff should be reviewable.
"""

import pytest

from recce.adapter.approx_aggregates import (
    UnsupportedAggregateError,
    render_approx_count_distinct,
    render_approx_percentile,
    render_approx_top_k,
)

# Stage B: every adapter we expect Stage D to support is currently
# unsupported, plus all the always-disabled engines.
UNSUPPORTED_ADAPTERS_STAGE_B = [
    "snowflake",
    "bigquery",
    "databricks",
    "spark",
    "athena",
    "trino",
    "presto",
    "clickhouse",
    "redshift",
    "postgres",
    "mysql",
    "sqlite",
    "sqlserver",
]


# -----------------------------------------------------------------------------
# approx_count_distinct
# -----------------------------------------------------------------------------


def test_render_approx_count_distinct_duckdb():
    assert render_approx_count_distinct("duckdb", '"col"') == 'approx_count_distinct("col")'


@pytest.mark.parametrize("adapter_type", UNSUPPORTED_ADAPTERS_STAGE_B)
def test_render_approx_count_distinct_raises_on_non_duckdb(adapter_type):
    """Stage B: only DuckDB renders. Stage D restores polyglot support."""
    with pytest.raises(UnsupportedAggregateError):
        render_approx_count_distinct(adapter_type, '"col"')


def test_render_approx_count_distinct_case_insensitive():
    assert render_approx_count_distinct("DUCKDB", '"col"') == render_approx_count_distinct("duckdb", '"col"')


# -----------------------------------------------------------------------------
# approx_top_k
# -----------------------------------------------------------------------------


def test_render_approx_top_k_duckdb():
    assert render_approx_top_k("duckdb", '"col"', 12) == 'approx_top_k("col", 12)'


@pytest.mark.parametrize("adapter_type", UNSUPPORTED_ADAPTERS_STAGE_B)
def test_render_approx_top_k_raises_on_non_duckdb(adapter_type):
    with pytest.raises(UnsupportedAggregateError):
        render_approx_top_k(adapter_type, '"col"', 12)


def test_render_approx_top_k_rejects_non_positive_k():
    with pytest.raises(ValueError):
        render_approx_top_k("duckdb", '"col"', 0)
    with pytest.raises(ValueError):
        render_approx_top_k("duckdb", '"col"', -5)


# -----------------------------------------------------------------------------
# approx_percentile
# -----------------------------------------------------------------------------


QUANTILES_3 = [0.1, 0.5, 0.9]


def test_render_approx_percentile_duckdb():
    assert render_approx_percentile("duckdb", '"col"', QUANTILES_3) == 'approx_quantile("col", [0.1, 0.5, 0.9])'


@pytest.mark.parametrize("adapter_type", UNSUPPORTED_ADAPTERS_STAGE_B)
def test_render_approx_percentile_raises_on_non_duckdb(adapter_type):
    with pytest.raises(UnsupportedAggregateError):
        render_approx_percentile(adapter_type, '"col"', QUANTILES_3)


def test_render_approx_percentile_rejects_empty_quantiles():
    with pytest.raises(ValueError):
        render_approx_percentile("duckdb", '"col"', [])


@pytest.mark.parametrize("bad_q", [-0.1, 1.5, 2.0])
def test_render_approx_percentile_rejects_out_of_range(bad_q):
    with pytest.raises(ValueError):
        render_approx_percentile("duckdb", '"col"', [0.5, bad_q])


def test_render_approx_percentile_case_insensitive():
    a = render_approx_percentile("DUCKDB", '"col"', [0.5])
    b = render_approx_percentile("duckdb", '"col"', [0.5])
    assert a == b
