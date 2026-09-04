import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

import recce.tasks.histogram as histogram
from recce.tasks.histogram import (
    HistogramDiffCheckValidator,
    HistogramDiffTask,
    _is_histogram_supported,
)

HISTOGRAM_TYPE_POLICY = json.loads(
    (Path(__file__).parents[1] / "fixtures" / "histogram_type_policy.json").read_text(encoding="utf-8")
)
UNSUPPORTED_TIME_TYPES = [case["type"] for case in HISTOGRAM_TYPE_POLICY if not case["backend_supported"]]
SUPPORTED_TEMPORAL_TYPES = [
    case["type"] for case in HISTOGRAM_TYPE_POLICY if case["backend_supported"] and not case["picker_supported"]
]


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


class HistogramRows:
    def __init__(self, rows):
        self.rows = rows


class NumericHistogramQueryTask:
    def __init__(self, base_rows, current_rows):
        self.base_rows = HistogramRows(base_rows)
        self.current_rows = HistogramRows(current_rows)

    def execute_sql(self, _sql, *, base):
        return self.base_rows if base else self.current_rows

    def check_cancel(self):
        return None


class DecimalExtremaHistogramTask(HistogramDiffTask):
    def __init__(self, minimum, maximum, column_type="NUMERIC"):
        super().__init__({"model": "numbers", "column_name": "amount", "column_type": column_type, "num_bins": 1})
        self.minimum = minimum
        self.maximum = maximum

    def execute_sql(self, sql, *, base):
        if "MIN(" in sql:
            return [(self.minimum, self.maximum, 1)]
        return HistogramRows([(0, 1)])


@pytest.mark.parametrize(
    ("column_type", "expected"),
    [
        ("INTEGER", True),
        ("INT64", True),
        ("NUMERIC", False),
        ("NUMBER", False),
        ("NUMERIC(20, 4)", False),
        ("NUMBER(20, 4)", False),
        ("NUMERIC(20, 0)", True),
        ("NUMBER(20)", True),
        ("DECIMAL(20, 0)", True),
    ],
)
def test_histogram_integral_type_detection_respects_precision_and_scale(column_type, expected):
    """Catch fractional adapter types being routed through the integer width safeguard."""
    assert histogram.is_integral_histogram_type(column_type) is expected


def test_fractional_histogram_uses_decimal_edges_for_labels_and_real_sql_boundaries(dbt_test_helper):
    """Catch fractional label failures and floating internal/terminal misbucketing."""
    base_csv = """
        id,amount
        1,0.0
        2,0.2
        3,0.4
        4,0.6
        5,0.8
    """
    current_csv = """
        id,amount
        1,0.0
        2,0.2
        3,0.4
        4,0.6
        5,0.8
        6,1.0
    """
    dbt_test_helper.create_model("fractional_boundaries", base_csv, current_csv)

    result = HistogramDiffTask(
        {
            "model": "fractional_boundaries",
            "column_name": "amount",
            "column_type": "NUMERIC",
            "num_bins": 5,
        }
    ).execute()

    assert result["min"] == 0.0
    assert result["max"] == 1.0
    assert result["bin_edges"] == [0, 0.2, 0.4, 0.6, 0.8, 1]
    assert result["labels"] == ["0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1", "1-1.2"]
    assert result["base"] == {"counts": [1, 1, 1, 1, 1], "total": 5}
    assert result["current"] == {"counts": [1, 1, 1, 1, 2], "total": 6}
    assert len(result["base"]["counts"]) == len(result["bin_edges"]) - 1
    assert len(result["current"]["counts"]) == len(result["bin_edges"]) - 1
    json.dumps(result)


