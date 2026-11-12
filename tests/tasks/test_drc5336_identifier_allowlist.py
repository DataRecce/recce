"""DRC-5336 (REC-02): identifier allowlisting and error redaction for non-QUERY diff tasks.

Reproduction tests. Each one encodes an acceptance criterion and fails today for
the reason stated in its docstring. Rejection tests use a recording fake adapter and
assert the hostile identifier never reaches ``generate_sql`` / ``execute``.
"""

import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from recce.apis.run_security import public_run, public_run_error
from recce.exceptions import RecceException
from recce.models.types import Run, RunStatus, RunType

KNOWN_COLUMNS = ("id", "amount")
HOSTILE_COLUMNS = [
    pytest.param("not_a_column", id="unknown-column"),
    pytest.param('id") from x; drop table y; --', id="double-quote"),
    pytest.param("id') from x; drop table y; --", id="single-quote"),
    pytest.param("id`) from x; --", id="backtick"),
]
REJECTION_ERRORS = (RecceException, ValueError)
TASK_MODULES = ("top_k", "histogram", "valuediff", "query", "rowcount")


class FakeTable(list):
    """Minimal agate-table stand-in: iterable rows, `.rows`, and 3 numeric columns."""

    @property
    def rows(self):
        return self


def _flatten(value):
    if isinstance(value, dict):
        for v in value.values():
            yield from _flatten(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from _flatten(v)
    else:
        yield str(value)


def make_adapter():
    adapter = MagicMock(name="dbt_adapter")
    adapter.seen = []  # every string handed to generate_sql / execute, unescaped
    adapter.get_columns.return_value = [SimpleNamespace(column=c, name=c) for c in KNOWN_COLUMNS]
    adapter.create_relation.return_value = "rel"
    adapter.find_node_by_name.return_value = SimpleNamespace(resource_type="model")
    adapter.adapter.type.return_value = "duckdb"

    def fake_generate_sql(*args, **kwargs):
        adapter.seen.extend(_flatten([args, kwargs.get("context")]))
        return "SQL " + " ".join(_flatten([args, kwargs.get("context")]))

    def fake_execute(sql, *args, **kwargs):
        adapter.seen.append(str(sql))
        return None, FakeTable([(0, 0, 0)])

    adapter.generate_sql.side_effect = fake_generate_sql
    adapter.execute.side_effect = fake_execute
    return adapter


@pytest.fixture
def adapter(monkeypatch):
    fake = make_adapter()
    ctx = SimpleNamespace(adapter=fake, adapter_type="dbt")
    for name in TASK_MODULES:
        monkeypatch.setattr(f"recce.tasks.{name}.default_context", lambda ctx=ctx: ctx)
    return fake


def assert_rejected(task, adapter, hostile):
    """The task must raise a validation error and never send `hostile` to the warehouse."""
    raised = None
    try:
        task.execute()
    except Exception as e:  # noqa: BLE001
        raised = e
    leaked = any(hostile in s for s in adapter.seen)
    assert not leaked, f"hostile identifier reached SQL generation: {hostile!r}"
    assert isinstance(raised, REJECTION_ERRORS), f"expected a Recce validation error, got {raised!r}"
    assert adapter.execute.call_count == 0


# ---------------------------------------------------------------- TopK


@pytest.mark.parametrize("column", HOSTILE_COLUMNS)
def test_top_k_rejects_hostile_column(adapter, column):
    """Fails: TopKDiffTask.execute (top_k.py:112) passes column_name straight into the template context."""
    from recce.tasks.top_k import TopKDiffTask

    assert_rejected(TopKDiffTask({"model": "m", "column_name": column, "k": 5}), adapter, column)


def test_top_k_rejects_unknown_model(adapter):
    """Baseline: create_relation None already raises ValueError (top_k.py:117). Must keep passing."""
    from recce.tasks.top_k import TopKDiffTask

    adapter.create_relation.return_value = None
    with pytest.raises(REJECTION_ERRORS):
        TopKDiffTask({"model": "ghost", "column_name": "id"}).execute()


@pytest.mark.parametrize("k", [0, -1, 1001, 10**9])
def test_top_k_rejects_out_of_range_k(k):
    """Fails: TopKDiffParams.k is an unbounded Optional[int] (top_k.py:14)."""
    from recce.tasks.top_k import TopKDiffParams

    with pytest.raises(ValidationError):
        TopKDiffParams(model="m", column_name="id", k=k)


# ---------------------------------------------------------------- Histogram


@pytest.mark.parametrize("column", HOSTILE_COLUMNS)
def test_histogram_rejects_hostile_column(adapter, column):
    """Fails: HistogramDiffTask.execute (histogram.py:673-683) f-strings the column into MIN()/MAX()."""
    from recce.tasks.histogram import HistogramDiffTask

    task = HistogramDiffTask({"model": "m", "column_name": column, "column_type": "INTEGER", "num_bins": 10})
    assert_rejected(task, adapter, column)


@pytest.mark.parametrize("model", ['m") }} ; drop table y; --', "ghost"])
def test_histogram_rejects_unknown_or_hostile_model(adapter, model):
    """Fails: the model name goes into `ref("{node}")` (histogram.py:678) with no manifest check."""
    from recce.tasks.histogram import HistogramDiffTask

    adapter.find_node_by_name.return_value = None
    adapter.create_relation.return_value = None
    adapter.get_columns.side_effect = RecceException("Model does not exist")
    task = HistogramDiffTask({"model": model, "column_name": "id", "column_type": "INTEGER"})
    assert_rejected(task, adapter, model)


@pytest.mark.parametrize("num_bins", [0, -5, 501, 10**7])
def test_histogram_rejects_out_of_range_num_bins(num_bins):
    """Fails: HistogramDiffParams.num_bins is unbounded (histogram.py:378); 10**7 emits 10**7 CASE arms."""
    from recce.tasks.histogram import HistogramDiffParams

    with pytest.raises(ValidationError):
        HistogramDiffParams(model="m", column_name="id", column_type="INTEGER", num_bins=num_bins)


def _seed_events(dbt_test_helper, column_type, values):
    adapter = dbt_test_helper.adapter
    with adapter.connection_named("seed"):
        for schema in (dbt_test_helper.base_schema, dbt_test_helper.curr_schema):
            adapter.execute(f"CREATE TABLE {schema}.events (created_at {column_type})")
            adapter.execute(f"INSERT INTO {schema}.events VALUES " + ", ".join(f"({v})" for v in values))
    dbt_test_helper.create_model(
        "events",
        base_sql="select created_at from source_values",
        curr_sql="select created_at from source_values",
        base_columns={"created_at": column_type},
        curr_columns={"created_at": column_type},
    )


def test_histogram_date_column_succeeds_under_safe_template(dbt_test_helper):
    """Fails (v1.71.0 regression): query_datetime_histogram emits `{{ date_trunc(...) }}`
    (histogram.py:560-602); QueryMixin.execute_sql renders with safe_template=True, which
    only allows ref/source/var, so both env queries raise, are swallowed by the print(e)
    handlers, and the task returns all-zero counts although the tables hold 3 rows.
    """
    from recce.tasks.histogram import HistogramDiffTask

    _seed_events(dbt_test_helper, "DATE", ["DATE '2026-01-01'", "DATE '2026-01-02'", "DATE '2026-01-02'"])
    result = HistogramDiffTask(
        {"model": "events", "column_name": "created_at", "column_type": "DATE", "num_bins": 10}
    ).execute()

    assert sum(result["base"]["counts"]) == 3
    assert sum(result["current"]["counts"]) == 3


def test_histogram_timestamp_column_short_range_does_not_crash(dbt_test_helper):
    """Fails for a SECOND, independent reason found while reproducing: for TIMESTAMP columns the
    warehouse returns datetime min/max, and the daily branch compares `max_value < date.max`
    (histogram.py:590), raising `TypeError: can't compare datetime.datetime to datetime.date`
    before any SQL is generated. Not in the issue text; fixing date_trunc alone leaves it broken.
    """
    from recce.tasks.histogram import HistogramDiffTask

    _seed_events(
        dbt_test_helper,
        "TIMESTAMP",
        ["TIMESTAMP '2026-01-01 00:00:00'", "TIMESTAMP '2026-01-02 12:00:00'", "TIMESTAMP '2026-01-02 13:00:00'"],
    )
    result = HistogramDiffTask(
        {"model": "events", "column_name": "created_at", "column_type": "TIMESTAMP", "num_bins": 10}
    ).execute()

    assert sum(result["base"]["counts"]) == 3


# ---------------------------------------------------------------- ValueDiff


@pytest.mark.parametrize("primary_key", [c.values[0] for c in HOSTILE_COLUMNS])
def test_value_diff_rejects_hostile_primary_key(adapter, primary_key):
    """Fails: _normalise_identifier (valuediff.py:52-54) returns unknown identifiers verbatim."""
    from recce.tasks.valuediff import ValueDiffTask

    assert_rejected(ValueDiffTask({"model": "m", "primary_key": primary_key}), adapter, primary_key)


@pytest.mark.parametrize("column", [c.values[0] for c in HOSTILE_COLUMNS])
def test_value_diff_rejects_hostile_composite_primary_key_and_columns(adapter, column):
    """Fails: same fallthrough for composite keys and `columns`; `column_to_compare` is later
    interpolated inside single quotes (valuediff.py:247)."""
    from recce.tasks.valuediff import ValueDiffTask

    task = ValueDiffTask({"model": "m", "primary_key": ["id"], "columns": ["amount", column]})
    assert_rejected(task, adapter, column)


@pytest.mark.parametrize("column", [c.values[0] for c in HOSTILE_COLUMNS])
def test_value_diff_detail_rejects_hostile_column(adapter, column):
    """Fails: ValueDiffDetailTask normalises with the same verbatim fallback (valuediff.py:374-376)."""
    from recce.tasks.valuediff import ValueDiffDetailTask

    assert_rejected(ValueDiffDetailTask({"model": "m", "primary_key": column}), adapter, column)


def test_value_diff_does_not_use_unsafe_template_rendering():
    """Fails: _verify_primary_key renders `adapter.dispatch('test_unique')` with safe_template
    defaulting to False (valuediff.py:~137), and echoes the compiled SQL in the error."""
    import inspect

    from recce.tasks import valuediff

    src = inspect.getsource(valuediff)
    assert "safe_template=False" not in src
    assert "Please check by this sql" not in src, "compiled SQL must not be echoed to the user"


# ---------------------------------------------------------------- QueryDiff / RowCountDiff


@pytest.mark.parametrize("pk", [c.values[0] for c in HOSTILE_COLUMNS])
def test_query_diff_rejects_hostile_primary_key(adapter, pk):
    """Fails: primary_keys are joined unquoted into ORDER BY (query.py:298, 431)."""
    from recce.tasks.query import QueryDiffTask

    task = QueryDiffTask({"sql_template": "select 1 as id", "primary_keys": [pk]})
    assert_rejected(task, adapter, pk)


def test_query_diff_current_model_goes_through_allowlist(adapter):
    """Fails: current_model is interpolated into `ref("{model_name}")` (query.py:339) unescaped."""
    from recce.tasks.query import QueryDiffTask

    hostile = 'm") }} {{ run_query("drop table y") }} {{ ref("m'
    adapter.find_node_by_name.return_value = None
    adapter.create_relation.return_value = None
    adapter.get_columns.side_effect = RecceException("Model does not exist")
    task = QueryDiffTask({"sql_template": "select 1", "current_model": hostile, "primary_keys": ["id"]})
    assert_rejected(task, adapter, hostile)


def test_row_count_diff_sqlmesh_rejects_hostile_node_name():
    """Fails: execute_sqlmesh interpolates node_names into `select count(*) from {name}` (rowcount.py:357-365)."""
    from recce.tasks.rowcount import RowCountDiffTask

    hostile = "orders; drop table y"
    sqlmesh = MagicMock()
    sqlmesh.fetchdf_with_limit.side_effect = RuntimeError("boom")
    with patch("recce.tasks.rowcount.default_context", return_value=SimpleNamespace(adapter=sqlmesh)):
        try:
            RowCountDiffTask({"node_names": [hostile]}).execute_sqlmesh()
        except Exception:  # noqa: BLE001
            pass
    assert not any(hostile in str(c) for c in sqlmesh.fetchdf_with_limit.call_args_list)


# ---------------------------------------------------------------- Error redaction

NON_QUERY_TYPES = [
    RunType.TOP_K_DIFF,
    RunType.HISTOGRAM_DIFF,
    RunType.VALUE_DIFF,
    RunType.VALUE_DIFF_DETAIL,
    RunType.PROFILE_DIFF,
    RunType.ROW_COUNT_DIFF,
]
DRIVER_ERROR = 'Database Error: relation "analytics.secret_table" does not exist; host=10.0.0.5 password=hunter2'


@pytest.mark.parametrize("run_type", NON_QUERY_TYPES, ids=lambda t: t.value)
def test_public_run_error_redacts_driver_errors_for_all_run_types(run_type):
    """Fails: public_run_error only redacts QUERY_RUN_TYPES (run_security.py:5-12)."""
    run = Run(type=run_type, params={}, status=RunStatus.FAILED, error=DRIVER_ERROR)
    assert public_run_error(run) != DRIVER_ERROR
    assert "hunter2" not in public_run(run).error


@pytest.mark.parametrize("run_type", NON_QUERY_TYPES, ids=lambda t: t.value)
def test_submit_run_does_not_store_raw_driver_error(run_type):
    """Fails: update_run_result stores str(error) for non-QUERY types (run_func.py:233-236),
    so the raw driver error is persisted into state and exported."""
    from recce.apis.run_func import submit_run

    class FailingTask:
        def __init__(self, params):
            self.params = params
            self.is_cancelled = False
            self.progress_listener = None

        def execute(self):
            raise RuntimeError(DRIVER_ERROR)

    context = MagicMock(adapter_type="dbt", review_mode=False, runs=[])

    async def go():
        with (
            patch("recce.apis.run_func.default_context", return_value=context),
            patch("recce.core.default_context", return_value=context),
            patch("recce.apis.run_func.create_task", return_value=FailingTask({})),
        ):
            run, future = submit_run(type=run_type.value, params={})
            await asyncio.wrap_future(future)
            return run

    run = asyncio.run(go())
    assert run.status == RunStatus.FAILED
    assert "hunter2" not in (run.error or "")


def test_recce_validation_errors_stay_visible():
    """Guard for Decision 2: structured Recce validation messages must survive redaction.
    Passes today; must keep passing after the fix."""
    from recce.apis.run_func import submit_run

    class RejectingTask:
        def __init__(self, params):
            self.params = params
            self.is_cancelled = False
            self.progress_listener = None

        def execute(self):
            raise RecceException("Column 'foo' does not exist in model 'orders'")

    context = MagicMock(adapter_type="dbt", review_mode=False, runs=[])

    async def go():
        with (
            patch("recce.apis.run_func.default_context", return_value=context),
            patch("recce.core.default_context", return_value=context),
            patch("recce.apis.run_func.create_task", return_value=RejectingTask({})),
        ):
            run, future = submit_run(type="top_k_diff", params={})
            await asyncio.wrap_future(future)
            return run

    run = asyncio.run(go())
    assert "Column 'foo' does not exist" in run.error
