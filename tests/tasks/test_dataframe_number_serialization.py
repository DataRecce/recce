"""
DRC-3025 numeric serialization tests.

Two distinct requirements that must NOT be conflated:

1. PROFILE STATS must reach the frontend as JSON *numbers*. Profile aggregates
   (avg, stddev, percentiles) arrive from agate as Decimal; pydantic v2
   serializes Decimal as a JSON *string*, so an unchanged table whose avg is
   Decimal("0.30000000000000004") reached the grid as the string
   "0.30000000000000004" vs "0.3" — a phantom float diff the numeric epsilon
   could never catch. The profile path coerces finite NUMBER-column Decimals to
   float (`_coerce_number_stats_to_float`) so the stat is a real number.

2. QUERY / QUERY_DIFF / VALUE_DIFF data must stay EXACT. A NUMBER column there is
   a raw warehouse DECIMAL/NUMERIC *data* value whose full precision matters. The
   shared `DataFrame.from_agate` must NOT coerce these to float64 — doing so
   collapses a genuine high-precision change (e.g. …67.89 vs …67.90 → same float)
   into "unchanged" and corrupts the displayed value. This regression is exactly
   why the profile coercion lives in the profile path, not in from_agate.
"""

import json
from decimal import Decimal

import agate

from recce.tasks.dataframe import DataFrame, DataFrameColumnType
from recce.tasks.profile import _coerce_number_stats_to_float


def _profile_frame(avg_value, count_value=Decimal("1000")):
    """A DataFrame shaped like a profile result, as the profile task builds it:
    from_agate followed by the profile-only NUMBER->float coercion."""
    table = agate.Table(
        [("CUSTOMER_ID", avg_value, count_value)],
        ["column_name", "avg", "row_count"],
        [agate.Text(), agate.Number(), agate.Number()],
    )
    return _coerce_number_stats_to_float(DataFrame.from_agate(table))


# ---------------------------------------------------------------------------
# 1. Profile stats -> numbers (the DRC-3025 fix)
# ---------------------------------------------------------------------------


def test_profile_number_stat_serializes_as_json_number():
    df = _profile_frame(Decimal("0.30000000000000004"))
    assert df.columns[1].type == DataFrameColumnType.NUMBER
    assert isinstance(df.data[0][1], float)

    avg = json.loads(df.model_dump_json())["data"][0][1]
    assert isinstance(avg, float), f"expected JSON number, got {type(avg).__name__} {avg!r}"


def test_profile_float_noise_pair_is_within_epsilon():
    base = json.loads(_profile_frame(Decimal(repr(0.1 + 0.2))).model_dump_json())["data"][0][1]
    current = json.loads(_profile_frame(Decimal("0.3")).model_dump_json())["data"][0][1]
    assert isinstance(base, float) and isinstance(current, float)
    assert abs(base - current) <= 1e-9 * max(abs(base), abs(current))


def test_profile_genuine_change_still_differs():
    base = json.loads(_profile_frame(Decimal("100.0")).model_dump_json())["data"][0][1]
    current = json.loads(_profile_frame(Decimal("100.5")).model_dump_json())["data"][0][1]
    assert abs(base - current) > 1e-9 * max(abs(base), abs(current))


def test_profile_nonfinite_stat_is_float():
    inf = _profile_frame(Decimal("Infinity")).data[0][1]
    nan = _profile_frame(Decimal("NaN")).data[0][1]
    assert isinstance(inf, float)
    assert isinstance(nan, float)


def test_profile_integer_column_left_as_is():
    import dbt_common.clients.agate_helper as agate_helper

    table = agate.Table(
        [("CUSTOMER_ID", 1000)],
        ["column_name", "row_count"],
        [agate.Text(), agate_helper.Integer()],
    )
    df = _coerce_number_stats_to_float(DataFrame.from_agate(table))
    assert df.columns[1].type == DataFrameColumnType.INTEGER
    row_count = json.loads(df.model_dump_json())["data"][0][1]
    assert isinstance(row_count, int)
    assert row_count == 1000


# ---------------------------------------------------------------------------
# 2. Data columns stay EXACT on the shared from_agate path (regression guard)
# ---------------------------------------------------------------------------


def test_from_agate_preserves_exact_high_precision_decimal():
    # The query/query_diff/value_diff path: from_agate must NOT coerce NUMBER
    # data to float. A high-precision DECIMAL keeps its exact value as a string.
    high = Decimal("12345678901234567.89")
    table = agate.Table([("id-1", high)], ["id", "amount"], [agate.Text(), agate.Number()])
    df = DataFrame.from_agate(table)

    assert df.columns[1].type == DataFrameColumnType.NUMBER
    amount = json.loads(df.model_dump_json())["data"][0][1]
    assert isinstance(amount, str), "NUMBER data must stay an exact Decimal string, not a float"
    assert amount == "12345678901234567.89"


def test_high_precision_decimal_change_reads_modified_not_masked():
    # A genuine 1-cent change in a high-precision DECIMAL data column must remain
    # DISTINCT on the wire, so query_diff/value_diff flags it MODIFIED. If it were
    # coerced to float64 (the cycle-4 regression) both sides collapse to the same
    # value and the change is silently HIDDEN.
    def serialize(dec):
        table = agate.Table([("id-1", dec)], ["id", "amount"], [agate.Text(), agate.Number()])
        return json.loads(DataFrame.from_agate(table).model_dump_json())["data"][0][1]

    base = serialize(Decimal("12345678901234567.89"))
    current = serialize(Decimal("12345678901234567.90"))

    # Exact strings preserved and DISTINCT -> frontend exact-compare -> modified.
    assert base != current, "high-precision change must not be masked"

    # Counterfactual: float64 coercion WOULD have masked it (why from_agate must
    # not coerce data columns).
    assert float(base) == float(current)