@pytest.mark.parametrize(
    "model_name,base_csv,current_csv,first_edge,last_edge,base_nonzero,current_nonzero",
    [
        (
            "sparse_histogram",
            """id,amount\n1,0\n2,100""",
            """id,amount\n1,5\n2,95""",
            0,
            100,
            {0: 1, 49: 1},
            {2: 1, 47: 1},
        ),
        (
            "constant_histogram",
            """id,amount\n1,4""",
            """id,amount\n1,4""",
            4,
            5,
            {0: 1},
            {0: 1},
        ),
        (
            "negative_histogram",
            """id,amount\n1,-23\n2,-3""",
            """id,amount\n1,-20\n2,-10""",
            -23,
            -3,
            {0: 1, 19: 1},
            {3: 1, 13: 1},
        ),
        (
            "mixed_histogram",
            """id,amount\n1,-2\n2,12""",
            """id,amount\n1,-1\n2,10""",
            -2,
            12,
            {0: 1, 13: 1},
            {1: 1, 12: 1},
        ),
        (
            "disjoint_histogram",
            """id,amount\n1,-2\n2,-1""",
            """id,amount\n1,10\n2,12""",
            -2,
            12,
            {0: 1, 1: 1},
            {12: 1, 13: 1},
        ),
    ],
)
def test_integer_histogram_result_preserves_union_domain_and_each_side(
    dbt_test_helper, model_name, base_csv, current_csv, first_edge, last_edge, base_nonzero, current_nonzero
):
    """Catch result paths that omit a side, union endpoint, or expected bucket count."""
    dbt_test_helper.create_model(model_name, base_csv, current_csv)

    result = HistogramDiffTask({"model": model_name, "column_name": "amount", "column_type": "INTEGER"}).execute()

    assert result["bin_edges"][0] == first_edge
    assert result["bin_edges"][-1] == last_edge
    assert result["labels"]
    for side, expected_nonzero in (("base", base_nonzero), ("current", current_nonzero)):
        counts = result[side]["counts"]
        assert len(counts) == len(result["bin_edges"]) - 1
        assert sum(counts) == result[side]["total"] == sum(expected_nonzero.values())
        assert {index: count for index, count in enumerate(counts) if count} == expected_nonzero
    json.dumps(result)


@pytest.mark.parametrize(
    ("minimum", "maximum"),
    [
        (Decimal("1E-400"), Decimal("3E-400")),
        (Decimal("1E400"), Decimal("3E400")),
        (Decimal("1" + "0" * 400 + ".1"), Decimal("1" + "0" * 400 + ".9")),
    ],
)
def test_numeric_histogram_query_rejects_decimal_edges_that_cannot_round_trip(minimum, maximum):
    """Catch JSON edge conversion that underflows, overflows, or changes the Decimal domain."""
    task = NumericHistogramQueryTask([(0, 1)], [(0, 1)])

    with pytest.raises(ValueError, match="cannot be represented as a finite JSON number without value change"):
        histogram.query_numeric_histogram(task, "numbers", "amount", "NUMERIC", minimum, maximum, 2)


@pytest.mark.parametrize(
    ("minimum", "maximum"),
    [
        (Decimal("1" + "0" * 400 + ".1"), Decimal("1" + "0" * 400 + ".9")),
        (Decimal("1E-400"), Decimal("3E-400")),
    ],
)
def test_histogram_task_rejects_decimal_extrema_outside_float_range(dbt_test_helper, minimum, maximum):
    """Catch task results that expose an overflowing or underflowing extremum as a JSON number."""
    with pytest.raises(ValueError, match="cannot be represented as a finite JSON number"):
        DecimalExtremaHistogramTask(minimum, maximum).execute()


@pytest.mark.parametrize(
    ("column_type", "minimum", "maximum"),
    [
        ("BIGINT", Decimal("9007199254740993"), Decimal("9007199254741993")),
        ("INT64", Decimal("1724544000123456789"), Decimal("1724544999123456789")),
        ("NUMERIC(38, 18)", Decimal("1.234567890123456789"), Decimal("9.876543210987654321")),
    ],
)
def test_histogram_task_reports_extrema_beyond_double_precision(dbt_test_helper, column_type, minimum, maximum):
    """Catch a histogram that computed correctly being failed by its own min/max echo."""
    task = DecimalExtremaHistogramTask(minimum, maximum, column_type=column_type)

    result = task.execute()

    assert result["bin_edges"][0] <= minimum
    assert result["bin_edges"][-1] >= maximum
    assert result["min"] == pytest.approx(float(minimum))
    assert result["max"] == pytest.approx(float(maximum))
    json.dumps(result)


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
    assert run_result["labels"] == []
    json.dumps(run_result)

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
    assert len(run_result["base"]["counts"]) == len(run_result["bin_edges"]) - 1
    assert len(run_result["current"]["counts"]) == len(run_result["bin_edges"]) - 1
    assert run_result["labels"]
    json.dumps(run_result)

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
    assert len(run_result["base"]["counts"]) == len(run_result["bin_edges"]) - 1
    assert len(run_result["current"]["counts"]) == len(run_result["bin_edges"]) - 1
    assert run_result["labels"]
    json.dumps(run_result)


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

    with pytest.raises(ValueError, match="not supported"):
        validate(
            {
                "model": "customers",
                "column_name": "time_col",
                "column_type": "TIME",
            }
        )

    with pytest.raises(ValueError, match="not supported"):
        validate(
            {
                "model": "customers",
                "column_name": "timetz_col",
                "column_type": "TIMETZ",
            }
        )


