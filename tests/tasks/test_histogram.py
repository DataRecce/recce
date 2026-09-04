import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.encoders import jsonable_encoder

import recce.tasks.histogram as histogram
from recce.tasks.histogram import (
    HistogramDiffCheckValidator,
    HistogramDiffParams,
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


@pytest.fixture(autouse=True)
def isolate_histogram_telemetry(monkeypatch):
    """Keep unit/integration tests from scheduling the process-wide event collector."""
    monkeypatch.setattr(histogram, "log_performance", MagicMock())


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
    ("params_update", "stored_value", "execution_request", "effective_bins"),
    [
        ({}, 50, 50, 50),
        ({"num_bins": None}, None, 50, 50),
        ({"num_bins": 0}, 0, 50, 50),
        ({"num_bins": False}, 0, 50, 50),
        ({"num_bins": -3}, -3, -3, 1),
        ({"num_bins": "-3"}, -3, -3, 1),
        ({"num_bins": " 7 "}, 7, 7, 7),
        ({"num_bins": 1.0}, 1, 1, 1),
        ({"num_bins": "1.0"}, 1, 1, 1),
        ({"num_bins": True}, 1, 1, 1),
        ({"num_bins": 10000}, 10000, 10000, 10000),
    ],
)
def test_histogram_num_bins_accepted_compatibility_matrix(
    params_update, stored_value, execution_request, effective_bins
):
    """Freeze accepted coercions/defaults while compact SQL removes the growth cost."""
    params = HistogramDiffParams(
        model="numbers",
        column_name="amount",
        column_type="INTEGER",
        **params_update,
    )

    assert params.num_bins == stored_value
    if params.num_bins is not None:
        assert type(params.num_bins) is int
    requested = params.num_bins or 50
    assert requested == execution_request
    geometry = histogram.numeric_histogram_geometry(
        Decimal("0"),
        Decimal(str(effective_bins)),
        requested,
        is_integer=True,
    )
    assert geometry.num_bins == effective_bins


@pytest.mark.parametrize("num_bins", [2.5, "2.5"])
def test_histogram_num_bins_still_rejects_fractional_inputs(num_bins):
    """Catch optimization work broadening the request contract by accident."""
    with pytest.raises(ValueError):
        HistogramDiffParams(
            model="numbers",
            column_name="amount",
            column_type="INTEGER",
            num_bins=num_bins,
        )


def test_histogram_num_bins_has_no_new_model_or_strategy_cap():
    """Catch either request parsing or compact dispatch imposing a hidden ceiling."""
    params = HistogramDiffParams(
        model="numbers",
        column_name="amount",
        column_type="INTEGER",
        num_bins=1_000_000,
    )
    plan = histogram.select_histogram_bucketing(
        adapter_type="duckdb",
        column_sql="amount",
        column_type="INTEGER",
        minimum=Decimal("0"),
        maximum=Decimal("1000000"),
        width=Decimal("1"),
        num_bins=params.num_bins,
    )

    assert params.num_bins == 1_000_000
    assert plan.strategy == "duckdb_scaled_integer"
    assert plan.bin_expression is not None
    assert len(plan.bin_expression) < 1500


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


@pytest.mark.parametrize(
    ("adapter_type", "column_type"),
    [
        ("sqlite", "DECIMAL(18, 6)"),
        ("postgres", "INTEGER"),
        ("duckdb", "DOUBLE"),
        ("duckdb", "NUMERIC"),
        ("duckdb", "DECIMAL(38, 0)"),
        ("duckdb", "HUGEINT"),
    ],
)
def test_unproven_histogram_strategies_preserve_the_literal_ladder(adapter_type, column_type):
    """Catch fallback dispatch changing exact ordered-comparison SQL."""
    generated = histogram._generate_histogram_sql_for_adapter(
        "customers",
        "amount",
        Decimal("0"),
        Decimal("1"),
        5,
        Decimal("0.2"),
        adapter_type=adapter_type,
        column_type=column_type,
    )
    existing_sql, existing_width = histogram.generate_histogram_sql_numeric(
        "customers",
        "amount",
        Decimal("0"),
        Decimal("1"),
        5,
        Decimal("0.2"),
    )

    assert generated.strategy == "literal_ordered_comparison"
    assert generated.sql == existing_sql
    assert generated.bin_size == existing_width
    assert generated.sql.count("WHEN amount <") == 5


