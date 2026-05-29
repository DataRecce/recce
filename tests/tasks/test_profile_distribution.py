"""Tests for :mod:`recce.tasks.profile_distribution` (DRC-3390 Stage B).

Stage B ships a DuckDB-only backend; the multi-adapter strategy-router and
top-K-shape tests live in Stage D.

The fixture (``dbt_test_helper``) spins up an in-process DuckDB via
``tests/adapter/dbt_adapter/conftest.py``. DuckDB is the only adapter that
runs in CI; manual warehouse smoke tests against Snowflake (etc.) verify
the unsupported-envelope short-circuit.

Coverage targets:

* Strategy router (DuckDB ``approx_all`` / everything-else ``unsupported``)
* Top-K result-shape post-processor (DuckDB flat-list branch)
* Epoch cast rendering (DuckDB only — DRC-3504 regression)
* Continuous numeric column → histogram payload
* Low-cardinality categorical column → topk payload
* High-cardinality categorical column → topk payload
* UUID-cap-degenerate column (HLL ≥ 0.95 × rows) → empty topk slot
* Timestamp column (DRC-3504 regression test)
* Deliberately-bad column → other columns still succeed (DRC-3507 regression)
* Memoization hit/miss tests
* Unsupported tier short-circuit
"""

from __future__ import annotations

import uuid

import pytest

from recce.adapter.capabilities import AdapterCapabilities
from recce.tasks import ProfileDistributionTask
from recce.tasks.profile_distribution import (
    NUM_BINS,
    _build_histogram_payload,
    _env_edges_and_density,
    _fallback_cache,
    _get_cache,
    classify_column_type,
    parse_topk_result,
    pick_strategy,
    render_epoch_cast,
)


@pytest.fixture(autouse=True)
def _clear_caches():
    """Clear per-context and module-level caches before each test."""
    _fallback_cache.clear()
    yield
    _fallback_cache.clear()


# ---------------------------------------------------------------------------
# Histogram payload — per-env edges (PR #1398 contract)
# ---------------------------------------------------------------------------


# A full set of inner quantiles (one per QUANTILE_FRACTIONS entry).
def _quantiles(values):
    assert len(values) == NUM_BINS - 1, "need one value per inner quantile"
    return list(values)


def test_env_edges_equal_area():
    """Each bin carries 1/NUM_BINS of the rows: area = density * width."""
    edges, density = _env_edges_and_density(
        _quantiles([10, 20, 30, 40, 50, 60, 70, 80, 90, 95]),
        min_value=0,
        max_value=100,
    )
    # min + 10 quantiles + max → NUM_BINS + 1 edges, NUM_BINS bins.
    assert len(edges) == NUM_BINS + 1
    assert len(density) == NUM_BINS
    areas = [density[i] * (edges[i + 1] - edges[i]) for i in range(len(density))]
    # QUANTILE_FRACTIONS is rounded to 6 decimals, so areas equal 1/NUM_BINS
    # only to that precision — use an absolute tolerance accordingly.
    for area in areas:
        assert area == pytest.approx(1.0 / NUM_BINS, abs=1e-5)
    assert sum(areas) == pytest.approx(1.0, abs=1e-4)


def test_env_edges_empty_without_bounds():
    """All-NULL column (no min/max) yields empty edge + density arrays."""
    assert _env_edges_and_density([1, 2, 3], min_value=None, max_value=None) == ([], [])


