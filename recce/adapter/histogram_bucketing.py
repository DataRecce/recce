"""Adapter-specific exact bucketing strategies for numeric histograms.

The ordered literal-comparison ladder in :mod:`recce.tasks.histogram` is the
portable source of truth.  This module opts narrowly proven adapter/type pairs
into a compact expression; every unknown or unsafe input returns the literal
fallback marker instead.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Optional

DUCKDB_SCALED_INTEGER = "duckdb_scaled_integer"
LITERAL_ORDERED_COMPARISON = "literal_ordered_comparison"

_HUGEINT_MAX = 2**127 - 1
_SAFE_SCALED_MAGNITUDE = 10**37 - 1

# DuckDB aliases whose complete declared domain is narrower than HUGEINT.
# HUGEINT/INT128 and their unsigned variants intentionally stay on fallback.
_DUCKDB_INTEGER_MAX_ABS = {
    "TINYINT": 2**7,
    "INT1": 2**7,
    "SMALLINT": 2**15,
    "INT2": 2**15,
    "SHORT": 2**15,
    "INTEGER": 2**31,
    "INT": 2**31,
    "INT4": 2**31,
    "SIGNED": 2**31,
    "BIGINT": 2**63,
    "INT8": 2**63,
    "LONG": 2**63,
    "UTINYINT": 2**8 - 1,
    "USMALLINT": 2**16 - 1,
    "UINTEGER": 2**32 - 1,
    "UBIGINT": 2**64 - 1,
}

_DUCKDB_DECIMAL_TYPE = re.compile(r"^(?:DECIMAL|DEC|NUMERIC)\s*\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\)$")


@dataclass(frozen=True)
class HistogramBucketingPlan:
    """Selected SQL strategy and its optional compact ``CASE`` expression."""

    strategy: str
    bin_expression: Optional[str] = None


def _literal_fallback() -> HistogramBucketingPlan:
    return HistogramBucketingPlan(strategy=LITERAL_ORDERED_COMPARISON)


def _as_finite_decimal(value) -> Optional[Decimal]:
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return decimal_value if decimal_value.is_finite() else None


def _fractional_digits(value: Decimal) -> int:
    if value == 0:
        return 0
    _, _, exponent = _exact_coefficient_and_exponent(value)
    return max(-exponent, 0)


def _exact_coefficient_and_exponent(value: Decimal):
    """Extract normalized Decimal parts without consulting its ambient context."""
    sign, digits, exponent = value.as_tuple()
    trailing_zeros = 0
    for digit in reversed(digits):
        if digit != 0:
            break
        trailing_zeros += 1

    significant_digits = digits[: len(digits) - trailing_zeros] if trailing_zeros else digits
    coefficient = int("".join(str(digit) for digit in significant_digits)) if significant_digits else 0
    return sign, coefficient, exponent + trailing_zeros


def _scaled_integer(value: Decimal, scale: int) -> Optional[int]:
    """Return ``value * 10**scale`` without Decimal-context rounding."""
    if not value.is_finite():
        return None
    if value == 0:
        return 0

    sign, coefficient, exponent = _exact_coefficient_and_exponent(value)
    shift = exponent + scale
    if shift < 0:
        return None
    scaled = coefficient * 10**shift
    return -scaled if sign else scaled


def _decimal_sql_literal(value: Decimal) -> str:
    if value == 0:
        return "0"
    literal = format(value, "f")
    return literal.rstrip("0").rstrip(".") if "." in literal else literal


def _normalize_adapter_type(adapter_type) -> str:
    return adapter_type.strip().lower() if isinstance(adapter_type, str) else ""


def _normalize_column_type(column_type) -> str:
    return " ".join(column_type.strip().upper().split()) if isinstance(column_type, str) else ""


def _declared_type(column_type: str):
    integer_bound = _DUCKDB_INTEGER_MAX_ABS.get(column_type)
    if integer_bound is not None:
        return "integer", integer_bound, 0, 0

    match = _DUCKDB_DECIMAL_TYPE.fullmatch(column_type)
    if match is None:
        return None

    precision = int(match.group(1))
    scale = int(match.group(2) or 0)
    if precision < 1 or precision > 38 or scale < 0 or scale > precision:
        return None
    return "decimal", 10**precision - 1, precision, scale


def select_histogram_bucketing(
    *,
    adapter_type,
    column_sql: str,
    column_type: str,
    minimum,
    maximum,
    width,
    num_bins: int,
) -> HistogramBucketingPlan:
    """Select a compact exact expression or the universal literal fallback.

    DuckDB is enabled only when the declared type and concrete geometry prove
    every scaled value and floor-division intermediate fits signed HUGEINT.
    Fixed DECIMAL multiplication has an additional precision plus common
    geometry-scale propagation constraint so DuckDB's DECIMAL(38, scale)
    intermediate cannot overflow before its HUGEINT cast.
    """
    if _normalize_adapter_type(adapter_type) != "duckdb" or not isinstance(column_sql, str) or not column_sql:
        return _literal_fallback()
    if not isinstance(num_bins, int) or isinstance(num_bins, bool) or num_bins <= 0:
        return _literal_fallback()

    declared = _declared_type(_normalize_column_type(column_type))
    if declared is None:
        return _literal_fallback()
    kind, unscaled_declared_bound, precision, declared_scale = declared

    decimal_minimum = _as_finite_decimal(minimum)
    decimal_maximum = _as_finite_decimal(maximum)
    decimal_width = _as_finite_decimal(width)
    if decimal_minimum is None or decimal_maximum is None or decimal_width is None:
        return _literal_fallback()
    if decimal_width <= 0 or decimal_minimum > decimal_maximum:
        return _literal_fallback()

    common_scale = max(
        declared_scale,
        _fractional_digits(decimal_minimum),
        _fractional_digits(decimal_maximum),
        _fractional_digits(decimal_width),
    )
    if common_scale > 37:
        return _literal_fallback()
    scale_expansion = common_scale - declared_scale
    scale_factor = 10**common_scale
    declared_scaled_bound = unscaled_declared_bound * 10**scale_expansion

    # One decimal digit of headroom keeps subtraction, negation, and the
    # ``-offset + width - 1`` floor numerator inside signed HUGEINT.
    if declared_scaled_bound > _SAFE_SCALED_MAGNITUDE:
        return _literal_fallback()

    # DuckDB retains the source DECIMAL scale for this multiplication.  Even
    # when its eventual integer would fit HUGEINT, the DECIMAL intermediate is
    # not proven safe unless its integer digits also fit DECIMAL(38, scale).
    if kind == "decimal" and declared_scale > 0 and precision + common_scale > 38:
        return _literal_fallback()

    minimum_scaled = _scaled_integer(decimal_minimum, common_scale)
    maximum_scaled = _scaled_integer(decimal_maximum, common_scale)
    width_scaled = _scaled_integer(decimal_width, common_scale)
    if minimum_scaled is None or maximum_scaled is None or width_scaled is None or width_scaled <= 0:
        return _literal_fallback()
    if any(abs(value) > _SAFE_SCALED_MAGNITUDE for value in (minimum_scaled, maximum_scaled, width_scaled)):
        return _literal_fallback()
    if maximum_scaled - minimum_scaled != width_scaled * num_bins:
        return _literal_fallback()

    max_offset_magnitude = declared_scaled_bound + abs(minimum_scaled)
    max_floor_numerator = max_offset_magnitude + width_scaled - 1
    if max_offset_magnitude > _HUGEINT_MAX or max_floor_numerator > _HUGEINT_MAX:
        return _literal_fallback()

    factor_sql = f"({scale_factor}::HUGEINT)"
    if kind == "decimal" and declared_scale > 0:
        column_scaled = f"CAST(CAST({column_sql} AS DECIMAL(38, {declared_scale})) * {factor_sql} AS HUGEINT)"
    else:
        column_scaled = f"CAST({column_sql} AS HUGEINT)"
        if scale_factor != 1:
            column_scaled = f"({column_scaled} * {factor_sql})"

    minimum_sql = f"({minimum_scaled}::HUGEINT)"
    width_sql = f"({width_scaled}::HUGEINT)"
    offset_sql = f"({column_scaled} - {minimum_sql})"
    maximum_sql = _decimal_sql_literal(decimal_maximum)
    bin_expression = f"""CASE
                WHEN {column_sql} IS NULL THEN NULL
                WHEN {column_sql} = {maximum_sql} THEN {num_bins - 1}
                WHEN {offset_sql} >= 0 THEN {offset_sql} // {width_sql}
                ELSE -((-{offset_sql} + {width_sql} - 1) // {width_sql})
            END"""
    return HistogramBucketingPlan(strategy=DUCKDB_SCALED_INTEGER, bin_expression=bin_expression)
