"""Tests for :mod:`recce.adapter.capabilities` (DRC-3390 PR 1)."""

import pytest

from recce.adapter.capabilities import AdapterCapabilities, detect_capabilities

# Adapter tier matrix, asserted directly so the test fails loudly if the
# table in ``capabilities.py`` is reshaped without intent. The tiers mirror
# the matrix in the DRC-3390 issue description.
FULL_TIER = [
    "snowflake",
    "bigquery",
    "duckdb",
    "databricks",
    "spark",
    "athena",
    "trino",
    "presto",
    "clickhouse",
]
PERCENTILE_ONLY_TIER = ["redshift"]
DISABLED_TIER = ["postgres", "mysql", "sqlite", "sqlserver"]


@pytest.mark.parametrize("adapter_type", FULL_TIER)
def test_full_tier_has_both_aggregates(adapter_type):
    caps = detect_capabilities(adapter_type)
    assert caps.has_approx_percentile is True, adapter_type
    assert caps.has_approx_top_k is True, adapter_type
    assert caps.has_approx_count_distinct is True, adapter_type


@pytest.mark.parametrize("adapter_type", PERCENTILE_ONLY_TIER)
def test_percentile_only_tier(adapter_type):
    caps = detect_capabilities(adapter_type)
    assert caps.has_approx_percentile is True, adapter_type
    assert caps.has_approx_top_k is False, adapter_type
    # Probe phase still needs HLL; percentile-only adapters all happen to
    # have it natively.
    assert caps.has_approx_count_distinct is True, adapter_type


@pytest.mark.parametrize("adapter_type", DISABLED_TIER)
def test_disabled_tier_has_nothing(adapter_type):
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
    upper = detect_capabilities("SNOWFLAKE")
    lower = detect_capabilities("snowflake")
    assert upper == lower


def test_capabilities_frozen():
    """Capabilities are dataclass(frozen=True) — defensive against mutation."""
    caps = detect_capabilities("snowflake")
    with pytest.raises((AttributeError, Exception)):
        caps.has_approx_percentile = False  # type: ignore[misc]