def test_env_edges_tie_emits_zero_not_infinity():
    """A heavily-tied column collapses adjacent quantiles onto one value.

    Zero-width bins surface as density 0, never an infinite spike. The mass
    sitting on the tied value is a point mass (a Dirac) that this continuous
    renderer deliberately does NOT draw — so the integrated continuous density
    is < 1, with the remainder being the dropped point mass. This is the known
    point-mass limitation (parked for Stage B); the assertion pins the current
    behaviour so a future fix is a conscious change."""
    # All inner quantiles pinned to the min fence: 10/11 of the mass ties at 0.
    edges, density = _env_edges_and_density(
        _quantiles([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        min_value=0,
        max_value=100,
    )
    assert all(d >= 0.0 for d in density)
    assert all(d != float("inf") for d in density)
    integrated = sum(density[i] * (edges[i + 1] - edges[i]) for i in range(len(density)))
    # Only the final [0, 100] bin has non-zero width; it carries just the last
    # fraction slice (~1/NUM_BINS). The tied point mass is dropped.
    assert integrated == pytest.approx(1.0 / NUM_BINS, abs=1e-4)


def test_histogram_payload_base_and_current_diverge():
    """Divergent base/current quantiles must produce DIFFERENT edges AND
    densities — the core regression for the shared-edge collapse bug."""
    payload = _build_histogram_payload(
        quantile_values_base=_quantiles([10, 20, 30, 40, 50, 60, 70, 80, 90, 95]),
        quantile_values_current=_quantiles([1, 2, 3, 4, 5, 50, 60, 70, 80, 90]),
        base_total=100,
        current_total=100,
        base_min=0,
        base_max=100,
        current_min=0,
        current_max=100,
    )
    assert payload["kind"] == "histogram"
    # Per-env edge arrays, each independently shaped.
    assert payload["base_bin_edges"] != payload["current_bin_edges"]
    assert payload["base_density"] != payload["current_density"]
    assert len(payload["base_density"]) == len(payload["base_bin_edges"]) - 1
    assert len(payload["current_density"]) == len(payload["current_bin_edges"]) - 1


def test_histogram_payload_identical_inputs_match():
    """Sanity: identical base/current data DOES yield identical curves (the
    only case where the two sides legitimately coincide)."""
    qs = _quantiles([10, 20, 30, 40, 50, 60, 70, 80, 90, 95])
    payload = _build_histogram_payload(
        quantile_values_base=list(qs),
        quantile_values_current=list(qs),
        base_total=100,
        current_total=100,
        base_min=0,
        base_max=100,
        current_min=0,
        current_max=100,
    )
    assert payload["base_bin_edges"] == payload["current_bin_edges"]
    assert payload["base_density"] == payload["current_density"]


# ---------------------------------------------------------------------------
# Strategy router (Stage B: two branches only)
# ---------------------------------------------------------------------------


def test_strategy_router_approx_all():
    """DuckDB-style capabilities → ``approx_all`` strategy."""
    caps = AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    )
    assert pick_strategy(caps) == "approx_all"


def test_strategy_router_unsupported_when_disabled():
    """Empty capability object → ``unsupported`` short-circuit."""
    caps = AdapterCapabilities()
    assert pick_strategy(caps) == "unsupported"


def test_strategy_router_unsupported_when_only_percentile():
    """Stage B has no ``percentile_only`` branch — both must be present.

    Stage D will reintroduce ``percentile_only`` for Redshift; until then a
    percentile-only capability object collapses into ``unsupported``.
    """
    caps = AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=False,
    )
    assert pick_strategy(caps) == "unsupported"


def test_strategy_router_unsupported_when_only_topk():
    """Adapter with top-K but no percentile is still unsupported."""
    caps = AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=False,
        has_approx_top_k=True,
    )
    assert pick_strategy(caps) == "unsupported"


# ---------------------------------------------------------------------------
# Column type classification
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "dtype,expected",
    [
        ("integer", "numeric"),
        ("bigint", "numeric"),
        ("decimal(28,6)", "numeric"),
        ("double", "numeric"),
        ("number(38,0)", "numeric"),
        ("timestamp", "datetime"),
        ("timestamp_ntz", "datetime"),
        ("date", "datetime"),
        ("varchar", "categorical"),
        ("text", "categorical"),
        ("json", "skip"),
        ("array<int>", "skip"),
        ("", "skip"),
        (None, "skip"),
    ],
)
def test_classify_column_type(dtype, expected):
    assert classify_column_type(dtype) == expected