def test_duckdb_compact_generator_is_bounded_at_ten_thousand_bins():
    """Catch compact dispatch retaining a hidden per-bin SQL fragment."""
    generated = histogram._generate_histogram_sql_for_adapter(
        "customers",
        "amount",
        Decimal("0"),
        Decimal("10000"),
        10000,
        Decimal("1"),
        adapter_type="duckdb",
        column_type="INTEGER",
    )

    assert generated.strategy == "duckdb_scaled_integer"
    assert len(generated.sql) < 5000
    assert generated.sql.count("WHEN amount <") == 0


class HistogramRows:
    def __init__(self, rows):
        self.rows = rows


class NumericHistogramQueryTask:
    def __init__(self, base_rows, current_rows):
        self.base_rows = HistogramRows(base_rows)
        self.current_rows = HistogramRows(current_rows)
        self.executed_sql = []

    def execute_sql(self, sql, *, base):
        self.executed_sql.append(sql)
        return self.base_rows if base else self.current_rows

    def check_cancel(self):
        return None


class DatetimeHistogramQueryTask:
    def __init__(self, base_rows=(), current_rows=(), *, fail_base=False, fail_current=False):
        self.base_rows = HistogramRows(base_rows)
        self.current_rows = HistogramRows(current_rows)
        self.fail_base = fail_base
        self.fail_current = fail_current

    def execute_sql(self, _sql, *, base):
        if (base and self.fail_base) or (not base and self.fail_current):
            raise RuntimeError("warehouse query failed")
        return self.base_rows if base else self.current_rows

    def check_cancel(self):
        return None


def create_typed_histogram_model(
    dbt_test_helper,
    model_name,
    column_type,
    values,
    *,
    current_column_type=None,
    current_values=None,
):
    """Create matching real DuckDB relations plus dbt manifest/catalog entries."""
    current_column_type = current_column_type or column_type
    current_values = values if current_values is None else current_values
    adapter = dbt_test_helper.adapter
    with adapter.connection_named("create typed histogram model"):
        for schema, physical_type, environment_values in (
            (dbt_test_helper.base_schema, column_type, values),
            (dbt_test_helper.curr_schema, current_column_type, current_values),
        ):
            value_rows = ", ".join("(NULL)" if value is None else f"({value})" for value in environment_values)
            adapter.execute(f"CREATE TABLE {schema}.{model_name} (amount {physical_type})")
            adapter.execute(f"INSERT INTO {schema}.{model_name} VALUES {value_rows}")

    model_sql = f"select cast(amount as {column_type}) as amount from source_values"
    current_model_sql = f"select cast(amount as {current_column_type}) as amount from source_values"
    dbt_test_helper.create_model(
        model_name,
        base_sql=model_sql,
        curr_sql=current_model_sql,
        base_columns={"amount": column_type},
        curr_columns={"amount": current_column_type},
    )


def execute_histogram_template(dbt_test_helper, sql_template):
    """Compile and execute a histogram template through Recce's real dbt adapter."""
    adapter = dbt_test_helper.adapter
    with adapter.connection_named("execute histogram strategy"):
        sql = adapter.generate_sql(sql_template, base=True)
        _, result = adapter.execute(sql, fetch=True, auto_begin=True)
    return [(row[0], row[1]) for row in result.rows]


