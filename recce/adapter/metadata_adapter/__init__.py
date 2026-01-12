"""
Metadata Adapter for Recce - Macro-Free Environment Comparison

This adapter reads model metadata from the `recce_metadata` schema in the warehouse,
enabling environment comparison without requiring manifest.json or macro compilation.

Key features:
- Reads pre-resolved database.schema.name coordinates
- Change detection via checksums (O(1) per model)
- Direct SQL generation without Jinja compilation
- Framework agnostic (works with dbt Core, dbt Cloud, dbt Fusion)
"""

from recce.adapter.metadata_adapter.adapter import RecceMetadataAdapter
from recce.adapter.metadata_adapter.models import InvocationInfo, ModelInfo

__all__ = ["RecceMetadataAdapter", "ModelInfo", "InvocationInfo"]