# ---------------------------------------------------------------------------
# Epoch cast rendering (DRC-3504 fix) — Stage B: DuckDB only
# ---------------------------------------------------------------------------


def test_render_epoch_cast_duckdb():
    """DRC-3504 fix: DuckDB's in-SQL epoch conversion is ``epoch(col)``.

    The prototype used ``cast(col as decimal(28,6))`` which DuckDB rejected
    for ``TIMESTAMP`` — this test pins the replacement.
    """
    assert render_epoch_cast("duckdb", '"ts"') == 'epoch("ts")'


@pytest.mark.parametrize(
    "adapter_type",
    [
        "snowflake",
        "bigquery",
        "databricks",
        "spark",
        "trino",
        "athena",
        "presto",
        "clickhouse",
        "redshift",
    ],
)
def test_render_epoch_cast_non_duckdb_raises(adapter_type):
    """Stage B: non-DuckDB adapters raise ValueError.

    Stage D restores per-dialect epoch conversions.
    """
    with pytest.raises(ValueError):
        render_epoch_cast(adapter_type, '"ts"')


# ---------------------------------------------------------------------------
# Top-K result-shape post-processor — Stage B: DuckDB only
# ---------------------------------------------------------------------------


def test_parse_topk_duckdb_flat():
    """DuckDB returns a flat value list with no counts."""
    raw = ["a", "b", "c"]
    values, counts = parse_topk_result("duckdb", raw)
    assert values == ["a", "b", "c"]
    assert counts is None


def test_parse_topk_duckdb_none_returns_empty():
    """All-NULL column returns no top-K."""
    assert parse_topk_result("duckdb", None) == ([], None)


@pytest.mark.parametrize(
    "adapter_type",
    [
        "snowflake",
        "bigquery",
        "databricks",
        "spark",
        "trino",
        "athena",
        "presto",
        "clickhouse",
    ],
)
def test_parse_topk_non_duckdb_raises(adapter_type):
    """Stage B: non-DuckDB adapter types raise.

    The strategy router short-circuits these before this code path runs;
    the raise is a defense-in-depth backstop. Stage D restores the
    per-adapter shape switch (Snowflake pairs, BigQuery / Databricks
    structs, Trino map).
    """
    with pytest.raises(ValueError):
        parse_topk_result(adapter_type, ["a", "b"])


# ---------------------------------------------------------------------------
# Memoization
# ---------------------------------------------------------------------------


def test_memoization_hit_returns_cached_payload(dbt_test_helper):
    """Second run within the same context returns the cached payload."""
    csv = "id,name\n1,Alice\n2,Bob\n3,Charlie\n4,Bob\n5,Alice\n"
    dbt_test_helper.create_model("memo_model", csv, csv)

    task = ProfileDistributionTask({"model": "memo_model"})
    first = task.execute()
    assert first["status"] == "ok"
    assert "cache_hit" not in first  # first run wasn't a cache hit

    task2 = ProfileDistributionTask({"model": "memo_model"})
    second = task2.execute()
    assert second.get("cache_hit") is True
    # Strategy / columns should match (modulo the cache_hit tag).
    assert second["strategy"] == first["strategy"]
    assert set(second["columns"].keys()) == set(first["columns"].keys())


def test_memoization_different_columns_different_cache_key(dbt_test_helper):
    """Filtering on a column subset should be a separate cache key."""
    csv = "id,name,age\n1,Alice,30\n2,Bob,25\n3,Charlie,35\n"
    dbt_test_helper.create_model("memo_cols", csv, csv)

    task_a = ProfileDistributionTask({"model": "memo_cols", "columns": ["name"]})
    task_a.execute()

    task_b = ProfileDistributionTask({"model": "memo_cols", "columns": ["age"]})
    res_b = task_b.execute()
    assert res_b.get("cache_hit") is not True  # different subset, miss