def test_daily_datetime_histogram_edges_cross_months_monotonically():
    """Catch absolute ``relativedelta(day=...)`` fields resetting edges within a month."""
    task = DatetimeHistogramQueryTask(
        base_rows=[(datetime(2026, 1, 30), 2), (date(2026, 1, 31), 3)],
        current_rows=[(date(2026, 2, 1), 5), (datetime(2026, 2, 2), 7)],
    )

    base, current, bin_edges = histogram.query_datetime_histogram(
        task,
        "orders",
        "created_at",
        date(2026, 1, 30),
        date(2026, 2, 2),
    )

    assert bin_edges == [
        date(2026, 1, 30),
        date(2026, 1, 31),
        date(2026, 2, 1),
        date(2026, 2, 2),
        date(2026, 2, 3),
    ]
    assert all(left < right for left, right in zip(bin_edges, bin_edges[1:]))
    serialized_edges = jsonable_encoder(bin_edges)
    assert serialized_edges == ["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02", "2026-02-03"]
    assert serialized_edges == sorted(serialized_edges)
    assert base == {"counts": [2, 3, 0, 0]}
    assert current == {"counts": [0, 0, 5, 7]}


def test_yearly_datetime_histogram_uses_additive_interval_spacing():
    """Catch absolute years and one-year SQL rows escaping a multi-year bucket."""
    task = DatetimeHistogramQueryTask(
        base_rows=[(date(1875, 1, 1), 2), (date(1878, 1, 1), 3), (date(1879, 1, 1), 5)],
        current_rows=[(date(2026, 1, 1), 7)],
    )

    base, current, bin_edges = histogram.query_datetime_histogram(
        task,
        "orders",
        "created_at",
        date(1875, 6, 1),
        date(2026, 8, 1),
    )

    assert bin_edges[0] == date(1875, 1, 1)
    assert bin_edges[-1] == date(2027, 1, 1)
    assert all(right.year - left.year == 4 for left, right in zip(bin_edges, bin_edges[1:]))
    serialized_edges = jsonable_encoder(bin_edges)
    assert serialized_edges == sorted(serialized_edges)
    assert base["counts"][:2] == [5, 5]
    assert sum(base["counts"]) == 10
    assert current["counts"][-1] == 7


def test_datetime_histogram_preserves_the_successful_side_when_one_query_fails():
    """Catch a handled warehouse failure becoming a secondary ``None.rows`` exception."""
    task = DatetimeHistogramQueryTask(
        current_rows=[(date(2026, 1, 1), 4)],
        fail_base=True,
    )

    base, current, bin_edges = histogram.query_datetime_histogram(
        task,
        "orders",
        "created_at",
        date(2026, 1, 1),
        date(2026, 1, 1),
    )

    assert bin_edges == [date(2026, 1, 1), date(2026, 1, 2)]
    assert base == {"counts": []}
    assert current == {"counts": [4]}


def test_datetime_histogram_task_returns_a_stable_partial_payload_when_one_query_fails(monkeypatch):
    """Catch a handled side failure omitting the public counts/total fields."""

    class PartialDatetimeHistogramTask(HistogramDiffTask):
        def execute_sql(self, sql, *, base):
            if "MIN(created_at)" in sql:
                return [(date(2026, 1, 1), date(2026, 1, 1), 4 if base else 7)]
            if base:
                raise RuntimeError("base warehouse query failed")
            return HistogramRows([(date(2026, 1, 1), 7)])

        def check_cancel(self):
            return None

    adapter = MagicMock()
    monkeypatch.setattr(histogram, "default_context", lambda: SimpleNamespace(adapter=adapter))
    task = PartialDatetimeHistogramTask(
        {
            "model": "orders",
            "column_name": "created_at",
            "column_type": "TIMESTAMP",
        }
    )

    assert task.execute() == {
        "base": {"counts": [], "total": 4},
        "current": {"counts": [7], "total": 7},
        "min": date(2026, 1, 1),
        "max": date(2026, 1, 1),
        "bin_edges": [date(2026, 1, 1), date(2026, 1, 2)],
        "labels": None,
    }


