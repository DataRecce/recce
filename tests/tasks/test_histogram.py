import json
from decimal import Decimal

import pytest

import recce.tasks.histogram as histogram
from recce.tasks.histogram import (
    HistogramDiffCheckValidator,
    HistogramDiffTask,
    _is_histogram_supported,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (Decimal("0.11"), Decimal("0.2")),
        (Decimal("2.1"), Decimal("2.5")),
        (Decimal("26"), Decimal("50")),
    ],
)
def test_nice_histogram_width(raw, expected):
    """Catch widths that do not round up to the specified nice series."""
    assert histogram.nice_histogram_width(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (Decimal("0.001"), Decimal("0.001")),
        (Decimal("0.01"), Decimal("0.01")),
        (Decimal("0.0100001"), Decimal("0.02")),
        (Decimal("0.025"), Decimal("0.025")),
        (Decimal("0.0250001"), Decimal("0.05")),
        (Decimal("0.05"), Decimal("0.05")),
        (Decimal("0.0500001"), Decimal("0.1")),
        (Decimal("1"), Decimal("1")),
        (Decimal("1.000001"), Decimal("2")),
    ],
)
def test_nice_histogram_width_ceilings_are_decimal_exact(raw, expected):
    """Catch boundary rounding that selects a smaller or non-series width."""
    assert histogram.nice_histogram_width(raw) == expected


def test_numeric_histogram_geometry_anchors_only_the_first_zero_width():
    """Catch zero anchoring after the first width above the minimum."""
    first = histogram.numeric_histogram_geometry(Decimal("0.2"), Decimal("1.0"), 4)
    second = histogram.numeric_histogram_geometry(Decimal("0.21"), Decimal("1.0"), 4)

    assert first.bin_edges[0] == Decimal("0")
    assert second.bin_edges[0] == Decimal("0.2")


@pytest.mark.parametrize(
    ("minimum", "maximum", "num_bins", "is_integer", "first_edge", "last_edge"),
    [
        (Decimal("0"), Decimal("100"), 50, True, Decimal("0"), Decimal("100")),
        (Decimal("4"), Decimal("4"), 50, True, Decimal("4"), Decimal("5")),
        (Decimal("-23"), Decimal("-3"), 50, True, Decimal("-23"), Decimal("-3")),
        (Decimal("-1.1"), Decimal("1.1"), 50, False, Decimal("-1.1"), Decimal("1.1")),
        (Decimal("0.11"), Decimal("0.89"), 4, False, Decimal("0"), Decimal("1.0")),
        (Decimal("-2"), Decimal("12"), 50, True, Decimal("-2"), Decimal("12")),
    ],
)
def test_numeric_histogram_geometry_covers_literal_domains(
    minimum, maximum, num_bins, is_integer, first_edge, last_edge
):
    """Catch geometry that starts at observations or excludes a union endpoint."""
    geometry = histogram.numeric_histogram_geometry(minimum, maximum, num_bins, is_integer=is_integer)

    assert geometry.bin_edges[0] == first_edge
    assert geometry.bin_edges[-1] == last_edge
    assert geometry.bin_edges[0] <= minimum <= geometry.bin_edges[-1]
    assert geometry.bin_edges[0] <= maximum <= geometry.bin_edges[-1]
    assert len(geometry.bin_edges) == geometry.num_bins + 1
    if is_integer:
        assert geometry.width >= Decimal("1")


@pytest.mark.parametrize(
    ("values", "expected_counts"),
    [
        ([Decimal("0"), Decimal("0.5"), Decimal("2")], [1, 1, 0, 1]),
        ([Decimal("0"), Decimal("1"), Decimal("3")], [1, 1, 1]),
    ],
)
def test_histogram_bucket_index_counts_internal_and_terminal_edges_once(values, expected_counts):
    """Catch terminal escape or internal-boundary double counting."""
    geometry = histogram.numeric_histogram_geometry(values[0], values[-1], len(expected_counts))
    counts = [0] * geometry.num_bins

    for value in values:
        counts[histogram.histogram_bucket_index(value, geometry)] += 1

    assert counts == expected_counts
    assert sum(counts) == len(values)