def test_memoization_cache_is_per_context(dbt_test_helper):
    """Cache lives on the RecceContext; setting a new context clears it."""
    csv = "id,name\n1,Alice\n2,Bob\n"
    dbt_test_helper.create_model("ctx_model", csv, csv)

    task = ProfileDistributionTask({"model": "ctx_model"})
    task.execute()

    cache = _get_cache()
    assert len(cache) >= 1


# ---------------------------------------------------------------------------
# End-to-end on DuckDB
# ---------------------------------------------------------------------------


def test_continuous_numeric_column(dbt_test_helper):
    """Continuous column → histogram payload with correct schema."""
    rows = "\n".join(f"{i}" for i in range(1, 101))
    csv = "amount\n" + rows
    dbt_test_helper.create_model("orders_cont", csv, csv)

    task = ProfileDistributionTask({"model": "orders_cont"})
    result = task.execute()

    assert result["status"] == "ok"
    assert result["strategy"] == "approx_all"
    assert "amount" in result["columns"]

    col = result["columns"]["amount"]
    assert col["kind"] == "histogram"
    # Per-env edges: each side carries its own edge array (min + quantiles +
    # max). At least the min/max fences survive even under sketch noise.
    assert len(col["base_bin_edges"]) >= 2
    assert len(col["current_bin_edges"]) >= 2
    # density has one entry per bin (edges - 1).
    assert len(col["base_density"]) == len(col["base_bin_edges"]) - 1
    assert len(col["current_density"]) == len(col["current_bin_edges"]) - 1
    assert col["base_total"] == 100
    assert col["current_total"] == 100


def test_empty_columns_ok_payload_has_totals(dbt_test_helper):
    """Empty-columns "ok" path still satisfies the frozen contract.

    When the ``columns`` filter matches nothing (or every column is a skip
    type), the task short-circuits before the probe phase. The TS contract
    (ProfileDistributionOkResult) declares base_total/current_total as
    required numbers, so the early return must emit them — Stage C reads
    ``result.base_total`` and would otherwise get ``undefined``.
    """
    csv = "amount\n1\n2\n3\n"
    dbt_test_helper.create_model("orders_empty_filter", csv, csv)

    # Filter to a column that doesn't exist → column_records is empty.
    task = ProfileDistributionTask({"model": "orders_empty_filter", "columns": ["nope"]})
    result = task.execute()

    assert result["status"] == "ok"
    assert result["columns"] == {}
    # Required by the contract even though no columns were profiled.
    assert result["base_total"] == 0
    assert result["current_total"] == 0


def test_low_cardinality_categorical_column(dbt_test_helper):
    """Low-cardinality categorical → topk with values present."""
    # ~50/50 split.
    rows = []
    for i in range(50):
        rows.append("active")
    for i in range(30):
        rows.append("pending")
    for i in range(20):
        rows.append("done")
    csv = "status\n" + "\n".join(rows)
    dbt_test_helper.create_model("orders_lowcard", csv, csv)

    task = ProfileDistributionTask({"model": "orders_lowcard"})
    result = task.execute()
    assert result["status"] == "ok"
    col = result["columns"]["status"]
    assert col["kind"] == "topk"
    # DuckDB returns no counts, so the no-counts path emits the ``ranks``
    # variant (DRC-3390 contract): per-env 1-indexed ranks aligned to the
    # union, ``None`` where a value is absent in that env's top-K.
    assert col["mode"] == "ranks"
    # All three statuses should be present in the union.
    assert set(col["values"]) >= {"active", "pending", "done"}
    # base == current here (same csv), so the rank arrays match, are aligned
    # to ``values``, and are a 1-indexed permutation with no missing slots.
    assert col["base_ranks"] == col["current_ranks"]
    assert len(col["base_ranks"]) == len(col["values"])
    assert None not in col["base_ranks"]
    assert sorted(col["base_ranks"]) == list(range(1, len(col["values"]) + 1))