@pytest.mark.parametrize(
    ("extreme", "expected_edges"),
    [
        (date(3000, 6, 15), [date(3000, 6, 15), date(3000, 6, 16)]),
        (date.max, [date.max - timedelta(days=1), date.max]),
    ],
)
def test_datetime_histogram_extreme_daily_edges_stay_monotonic_and_bounded(extreme, expected_edges):
    """Catch the year-3000 overflow guard reversing edges or allocating an unbounded range."""
    task = DatetimeHistogramQueryTask(
        base_rows=[(extreme, 3)],
        current_rows=[(extreme, 5)],
    )

    base, current, bin_edges = histogram.query_datetime_histogram(
        task,
        "orders",
        "created_at",
        extreme,
        extreme,
    )

    assert bin_edges == expected_edges
    assert len(bin_edges) == 2
    assert bin_edges[0] < bin_edges[-1]
    assert bin_edges[0] <= extreme <= bin_edges[-1]
    assert base == {"counts": [3]}
    assert current == {"counts": [5]}


def test_datetime_histogram_date_max_yearly_edges_remain_bounded():
    """Catch terminal-date handling allocating by day or capping valid years at 3000."""
    task = DatetimeHistogramQueryTask(
        base_rows=[(date(9999, 1, 1), 3)],
        current_rows=[(date(1900, 1, 1), 5)],
    )

    base, current, bin_edges = histogram.query_datetime_histogram(
        task,
        "orders",
        "created_at",
        date(1900, 1, 1),
        date.max,
    )

    assert bin_edges[0] == date(1900, 1, 1)
    assert bin_edges[-1] == date.max
    assert len(bin_edges) <= 52
    assert all(left < right for left, right in zip(bin_edges, bin_edges[1:]))
    assert sum(base["counts"]) == 3
    assert sum(current["counts"]) == 5


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


def test_duckdb_compact_decimal_execution_owns_exact_internal_and_terminal_boundaries(dbt_test_helper, monkeypatch):
    """Catch fixed DECIMAL bucketing drifting at 0.6 or either side of a boundary."""
    create_typed_histogram_model(
        dbt_test_helper,
        "compact_decimal_boundaries",
        "DECIMAL(18, 6)",
        [
            None,
            "0",
            "0.199999",
            "0.2",
            "0.200001",
            "0.399999",
            "0.4",
            "0.400001",
            "0.599999",
            "0.6",
            "0.600001",
            "0.799999",
            "0.8",
            "0.800001",
            "1",
        ],
    )
    telemetry = MagicMock()
    monkeypatch.setattr(histogram, "log_performance", telemetry, raising=False)

    result = HistogramDiffTask(
        {
            "model": "compact_decimal_boundaries",
            "column_name": "amount",
            "column_type": "DECIMAL(18, 6)",
            "num_bins": 5,
        }
    ).execute()

    assert result["bin_edges"] == [0, 0.2, 0.4, 0.6, 0.8, 1]
    assert result["base"] == {"counts": [2, 3, 3, 3, 3], "total": 14}
    assert result["current"] == result["base"]
    telemetry.assert_called_once()
    feature_name, metrics = telemetry.call_args.args
    assert feature_name == "histogram_sql"
    assert metrics["adapter_type"] == "duckdb"
    assert metrics["strategy"] == "duckdb_scaled_integer"
    assert metrics["effective_bin_count"] == 5
    assert metrics["sql_length"] < 5000


def test_duckdb_compact_decimal_execution_expands_beyond_the_declared_scale(dbt_test_helper, monkeypatch):
    """Catch a generated width with extra decimal places being rounded before bucketing."""
    create_typed_histogram_model(
        dbt_test_helper,
        "compact_decimal_scale_expansion",
        "DECIMAL(12, 2)",
        ["0", "0.01", "0.02"],
    )
    telemetry = MagicMock()
    monkeypatch.setattr(histogram, "log_performance", telemetry, raising=False)

    result = HistogramDiffTask(
        {
            "model": "compact_decimal_scale_expansion",
            "column_name": "amount",
            "column_type": "DECIMAL(12, 2)",
            "num_bins": 10,
        }
    ).execute()

    assert result["bin_edges"] == [0, 0.002, 0.004, 0.006, 0.008, 0.01, 0.012, 0.014, 0.016, 0.018, 0.02]
    assert {index: count for index, count in enumerate(result["base"]["counts"]) if count} == {
        0: 1,
        5: 1,
        9: 1,
    }
    assert telemetry.call_args.args[1]["strategy"] == "duckdb_scaled_integer"


