from decimal import Decimal

import pytest

from recce.adapter.histogram_bucketing import (
    DUCKDB_SCALED_INTEGER,
    LITERAL_ORDERED_COMPARISON,
    select_histogram_bucketing,
)


def select_plan(
    column_type: str,
    *,
    adapter_type: str = "duckdb",
    minimum: Decimal = Decimal("0"),
    maximum: Decimal = Decimal("1"),
    width: Decimal = Decimal("0.2"),
    num_bins: int = 5,
):
    return select_histogram_bucketing(
        adapter_type=adapter_type,
        column_sql="amount",
        column_type=column_type,
        minimum=minimum,
        maximum=maximum,
        width=width,
        num_bins=num_bins,
    )


@pytest.mark.parametrize(
    "column_type",
    [
        "TINYINT",
        "SMALLINT",
        "INTEGER",
        "BIGINT",
        "UTINYINT",
        "USMALLINT",
        "UINTEGER",
        "UBIGINT",
        "DECIMAL(18, 6)",
        "DEC(18, 6)",
        "NUMERIC(18, 6)",
        "DECIMAL(18)",
        "DECIMAL(18, 0)",
    ],
)
def test_duckdb_bounded_integral_and_fixed_decimal_types_select_compact_bucketing(column_type):
    """Catch a proven DuckDB type being routed back through the linear CASE ladder."""
    plan = select_plan(column_type)

    assert plan.strategy == DUCKDB_SCALED_INTEGER
    assert plan.bin_expression is not None
    assert "//" in plan.bin_expression
    assert "/" not in plan.bin_expression.replace("//", "")


@pytest.mark.parametrize("adapter_type", [None, "", "sqlite", "postgres", "snowflake", "some-future-engine"])
def test_non_duckdb_adapters_always_select_the_exact_literal_fallback(adapter_type):
    """Catch an unproven dialect receiving DuckDB-only integer-division SQL."""
    plan = select_plan("DECIMAL(18, 6)", adapter_type=adapter_type)

    assert plan.strategy == LITERAL_ORDERED_COMPARISON
    assert plan.bin_expression is None


@pytest.mark.parametrize(
    "column_type",
    [
        "FLOAT",
        "DOUBLE",
        "DOUBLE PRECISION",
        "REAL",
        "DECIMAL",
        "NUMERIC",
        "NUMBER",
        "NUMBER(18, 6)",
        "HUGEINT",
        "UHUGEINT",
        "INT128",
        "UINT128",
        "VARCHAR",
        "future_numeric",
    ],
)
def test_duckdb_unproven_types_select_the_exact_literal_fallback(column_type):
    """Catch floating, unbounded, or unknown values entering scaled-integer arithmetic."""
    plan = select_plan(column_type)

    assert plan.strategy == LITERAL_ORDERED_COMPARISON
    assert plan.bin_expression is None


@pytest.mark.parametrize(
    ("column_type", "minimum", "maximum", "width", "num_bins"),
    [
        ("DECIMAL(38, 0)", Decimal("0"), Decimal("10"), Decimal("1"), 10),
        ("DECIMAL(37, 2)", Decimal("0"), Decimal("1"), Decimal("0.1"), 10),
        ("DECIMAL(30, 20)", Decimal("0"), Decimal("1"), Decimal("0.1"), 10),
        ("BIGINT", Decimal("0"), Decimal("1E-20"), Decimal("1E-21"), 10),
        ("TINYINT", Decimal("0"), Decimal("1E-37"), Decimal("1E-38"), 10),
        ("INTEGER", Decimal("0"), Decimal("1"), Decimal("0.3"), 3),
        ("INTEGER", Decimal("NaN"), Decimal("1"), Decimal("0.2"), 5),
    ],
)
def test_overflow_or_inexact_geometry_selects_the_literal_fallback(column_type, minimum, maximum, width, num_bins):
    """Catch unsafe casts, intermediates, or inconsistent geometry being treated as proven."""
    plan = select_plan(
        column_type,
        minimum=minimum,
        maximum=maximum,
        width=width,
        num_bins=num_bins,
    )

    assert plan.strategy == LITERAL_ORDERED_COMPARISON
    assert plan.bin_expression is None


def test_fixed_decimal_scale_expansion_remains_exact_and_compact():
    """Catch geometry precision beyond the declared scale being rounded away."""
    plan = select_plan(
        "  numeric ( 12 , 2 ) ",
        minimum=Decimal("0"),
        maximum=Decimal("0.02"),
        width=Decimal("0.002"),
        num_bins=10,
    )

    assert plan.strategy == DUCKDB_SCALED_INTEGER
    assert plan.bin_expression is not None
    assert "1000" in plan.bin_expression
    assert "2::HUGEINT" in plan.bin_expression


def test_large_decimal_geometry_is_scaled_without_ambient_context_rounding():
    """Catch Decimal.normalize shifting a valid 37-digit bound by one bin."""
    minimum = Decimal("1234567890123456789012345678900000000")
    maximum = Decimal("1234567890123456789012345679900000000")
    plan = select_plan(
        "DECIMAL(37, 0)",
        minimum=minimum,
        maximum=maximum,
        width=Decimal("100000000"),
        num_bins=10,
    )

    assert plan.strategy == DUCKDB_SCALED_INTEGER
    assert plan.bin_expression is not None
    assert f"({minimum}::HUGEINT)" in plan.bin_expression


def test_compact_expression_size_does_not_grow_with_bin_count():
    """Catch accidental reintroduction of one SQL branch per requested bin."""
    small = select_plan(
        "INTEGER",
        minimum=Decimal("0"),
        maximum=Decimal("50"),
        width=Decimal("1"),
        num_bins=50,
    )
    large = select_plan(
        "INTEGER",
        minimum=Decimal("0"),
        maximum=Decimal("10000"),
        width=Decimal("1"),
        num_bins=10000,
    )

    assert small.strategy == large.strategy == DUCKDB_SCALED_INTEGER
    assert small.bin_expression is not None
    assert large.bin_expression is not None
    assert len(large.bin_expression) - len(small.bin_expression) < 16
    assert len(large.bin_expression) < 1500