def test_is_column_type_supported_by_histogram():
    assert _is_histogram_supported("varchar") is False
    assert _is_histogram_supported("varchar(16)") is False
    assert _is_histogram_supported("varchar(256)") is False
    assert _is_histogram_supported("bool") is False
    assert _is_histogram_supported("int") is True
    assert _is_histogram_supported("TIME") is False
    assert _is_histogram_supported("time") is False
    assert _is_histogram_supported("TIMETZ") is False
    assert _is_histogram_supported("timetz") is False
    assert _is_histogram_supported("DATE") is True
    assert _is_histogram_supported("DATETIME") is True
    assert _is_histogram_supported("TIMESTAMP") is True
    assert _is_histogram_supported("TIMESTAMPTZ") is True


@pytest.mark.parametrize("case", HISTOGRAM_TYPE_POLICY, ids=lambda case: case["type"].strip())
def test_histogram_backend_matches_shared_type_policy(case):
    """Catch backend policy drift for time-only, temporal, and unknown adapter types."""
    assert _is_histogram_supported(case["type"]) is case["backend_supported"]


@pytest.mark.parametrize("column_type", SUPPORTED_TEMPORAL_TYPES)
def test_supported_temporal_aliases_use_datetime_execution_and_result_shape(column_type, monkeypatch):
    """Catch supported temporal aliases falling through to numeric SQL or numeric result conversion."""
    minimum = date(2026, 1, 1)
    maximum = date(2026, 1, 2)
    task = HistogramDiffTask(
        {
            "model": "customers",
            "column_name": "created_at",
            "column_type": column_type,
        }
    )
    task.execute_sql = MagicMock(return_value=[(minimum, maximum, 1)])
    adapter = MagicMock()
    monkeypatch.setattr(histogram, "default_context", lambda: SimpleNamespace(adapter=adapter))
    monkeypatch.setattr(
        histogram,
        "query_datetime_histogram",
        MagicMock(
            return_value=(
                {"counts": [1]},
                {"counts": [1]},
                [minimum, maximum],
            )
        ),
    )
    monkeypatch.setattr(
        histogram,
        "query_numeric_histogram",
        MagicMock(side_effect=AssertionError("temporal alias entered numeric histogram execution")),
    )

    assert task.execute() == {
        "base": {"counts": [1], "total": 1},
        "current": {"counts": [1], "total": 1},
        "min": minimum,
        "max": maximum,
        "bin_edges": [minimum, maximum],
        "labels": None,
    }


@pytest.mark.parametrize("column_type", UNSUPPORTED_TIME_TYPES)
def test_histogram_task_rejects_every_time_alias_before_context_or_sql(column_type, monkeypatch):
    """Catch time-only aliases reaching adapter setup or a warehouse query."""

    def fail_if_context_is_opened():
        raise AssertionError("unsupported histogram type reached adapter setup")

    monkeypatch.setattr(histogram, "default_context", fail_if_context_is_opened)

    with pytest.raises(ValueError, match="not supported for histogram analysis"):
        HistogramDiffTask(
            {
                "model": "customers",
                "column_name": "time_col",
                "column_type": column_type,
            }
        )


@pytest.mark.parametrize("column_type", UNSUPPORTED_TIME_TYPES)
def test_histogram_check_validator_rejects_every_time_alias(column_type):
    """Catch saved checks accepting an alias that direct histogram tasks reject."""
    with pytest.raises(ValueError, match="not supported for histogram analysis"):
        HistogramDiffCheckValidator().validate(
            {
                "name": "time histogram",
                "type": "histogram_diff",
                "params": {
                    "model": "customers",
                    "column_name": "time_col",
                    "column_type": column_type,
                },
            }
        )


def test_histogram_rejects_time_columns_before_sql(dbt_test_helper):
    params_time = {"model": "customers", "column_name": "log_time", "column_type": "TIME"}
    with pytest.raises(ValueError, match="Column type TIME is not supported for histogram analysis"):
        HistogramDiffTask(params_time)

    params_timetz = {"model": "customers", "column_name": "log_time_tz", "column_type": "TIMETZ"}
    with pytest.raises(ValueError, match="Column type TIMETZ is not supported for histogram analysis"):
        HistogramDiffTask(params_timetz)