def test_duckdb_compact_decimal_executes_at_the_proven_precision_boundary(dbt_test_helper, monkeypatch):
    """Catch the widest enabled DECIMAL multiply overflowing before its HUGEINT cast."""
    create_typed_histogram_model(
        dbt_test_helper,
        "compact_decimal_precision_boundary",
        "DECIMAL(37, 1)",
        ["0", "500000000000000000000000000000000000.0"],
    )
    telemetry = MagicMock()
    monkeypatch.setattr(histogram, "log_performance", telemetry)

    result = HistogramDiffTask(
        {
            "model": "compact_decimal_precision_boundary",
            "column_name": "amount",
            "column_type": "DECIMAL(37, 1)",
            "num_bins": 1,
        }
    ).execute()

    assert result["base"] == {"counts": [2], "total": 2}
    assert telemetry.call_args.args[1]["strategy"] == "duckdb_scaled_integer"


def test_duckdb_compact_scale_zero_decimal_executes_through_the_integer_cast_path(dbt_test_helper, monkeypatch):
    """Catch DECIMAL(..., 0) being cast or multiplied with lossy semantics."""
    create_typed_histogram_model(
        dbt_test_helper,
        "compact_scale_zero_decimal",
        "DECIMAL(18, 0)",
        ["0", "2", "3", "5", "10"],
    )
    telemetry = MagicMock()
    monkeypatch.setattr(histogram, "log_performance", telemetry, raising=False)

    result = HistogramDiffTask(
        {
            "model": "compact_scale_zero_decimal",
            "column_name": "amount",
            "column_type": "DECIMAL(18, 0)",
            "num_bins": 4,
        }
    ).execute()

    assert result["bin_edges"] == [0, 2.5, 5, 7.5, 10]
    assert result["base"] == {"counts": [2, 1, 1, 1], "total": 5}
    assert telemetry.call_args.args[1]["strategy"] == "duckdb_scaled_integer"


def test_duckdb_compact_large_decimal_geometry_executes_without_context_rounding(dbt_test_helper):
    """Catch a 37-digit minimum being rounded up to the next boundary."""
    minimum = Decimal("1234567890123456789012345678900000000")
    maximum = Decimal("1234567890123456789012345679900000000")
    create_typed_histogram_model(
        dbt_test_helper,
        "compact_large_decimal_geometry",
        "DECIMAL(37, 0)",
        [
            "1234567890123456789012345678900000000",
            "1234567890123456789012345679000000000",
            "1234567890123456789012345679900000000",
        ],
    )
    generated = histogram._generate_histogram_sql_for_adapter(
        "compact_large_decimal_geometry",
        "amount",
        minimum,
        maximum,
        10,
        Decimal("100000000"),
        adapter_type="duckdb",
        column_type="DECIMAL(37, 0)",
    )

    compiled = dbt_test_helper.adapter.generate_sql(generated.sql, base=True)
    with dbt_test_helper.adapter.connection_named("execute compact large-decimal histogram"):
        _, table = dbt_test_helper.adapter.execute(compiled, fetch=True, auto_begin=True)

    assert generated.strategy == "duckdb_scaled_integer"
    assert {row[0]: row[1] for row in table.rows} == {0: 1, 1: 1, 9: 1}


def test_duckdb_falls_back_when_base_and_current_physical_types_differ(dbt_test_helper, monkeypatch):
    """Catch one environment's integer type authorizing a lossy cast in the other."""
    create_typed_histogram_model(
        dbt_test_helper,
        "mixed_physical_histogram_types",
        "INTEGER",
        ["0", "2", "10"],
        current_column_type="DOUBLE",
        current_values=["0", "1.9", "2", "10"],
    )
    telemetry = MagicMock()
    monkeypatch.setattr(histogram, "log_performance", telemetry)

    result = HistogramDiffTask(
        {
            "model": "mixed_physical_histogram_types",
            "column_name": "amount",
            "column_type": "INTEGER",
            "num_bins": 5,
        }
    ).execute()

    assert result["base"] == {"counts": [1, 1, 0, 0, 1], "total": 3}
    assert result["current"] == {"counts": [2, 1, 0, 0, 1], "total": 4}
    assert telemetry.call_args.args[1]["strategy"] == "literal_ordered_comparison"


