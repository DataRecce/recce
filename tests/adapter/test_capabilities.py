"""Tests for :mod:`recce.adapter.capabilities` (DRC-3390 Stage B).

Stage B ships a DuckDB-only capability table. Every other adapter falls into
the disabled tier so the strategy router short-circuits with an unsupported
envelope. Stage D will restore Snowflake / BigQuery / Databricks / Spark /
Athena / Trino / Presto / ClickHouse at the full tier and Redshift at
percentile-only — the per-tier tests come with that PR.
"""

import pytest

from recce.adapter.capabilities import AdapterCapabilities, detect_capabilities

# Stage B: DuckDB is the only entry in the capability table.
FULL_TIER = ["duckdb"]

# Every other adapter name the rest of the codebase touches (and a couple of
# Stage D candidates) lands in the disabled tier in Stage B.
DISABLED_TIER = [
    "snowflake",
    "bigquery",
    "databricks",
    "spark",
    "athena",
    "trino",
    "presto",
    "clickhouse",
    "redshift",
    "postgres",
    "mysql",
    "sqlite",
    "sqlserver",
]


@pytest.mark.parametrize("adapter_type", FULL_TIER)
def test_full_tier_has_both_aggregates(adapter_type):
    caps = detect_capabilities(adapter_type)
    assert caps.has_approx_percentile is True, adapter_type
    assert caps.has_approx_top_k is True, adapter_type
    assert caps.has_approx_count_distinct is True, adapter_type


@pytest.mark.parametrize("adapter_type", DISABLED_TIER)
def test_everything_else_is_disabled_in_stage_b(adapter_type):
    """Stage B trims the GA matrix to DuckDB only.

    Stage D will re-enable the polyglot tiers; until then every non-DuckDB
    adapter must return the disabled-tier capability object so the
    :func:`pick_strategy` router returns ``"unsupported"`` for it.
    """
    caps = detect_capabilities(adapter_type)
    assert caps.has_approx_percentile is False, adapter_type
    assert caps.has_approx_top_k is False, adapter_type
    assert caps.has_approx_count_distinct is False, adapter_type


def test_unknown_adapter_falls_back_to_disabled():
    """Unknown adapter types must not opt into any feature path."""
    caps = detect_capabilities("some-future-engine")
    assert caps == AdapterCapabilities()
    assert caps.has_approx_percentile is False
    assert caps.has_approx_top_k is False


def test_none_adapter_falls_back_to_disabled():
    assert detect_capabilities(None) == AdapterCapabilities()


def test_empty_string_adapter_falls_back_to_disabled():
    assert detect_capabilities("") == AdapterCapabilities()


def test_adapter_type_is_case_insensitive():
    """``adapter.type()`` upstream sometimes returns title-cased values."""
    upper = detect_capabilities("DUCKDB")
    lower = detect_capabilities("duckdb")
    assert upper == lower


def test_capabilities_frozen():
    """Capabilities are dataclass(frozen=True) — defensive against mutation."""
    caps = detect_capabilities("duckdb")
    with pytest.raises((AttributeError, Exception)):
        caps.has_approx_percentile = False  # type: ignore[misc]
