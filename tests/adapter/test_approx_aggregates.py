"""Per-dialect SQL snapshot tests for :mod:`recce.adapter.approx_aggregates`.

These exist because dialect mistakes in the renderers are silent at unit-test
time — they only surface when a real warehouse rejects the query. Asserting
the exact rendered string per adapter catches dialect bugs in CI without
requiring real Snowflake/BigQuery credentials.

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

# -----------------------------------------------------------------------------
# approx_count_distinct
# -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "adapter_type,expected",
    [
        ("snowflake", 'approx_count_distinct("col")'),
        ("bigquery", 'approx_count_distinct("col")'),
        ("duckdb", 'approx_count_distinct("col")'),
        ("databricks", 'approx_count_distinct("col")'),
        ("spark", 'approx_count_distinct("col")'),
        ("athena", 'approx_distinct("col")'),
        ("trino", 'approx_distinct("col")'),
        ("presto", 'approx_distinct("col")'),
        ("clickhouse", 'uniq("col")'),
        ("redshift", 'approximate count(distinct "col")'),
    ],
)
def test_render_approx_count_distinct(adapter_type, expected):
    assert render_approx_count_distinct(adapter_type, '"col"') == expected


@pytest.mark.parametrize("adapter_type", ["postgres", "mysql", "sqlite", "sqlserver"])
def test_render_approx_count_distinct_raises_on_disabled_tier(adapter_type):
    with pytest.raises(UnsupportedAggregateError):
        render_approx_count_distinct(adapter_type, '"col"')


def test_render_approx_count_distinct_case_insensitive():
    assert render_approx_count_distinct("SNOWFLAKE", '"col"') == render_approx_count_distinct("snowflake", '"col"')


# -----------------------------------------------------------------------------
# approx_top_k
# -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "adapter_type,expected",
    [
        ("snowflake", 'approx_top_k("col", 12)'),
        ("duckdb", 'approx_top_k("col", 12)'),
        ("databricks", 'approx_top_k("col", 12)'),
        ("spark", 'approx_top_k("col", 12)'),
        ("bigquery", 'approx_top_count("col", 12)'),
        ("athena", 'approx_most_frequent(12, "col", 120)'),
        ("trino", 'approx_most_frequent(12, "col", 120)'),
        ("presto", 'approx_most_frequent(12, "col", 120)'),
        ("clickhouse", 'topK(12)("col")'),
    ],
)
def test_render_approx_top_k(adapter_type, expected):
    assert render_approx_top_k(adapter_type, '"col"', 12) == expected


def test_approx_top_k_athena_capacity_floors_at_100():
    """Tiny k still gets a sensible sketch-capacity floor."""
    assert render_approx_top_k("trino", '"col"', 3) == 'approx_most_frequent(3, "col", 100)'


@pytest.mark.parametrize("adapter_type", ["postgres", "mysql", "sqlite", "sqlserver", "redshift"])
def test_render_approx_top_k_raises_on_unsupported(adapter_type):
    with pytest.raises(UnsupportedAggregateError):
        render_approx_top_k(adapter_type, '"col"', 12)


def test_render_approx_top_k_rejects_non_positive_k():
    with pytest.raises(ValueError):
        render_approx_top_k("snowflake", '"col"', 0)
    with pytest.raises(ValueError):
        render_approx_top_k("snowflake", '"col"', -5)


# -----------------------------------------------------------------------------
# approx_percentile
# -----------------------------------------------------------------------------


QUANTILES_3 = [0.1, 0.5, 0.9]


@pytest.mark.parametrize(
    "adapter_type,expected",
    [
        (
            "snowflake",
            'array_construct(approx_percentile("col", 0.1), '
            'approx_percentile("col", 0.5), approx_percentile("col", 0.9))',
        ),
        ("bigquery", 'approx_quantiles("col", 100 IGNORE NULLS)'),
        ("duckdb", 'approx_quantile("col", [0.1, 0.5, 0.9])'),
        ("databricks", 'approx_percentile("col", array(0.1, 0.5, 0.9))'),
        ("spark", 'approx_percentile("col", array(0.1, 0.5, 0.9))'),
        ("athena", 'approx_percentile("col", ARRAY[0.1, 0.5, 0.9])'),
        ("trino", 'approx_percentile("col", ARRAY[0.1, 0.5, 0.9])'),
        ("presto", 'approx_percentile("col", ARRAY[0.1, 0.5, 0.9])'),
        ("clickhouse", 'quantilesTDigest(0.1, 0.5, 0.9)("col")'),
        (
            "redshift",
            'approximate percentile_disc(0.1) within group (order by "col"), '
            'approximate percentile_disc(0.5) within group (order by "col"), '
            'approximate percentile_disc(0.9) within group (order by "col")',
        ),
    ],
)
def test_render_approx_percentile(adapter_type, expected):
    assert render_approx_percentile(adapter_type, '"col"', QUANTILES_3) == expected


@pytest.mark.parametrize("adapter_type", ["postgres", "mysql", "sqlite", "sqlserver"])
def test_render_approx_percentile_raises_on_disabled_tier(adapter_type):
    with pytest.raises(UnsupportedAggregateError):
        render_approx_percentile(adapter_type, '"col"', QUANTILES_3)


def test_render_approx_percentile_rejects_empty_quantiles():
    with pytest.raises(ValueError):
        render_approx_percentile("snowflake", '"col"', [])


@pytest.mark.parametrize("bad_q", [-0.1, 1.5, 2.0])
def test_render_approx_percentile_rejects_out_of_range(bad_q):
    with pytest.raises(ValueError):
        render_approx_percentile("snowflake", '"col"', [0.5, bad_q])


def test_render_approx_percentile_case_insensitive():
    a = render_approx_percentile("SNOWFLAKE", '"col"', [0.5])
    b = render_approx_percentile("snowflake", '"col"', [0.5])
    assert a == b
