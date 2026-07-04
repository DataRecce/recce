"""
Regression tests for DRC-3025: numeric profile stats must reach the frontend as
JSON *numbers*, not Decimal-serialized strings.

Root cause: agate `Number` values arrive as `Decimal`. `DataFrame.from_agate`
used to keep finite Decimals as-is, and pydantic v2 serializes `Decimal` as a
JSON *string*. So an unchanged table whose `avg` stat is
`Decimal("0.30000000000000004")` reached the grid as the string
`"0.30000000000000004"` and compared unequal to `"0.3"` — a phantom float diff
that the grid's numeric epsilon could never catch (it only fires on numbers).

The fix coerces finite `Decimal` values in NUMBER-typed columns to `float` at
the source (`from_agate`), so the value is a real number end-to-end.
"""

import json
from decimal import Decimal

import agate

from recce.tasks.dataframe import DataFrame, DataFrameColumnType


def _profile_table(avg_value, count_value=Decimal("1000")):
    """An agate table shaped like a one-column profile: PK + a NUMBER avg stat."""
    return agate.Table(
        [("CUSTOMER_ID", avg_value, count_value)],
        ["column_name", "avg", "row_count"],
        [agate.Text(), agate.Number(), agate.Number()],
    )


def test_number_column_finite_decimal_serializes_as_json_number():
    # A finite Decimal in a NUMBER column must serialize as a JSON number, not a
    # string. This is the exact DRC-3025 root: pre-fix this value was the string
    # "0.30000000000000004".
    df = DataFrame.from_agate(_profile_table(Decimal("0.30000000000000004")))

    assert df.columns[1].type == DataFrameColumnType.NUMBER
    # In-memory: coerced to float, not left as Decimal.
    assert isinstance(df.data[0][1], float)

    serialized = json.loads(df.model_dump_json())
    avg = serialized["data"][0][1]
    assert isinstance(avg, float), f"expected JSON number, got {type(avg).__name__} {avg!r}"


def test_profile_float_noise_pair_is_numerically_comparable():
    # An unchanged table: base avg = 0.1 + 0.2, current avg = 0.3. Both must
    # serialize as numbers whose difference is float noise (well within the
    # grid's 1e-9 relative epsilon), so the diff reads UNCHANGED downstream.
    base = json.loads(DataFrame.from_agate(_profile_table(Decimal(repr(0.1 + 0.2)))).model_dump_json())
    current = json.loads(DataFrame.from_agate(_profile_table(Decimal("0.3"))).model_dump_json())

    base_avg = base["data"][0][1]
    current_avg = current["data"][0][1]
    assert isinstance(base_avg, float) and isinstance(current_avg, float)
    # Not string-equal (the raw tails differ) but numerically within float noise.
    assert abs(base_avg - current_avg) <= 1e-9 * max(abs(base_avg), abs(current_avg))


def test_genuine_number_change_still_differs():
    # Control: a real change must remain distinguishable after coercion.
    base = json.loads(DataFrame.from_agate(_profile_table(Decimal("100.0"))).model_dump_json())
    current = json.loads(DataFrame.from_agate(_profile_table(Decimal("100.5"))).model_dump_json())
    base_avg = base["data"][0][1]
    current_avg = current["data"][0][1]
    assert abs(base_avg - current_avg) > 1e-9 * max(abs(base_avg), abs(current_avg))


def test_nonfinite_decimal_still_coerced_to_float():
    # Preserve the pre-existing GitHub #476 behavior: non-finite Decimals
    # (Infinity/NaN) are not JSON-serializable and must become float.
    df_inf = DataFrame.from_agate(_profile_table(Decimal("Infinity")))
    df_nan = DataFrame.from_agate(_profile_table(Decimal("NaN")))
    assert isinstance(df_inf.data[0][1], float)
    assert isinstance(df_nan.data[0][1], float)


def test_integer_column_left_as_is():
    # INTEGER columns are intentionally NOT coerced by the fix: they compare
    # exactly (no float noise) and float64 would lose precision above 2**53.
    # agate Integer values are already Python ints, so they serialize as JSON
    # numbers without any Decimal-string detour.
    import dbt_common.clients.agate_helper as agate_helper

    tbl = agate.Table(
        [("CUSTOMER_ID", 1000)],
        ["column_name", "row_count"],
        [agate.Text(), agate_helper.Integer()],
    )
    df = DataFrame.from_agate(tbl)
    assert df.columns[1].type == DataFrameColumnType.INTEGER
    serialized = json.loads(df.model_dump_json())
    row_count = serialized["data"][0][1]
    assert isinstance(row_count, int)
    assert row_count == 1000