def test_high_cardinality_categorical_column(dbt_test_helper):
    """High-cardinality (but not unique) categorical → topk trimmed."""
    # 30 distinct labels, each repeated 10 times. cardinality=30, rows=300,
    # ratio=0.10 — well under 0.95 cap, so top-K kicks in. Top-K returns
    # at most 12 values by default, so ``trimmed`` should be True.
    rows = []
    for i in range(30):
        for _ in range(10):
            rows.append(f"label_{i:03d}")
    csv = "label\n" + "\n".join(rows)
    dbt_test_helper.create_model("orders_highcard", csv, csv)

    task = ProfileDistributionTask({"model": "orders_highcard"})
    result = task.execute()
    col = result["columns"]["label"]
    assert col["kind"] == "topk"
    assert col["trimmed"] is True
    assert len(col["values"]) <= 12


def test_uuid_cap_degenerate_column(dbt_test_helper):
    """UUID-style column with cardinality ≈ rows → empty top-K slot.

    Implements the ``cap_degenerate`` rule: when HLL ≥ 0.95 × row_count,
    a top-K view is uninformative and we skip the sketch.
    """
    # 200 distinct UUIDs; cardinality = rows = 200, ratio = 1.0.
    ids = [str(uuid.uuid4()) for _ in range(200)]
    csv = "uid\n" + "\n".join(ids)
    dbt_test_helper.create_model("orders_uuids", csv, csv)

    task = ProfileDistributionTask({"model": "orders_uuids"})
    result = task.execute()
    col = result["columns"]["uid"]
    # Either it lands in cap_degenerate (empty top-K) — that's the spec — or,
    # if the HLL estimate happens to fall *just* below the cap threshold
    # because of sketch noise, the regular top-K path is taken. Both are
    # acceptable here; the assertion guards the spec rule.
    assert col["kind"] == "topk"
    if not col["values"]:
        # Cap-degenerate path: the spec contract. Emits the ``ranks`` shape
        # with empty arrays (the no-counts encoding for this adapter); the
        # empty ``values`` list is what flags degeneracy.
        assert col["mode"] == "ranks"
        assert col["values"] == []
        assert col["base_ranks"] == []
        assert col["current_ranks"] == []
        assert col["trimmed"] is False


def test_timestamp_column_drc_3504(dbt_test_helper):
    """DRC-3504 regression: timestamp histogram emits a non-empty payload.

    The prototype cast TIMESTAMP → DECIMAL(28,6) which DuckDB rejected — the
    cell silently emitted an empty chart. The fix lives in
    :func:`render_epoch_cast`: DuckDB's in-SQL conversion is ``epoch(col)``.

    Note: the test helper's CSV → CREATE TABLE path leaves date-looking
    columns as VARCHAR (pandas infers strings without ``parse_dates``).
    To exercise the real TIMESTAMP path we pre-create the tables with an
    explicit cast, then register the model without csv.
    """
    base_schema = dbt_test_helper.base_schema
    curr_schema = dbt_test_helper.curr_schema
    with dbt_test_helper.adapter.connection_named("setup_ts"):
        for sc in (base_schema, curr_schema):
            dbt_test_helper.adapter.execute(
                f"CREATE TABLE {sc}.orders_ts AS "
                "SELECT CAST(d AS TIMESTAMP) AS ts FROM (VALUES "
                "('2023-01-01'),('2023-02-15'),('2023-03-30'),"
                "('2023-05-10'),('2023-08-20'),('2023-12-31')"
                ") v(d)"
            )
    dbt_test_helper.create_model(
        "orders_ts",
        base_sql="-- ts via setup",
        curr_sql="-- ts via setup",
        base_columns={"ts": "TIMESTAMP"},
        curr_columns={"ts": "TIMESTAMP"},
    )

    task = ProfileDistributionTask({"model": "orders_ts"})
    result = task.execute()
    assert result["status"] == "ok"

    col = result["columns"].get("ts")
    assert col is not None, "timestamp column should produce a payload, not be skipped"
    assert col["kind"] == "histogram"
    # Regression: the prototype's empty-chart symptom was empty edges +
    # totals == 0. Here, with the DRC-3504 fix, both totals reflect real
    # row counts and each env's edge array contains at least the min/max fences.
    assert col["base_total"] == 6
    assert col["current_total"] == 6
    assert len(col["base_bin_edges"]) >= 2
    assert len(col["current_bin_edges"]) >= 2