def test_histogram_sql_uses_plain_decimal_literals_and_terminal_rule():
    """Catch SQL that leaks exponent literals or lets a terminal maximum escape."""
    sql, _ = histogram.generate_histogram_sql_numeric(
        "customers",
        "amount",
        Decimal("0.000001"),
        Decimal("0.000003"),
        2,
    )

    assert "0.000001" in sql
    assert "0.000003" in sql
    assert "E-" not in sql.upper()
    assert "WHEN amount = (SELECT max_value FROM bin_parameters) THEN 1" in sql


def test_histogram(dbt_test_helper):
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        4,Dolly,50
        """

    dbt_test_helper.create_model("customers", csv_data, csv_data)

    params = {"model": "customers", "column_name": "age", "column_type": "int"}

    task = HistogramDiffTask(params)
    run_result = task.execute()

    # {
    #     'base': {'counts': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 'total': 4},
    #     'current': {'counts': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 'total': 4},
    #     'min': 25, 'max': 50,
    #     'bin_edges': [25, 26, ..., 50],
    #     'labels': ['25-26', ..., '50-51']
    # }
    assert run_result["current"]["counts"][0] == 1
    assert run_result["current"]["counts"][-1] == 1
    assert run_result["current"]["total"] == 4
    assert run_result["min"] == 25
    assert run_result["max"] == 50
    assert run_result["bin_edges"][0] == 25
    assert run_result["bin_edges"][-1] == 50
    assert len(run_result["current"]["counts"]) == len(run_result["bin_edges"]) - 1
    assert sum(run_result["current"]["counts"]) == run_result["current"]["total"]
    assert run_result["labels"]
    json.dumps(run_result)


def test_histogram_emtpy(dbt_test_helper):
    csv_data = """
    customer_id,name,age
    1,Alice,30
    2,Bob,25
    3,Charlie,35
    4,Dolly,50
    """

    csv_data_zero = """
    customer_id,name,age
    """

    dbt_test_helper.create_model("customers", csv_data_zero, csv_data_zero)
    dbt_test_helper.create_model("customers2", csv_data, csv_data_zero)
    dbt_test_helper.create_model("customers3", csv_data_zero, csv_data)

    params = {"model": "customers", "column_name": "age", "column_type": "int"}

    task = HistogramDiffTask(params)
    run_result = task.execute()

    assert len(run_result["current"]["counts"]) == 0
    assert run_result["current"]["total"] == 0
    assert run_result["min"] is None
    assert run_result["max"] is None
    assert len(run_result["bin_edges"]) == 0

    params = {"model": "customers2", "column_name": "age", "column_type": "int"}

    task = HistogramDiffTask(params)
    run_result = task.execute()
    assert run_result["base"]["counts"][0] == 1
    assert run_result["base"]["counts"][-1] == 1
    assert run_result["base"]["total"] == 4
    assert run_result["current"]["counts"][0] == 0
    assert run_result["current"]["counts"][-1] == 0
    assert run_result["current"]["total"] == 0
    assert run_result["min"] == 25
    assert run_result["max"] == 50
    assert run_result["bin_edges"][0] == 25
    assert run_result["bin_edges"][-1] == 50

    params = {"model": "customers3", "column_name": "age", "column_type": "int"}

    task = HistogramDiffTask(params)
    run_result = task.execute()
    assert run_result["base"]["counts"][0] == 0
    assert run_result["base"]["counts"][-1] == 0
    assert run_result["base"]["total"] == 0
    assert run_result["current"]["counts"][0] == 1
    assert run_result["current"]["counts"][-1] == 1
    assert run_result["current"]["total"] == 4
    assert run_result["min"] == 25
    assert run_result["max"] == 50
    assert run_result["bin_edges"][0] == 25
    assert run_result["bin_edges"][-1] == 50


def test_validator():
    def validate(params: dict = {}, view_options: dict = {}):
        HistogramDiffCheckValidator().validate(
            {
                "name": "test",
                "type": "histogram_diff",
                "params": params,
                "view_options": view_options,
            }
        )

    validate(
        {
            "model": "customers",
            "column_name": "age",
            "column_type": "int",
        }
    )

    with pytest.raises(ValueError):
        validate({})


def test_is_column_type_supported_by_histogram():
    assert _is_histogram_supported("varchar") is False
    assert _is_histogram_supported("varchar(16)") is False
    assert _is_histogram_supported("varchar(256)") is False
    assert _is_histogram_supported("bool") is False
    assert _is_histogram_supported("int") is True