def test_duckdb_falls_back_when_saved_type_is_stale_for_both_relations(dbt_test_helper, monkeypatch):
    """Catch stale saved INTEGER metadata compact-casting two physical DOUBLE columns."""
    create_typed_histogram_model(
        dbt_test_helper,
        "stale_saved_histogram_type",
        "DOUBLE",
        ["0", "1.9", "2", "10"],
    )
    telemetry = MagicMock()
    monkeypatch.setattr(histogram, "log_performance", telemetry)

    result = HistogramDiffTask(
        {
            "model": "stale_saved_histogram_type",
            "column_name": "amount",
            "column_type": "INTEGER",
            "num_bins": 5,
        }
    ).execute()

    assert result["base"] == {"counts": [2, 1, 0, 0, 1], "total": 4}
    assert result["current"] == result["base"]
    assert telemetry.call_args.args[1]["strategy"] == "literal_ordered_comparison"


def test_duckdb_decimal_38_executes_with_the_exact_literal_fallback(dbt_test_helper, monkeypatch):
    """Catch overflow-risk DECIMAL input being compacted instead of executing the safe ladder."""
    create_typed_histogram_model(
        dbt_test_helper,
        "fallback_decimal_38",
        "DECIMAL(38, 0)",
        ["0", "2", "5"],
    )
    telemetry = MagicMock()
    monkeypatch.setattr(histogram, "log_performance", telemetry)

    result = HistogramDiffTask(
        {
            "model": "fallback_decimal_38",
            "column_name": "amount",
            "column_type": "DECIMAL(38, 0)",
            "num_bins": 5,
        }
    ).execute()

    assert result["base"] == {"counts": [1, 0, 1, 0, 1], "total": 3}
    assert telemetry.call_args.args[1]["strategy"] == "literal_ordered_comparison"


def test_duckdb_compact_integer_execution_preserves_negative_domain_boundaries(dbt_test_helper, monkeypatch):
    """Catch negative values being bucketed with truncation rather than exact edge ownership."""
    create_typed_histogram_model(
        dbt_test_helper,
        "compact_negative_integer",
        "INTEGER",
        ["-10", "-9", "-8", "-7", "0", "9", "10"],
    )
    telemetry = MagicMock()
    monkeypatch.setattr(histogram, "log_performance", telemetry, raising=False)

    result = HistogramDiffTask(
        {
            "model": "compact_negative_integer",
            "column_name": "amount",
            "column_type": "INTEGER",
            "num_bins": 10,
        }
    ).execute()

    assert result["bin_edges"] == [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10]
    assert {index: count for index, count in enumerate(result["base"]["counts"]) if count} == {
        0: 2,
        1: 2,
        5: 1,
        9: 2,
    }
    assert telemetry.call_args.args[1]["strategy"] == "duckdb_scaled_integer"


def test_duckdb_compact_sql_leaves_concurrent_out_of_domain_values_out_of_range(dbt_test_helper):
    """Catch compact arithmetic clamping below/above-domain rows into edge bins."""
    create_typed_histogram_model(
        dbt_test_helper,
        "compact_out_of_domain",
        "DECIMAL(18, 6)",
        [None, "-0.000001", "0", "0.199999", "0.2", "0.6", "1", "1.000001"],
    )
    generated = histogram._generate_histogram_sql_for_adapter(
        "compact_out_of_domain",
        "amount",
        Decimal("0"),
        Decimal("1"),
        5,
        Decimal("0.2"),
        adapter_type="duckdb",
        column_type="DECIMAL(18, 6)",
    )

    compiled = dbt_test_helper.adapter.generate_sql(generated.sql, base=True)
    with dbt_test_helper.adapter.connection_named("execute compact out-of-domain histogram"):
        _, table = dbt_test_helper.adapter.execute(compiled, fetch=True, auto_begin=True)
    counts_by_bin = {row[0]: row[1] for row in table.rows}

    assert generated.strategy == "duckdb_scaled_integer"
    assert counts_by_bin == {-1: 1, 0: 2, 1: 1, 3: 1, 4: 1, 5: 1, None: 1}