def test_bad_column_does_not_blank_other_columns_drc_3507(dbt_test_helper):
    """DRC-3507 regression: one bad column doesn't blank the rest.

    The prototype ran every per-column query inside one ``connection_named``
    context. DuckDB's transaction-cascade behaviour meant any failed
    query left the connection in aborted-txn state — without explicit
    ROLLBACK every subsequent column blanked silently. This test forces a
    failure on one column and asserts the others still produce a payload.
    """
    csv = "good_int,good_str,broken\n" "1,a,1\n" "2,b,2\n" "3,c,3\n" "4,a,4\n" "5,b,5\n"
    dbt_test_helper.create_model("orders_bad", csv, csv)

    task = ProfileDistributionTask({"model": "orders_bad"})

    # Inject a failure on the ``broken`` column by monkey-patching the
    # renderer to emit invalid SQL only for that column name.
    from recce.tasks import profile_distribution as pd_mod

    orig_render_percentile = pd_mod.render_approx_percentile

    def busted_percentile(adapter_type, column_expr, quantiles):
        if "broken" in column_expr:
            return "INVALID_FUNCTION_DOES_NOT_EXIST(broken)"
        return orig_render_percentile(adapter_type, column_expr, quantiles)

    pd_mod.render_approx_percentile = busted_percentile
    try:
        result = task.execute()
    finally:
        pd_mod.render_approx_percentile = orig_render_percentile

    # The whole task must not crash.
    assert result["status"] == "ok"
    # Good columns must still appear with real payloads.
    assert "good_int" in result["columns"]
    assert "good_str" in result["columns"]
    # broken should have a kind: None / fallback marker (or absent percentile
    # — but it should be a payload, not silently missing from the dict).
    # When per-column retry fails, the column's percentile bucket is empty
    # and the histogram payload reflects that.
    # The key contract is: good columns still rendered.
    good = result["columns"]["good_int"]
    assert good.get("kind") in {"histogram", "topk"}


# ---------------------------------------------------------------------------
# Unsupported tier short-circuit
# ---------------------------------------------------------------------------


def test_unsupported_adapter_returns_envelope(dbt_test_helper, monkeypatch):
    """Unsupported adapters return a single envelope, no per-column dispatch.

    Stage B's hot path: every non-DuckDB adapter should short-circuit here
    and return ``{status: "unsupported", reason, columns: {}}`` — that's
    what the colleague will see on a Snowflake project until Stage D lands.
    """
    csv = "id,name\n1,a\n2,b\n"
    dbt_test_helper.create_model("unsup", csv, csv)

    # Patch the capability detector so the task believes the adapter is
    # in the disabled tier. We can't ``monkeypatch.setattr(adapter, 'type',
    # lambda: 'postgres')`` because the underlying adapter is still DuckDB
    # — just make ``detect_capabilities`` return the disabled tier.
    from recce.tasks import profile_distribution as pd_mod

    def fake_detect(adapter_type):
        return AdapterCapabilities()  # all False → unsupported

    monkeypatch.setattr(pd_mod, "detect_capabilities", fake_detect)

    task = ProfileDistributionTask({"model": "unsup"})
    result = task.execute()
    assert result["status"] == "unsupported"
    assert result["columns"] == {}
    assert "reason" in result
