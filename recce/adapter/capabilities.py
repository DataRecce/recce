"""Adapter capability detection for the paired-distribution feature (DRC-3390).

Decides which approximate-aggregate strategy is available for a given dbt
adapter. The data-pull strategy locked in DRC-3389 uses:

- ``APPROX_COUNT_DISTINCT`` / HLL — cardinality probe across all columns
- ``APPROX_PERCENTILE`` — quantile-binned histograms (continuous columns)
- ``APPROX_TOP_K``    — categorical top-K (discrete columns)

**Stage B scope (DuckDB-only):** the capability table here is intentionally
limited to DuckDB. Every other adapter falls back to the disabled tier so the
:class:`ProfileDistributionTask` strategy router short-circuits and returns a
``{status: "unsupported"}`` envelope. Stage D will expand the table to cover
Snowflake / BigQuery / Databricks / Spark / Athena / Trino / Presto /
ClickHouse / Redshift.

See DRC-3390 ("Adapter coverage at GA") and DRC-3389 ("Adapter compatibility")
for the full GA matrix and rationale.
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
# Stage B ships exactly one row: DuckDB at the full tier. Stage D will add
# Snowflake / BigQuery / Databricks / Spark / Athena / Trino / Presto /
# ClickHouse at full, Redshift at percentile-only. Everything else (Postgres /
# MySQL / SQLite / SQL Server) stays in the disabled tier — those engines lack
# native approximate-aggregate primitives that match recce's GA quality bar.
_CAPABILITY_TABLE: Dict[str, AdapterCapabilities] = {
    "duckdb": AdapterCapabilities(
        has_approx_count_distinct=True,
        has_approx_percentile=True,
        has_approx_top_k=True,
    ),
}


def detect_capabilities(adapter_type: str | None) -> AdapterCapabilities:
    """Return :class:`AdapterCapabilities` for a dbt adapter type string.

    The input is :py:meth:`dbt_adapter.adapter.type` (e.g. ``'snowflake'``,
    ``'bigquery'``). Unknown or ``None`` adapter types fall back to the
    disabled tier — feature unavailable rather than risk emitting SQL the
    engine can't parse.

    Stage B: only ``'duckdb'`` returns the full tier; everything else falls
    through to the empty :class:`AdapterCapabilities` (disabled tier), which
    the :class:`ProfileDistributionTask` strategy router translates into the
    ``unsupported`` short-circuit response.
    """
    if not adapter_type:
        return AdapterCapabilities()
    return _CAPABILITY_TABLE.get(adapter_type.lower(), AdapterCapabilities())