def test_duckdb_compact_ten_thousand_bin_request_executes_without_sql_growth(dbt_test_helper, monkeypatch):
    """Catch application orchestration accepting 10,000 bins but emitting a 10,000-branch query."""
    create_typed_histogram_model(
        dbt_test_helper,
        "compact_ten_thousand_bins",
        "INTEGER",
        ["0", "1", "9999", "10000"],
    )
    telemetry = MagicMock()
    monkeypatch.setattr(histogram, "log_performance", telemetry, raising=False)

    task = HistogramDiffTask(
        {
            "model": "compact_ten_thousand_bins",
            "column_name": "amount",
            "column_type": "INTEGER",
            "num_bins": 10000,
        }
    )
    result = task.execute()

    assert task.params.num_bins == 10000
    assert len(result["bin_edges"]) == 10001
    assert len(result["base"]["counts"]) == 10000
    assert {index: count for index, count in enumerate(result["base"]["counts"]) if count} == {
        0: 1,
        1: 1,
        9999: 2,
    }
    metrics = telemetry.call_args.args[1]
    assert metrics["effective_bin_count"] == 10000
    assert metrics["strategy"] == "duckdb_scaled_integer"
    assert metrics["sql_length"] < 5000


def test_histogram_sql_telemetry_failure_does_not_change_results(monkeypatch):
    """Catch optional telemetry turning a successful warehouse result into a failed run."""
    telemetry = MagicMock(side_effect=RuntimeError("telemetry unavailable"))
    monkeypatch.setattr(histogram, "log_performance", telemetry, raising=False)
    task = NumericHistogramQueryTask([(0, 2)], [(0, 3)])

    base, current, bin_edges, labels = histogram.query_numeric_histogram(
        task,
        "numbers",
        "amount",
        "INTEGER",
        Decimal("0"),
        Decimal("1"),
        1,
        adapter_type="duckdb",
    )

    assert base == {"counts": [2]}
    assert current == {"counts": [3]}
    assert bin_edges == [0, 1]
    assert labels
    telemetry.assert_called_once()


def test_literal_fallback_reports_its_actual_sql_length(monkeypatch):
    """Catch fallback telemetry claiming a compact strategy or synthetic query size."""
    telemetry = MagicMock()
    monkeypatch.setattr(histogram, "log_performance", telemetry)
    task = NumericHistogramQueryTask([(0, 2)], [(0, 3)])

    histogram.query_numeric_histogram(
        task,
        "numbers",
        "amount",
        "DOUBLE",
        Decimal("0"),
        Decimal("1"),
        5,
        adapter_type="duckdb",
    )

    metrics = telemetry.call_args.args[1]
    assert metrics["adapter_type"] == "duckdb"
    assert metrics["strategy"] == "literal_ordered_comparison"
    assert metrics["effective_bin_count"] == 5
    assert metrics["sql_length"] == len(task.executed_sql[0])
    assert task.executed_sql[0] == task.executed_sql[1]


def test_compact_out_of_domain_bucket_still_reaches_the_existing_python_guard(monkeypatch):
    """Catch telemetry or compact dispatch swallowing the established range error."""
    monkeypatch.setattr(histogram, "log_performance", MagicMock(), raising=False)
    task = NumericHistogramQueryTask([(-1, 1)], [(0, 1)])

    with pytest.raises(ValueError, match="outside the computed edge domain"):
        histogram.query_numeric_histogram(
            task,
            "numbers",
            "amount",
            "INTEGER",
            Decimal("0"),
            Decimal("1"),
            1,
            adapter_type="duckdb",
        )


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
            "num_bins": 1_000_000,
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
