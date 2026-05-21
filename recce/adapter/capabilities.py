"""Adapter capability detection for the paired-distribution feature (DRC-3390).

Decides which approximate-aggregate strategy is available for a given dbt
adapter. The data-pull strategy locked in DRC-3389 uses:

- ``APPROX_COUNT_DISTINCT`` / HLL — cardinality probe across all columns
- ``APPROX_PERCENTILE`` — quantile-binned histograms (continuous columns)
- ``APPROX_TOP_K``    — categorical top-K (discrete columns)

Not every adapter ships all three. This module is the single source of truth
for "what can this engine do." The :class:`ProfileDistributionTask` strategy
router (PR 2) reads these flags to pick between ``approx_all``,
``percentile_only`` (histograms render, top-K cells blank), and
``unsupported`` (feature disabled, one-time banner).

See DRC-3390 ("Adapter coverage at GA") and DRC-3389 ("Adapter compatibility")
for the full matrix and rationale.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class AdapterCapabilities:
    """Per-adapter approximate-aggregate support.

    All three fields default to ``False`` so unknown adapters fall back to the
    disabled tier — the safe choice. Add adapters to :data:`_CAPABILITY_TABLE`
    below to opt them into a higher tier.
    """

    # ``APPROX_COUNT_DISTINCT`` (HLL) for the cardinality probe phase.
    has_approx_count_distinct: bool = False
    # ``APPROX_PERCENTILE`` / equivalent quantile sketch for continuous columns.
    has_approx_percentile: bool = False
    # ``APPROX_TOP_K`` / equivalent space-saving sketch for categorical columns.
    has_approx_top_k: bool = False


# Capability matrix keyed by ``dbt_adapter.adapter.type()`` (lowercase).
#
# The dbt-side string varies across adapters; values observed in the recce
# codebase include 'snowflake', 'bigquery', 'duckdb', 'postgres', 'redshift',
# 'athena', 'sqlserver'. Databricks and Spark expose 'databricks' and 'spark'
# respectively; Trino and Presto each have their own.
#
# Caveats baked into the GA matrix that this table cannot enforce by adapter
# type alone — runtime version detection is out of scope for PR 1:
#   * 'sqlserver' covers Azure SQL + SQL Server. Versions 2022+ added
#     ``APPROX_PERCENTILE_CONT/_DISC``; pre-2022 has neither. Defaulting to
#     False here (disabled tier). Refine via runtime version detection if
#     SQL Server becomes a target adapter.
#   * 'databricks' / 'spark' added ``approx_top_k`` in 3.5. Older Databricks
#     would land in percentile-only tier in practice. Defaulting to full here
#     since the typical customer is on a recent runtime.
_CAPABILITY_TABLE: Dict[str, AdapterCapabilities] = {
    # Full tier — both percentile and top-K available natively.
    "snowflake": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    ),
    "bigquery": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    ),
    "duckdb": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    ),
    "databricks": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    ),
    "spark": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    ),
    "athena": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    ),
    "trino": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    ),
    "presto": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    ),
    "clickhouse": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    ),
    # Percentile-only tier — histograms render; top-K cells blank.
    "redshift": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=False,
    ),
    # Disabled tier — feature unavailable; UI shows one-time banner.
    # Postgres: no built-in approx; ``tdigest`` extension unreliable on
    # managed Postgres (RDS, Cloud SQL).
    "postgres": AdapterCapabilities(),
    "mysql": AdapterCapabilities(),
    "sqlite": AdapterCapabilities(),
    # See caveat above re: SQL Server 2022+ vs pre-2022.
    "sqlserver": AdapterCapabilities(),
}


def detect_capabilities(adapter_type: str | None) -> AdapterCapabilities:
    """Return :class:`AdapterCapabilities` for a dbt adapter type string.

    The input is :py:meth:`dbt_adapter.adapter.type` (e.g. ``'snowflake'``,
    ``'bigquery'``). Unknown or ``None`` adapter types fall back to the
    disabled tier — feature unavailable rather than risk emitting SQL the
    engine can't parse.
    """
    if not adapter_type:
        return AdapterCapabilities()
    return _CAPABILITY_TABLE.get(adapter_type.lower(), AdapterCapabilities())
