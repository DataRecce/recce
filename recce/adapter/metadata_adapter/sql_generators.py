"""
Macro-Free SQL Generators.

This module generates SQL using resolved coordinates (database.schema.name)
instead of requiring Jinja compilation with dbt macros.

The key insight: we already have fully qualified table names in ModelInfo.full_name,
so we can build executable SQL directly without any macro expansion.
"""

from typing import Dict, List, Optional

from recce.adapter.metadata_adapter.models import ModelInfo


class MacroFreeSqlGenerator:
    """
    Generates SQL using resolved coordinates - no Jinja/macros needed.

    This is the core of the macro-free approach. Instead of:
        SELECT * FROM {{ ref('orders') }}

    We generate:
        SELECT * FROM jaffle_shop.dev.orders

    The ModelInfo.full_name property provides the resolved coordinate.
    """

    def __init__(self, base_models: Dict[str, ModelInfo], curr_models: Dict[str, ModelInfo]):
        """
        Initialize the SQL generator.

        Args:
            base_models: Models from base invocation (keyed by unique_id)
            curr_models: Models from current invocation (keyed by unique_id)
        """
        self.base_models = base_models
        self.curr_models = curr_models

    def _find_model_by_name(self, model_name: str, base: bool = False) -> Optional[ModelInfo]:
        """
        Find a model by name in the specified environment.

        Args:
            model_name: Name of the model (e.g., "orders")
            base: If True, search base models; otherwise search current

        Returns:
            ModelInfo if found, None otherwise
        """
        models = self.base_models if base else self.curr_models
        for model in models.values():
            if model.name == model_name:
                return model
        return None

    def row_count_sql(self, model_name: str, base: bool = False) -> str:
        """
        Generate row count SQL for a single environment.

        Args:
            model_name: Name of the model
            base: If True, use base environment; otherwise current

        Returns:
            SQL query that counts rows

        Raises:
            ValueError: If model not found
        """
        model = self._find_model_by_name(model_name, base=base)
        if model is None:
            env = "base" if base else "current"
            raise ValueError(f"Model '{model_name}' not found in {env} environment")

        return f"SELECT COUNT(*) as row_count FROM {model.full_name}"

    def row_count_diff_sql(self, model_name: str) -> str:
        """
        Generate row count comparison SQL for both environments.

        Returns a UNION query that counts rows in both base and current,
        labeled by environment for easy comparison.

        Args:
            model_name: Name of the model

        Returns:
            SQL query with row counts for both environments
        """
        base = self._find_model_by_name(model_name, base=True)
        curr = self._find_model_by_name(model_name, base=False)

        if base is None and curr is None:
            raise ValueError(f"Model '{model_name}' not found in either environment")

        parts = []
        if base:
            parts.append(f"SELECT 'base' as environment, COUNT(*) as row_count " f"FROM {base.full_name}")
        if curr:
            parts.append(f"SELECT 'current' as environment, COUNT(*) as row_count " f"FROM {curr.full_name}")

        return "\nUNION ALL\n".join(parts)

    def data_diff_sql(self, model_name: str, primary_keys: List[str], columns: Optional[List[str]] = None) -> str:
        """
        Generate FULL OUTER JOIN diff SQL for data comparison.

        Compares rows between base and current environments using primary key(s),
        identifying added, removed, and modified rows.

        Args:
            model_name: Name of the model
            primary_keys: Column(s) that uniquely identify rows
            columns: Specific columns to compare (None = all columns)

        Returns:
            SQL query that shows differences between environments
        """
        base = self._find_model_by_name(model_name, base=True)
        curr = self._find_model_by_name(model_name, base=False)

        if base is None or curr is None:
            raise ValueError(f"Model '{model_name}' must exist in both environments for data diff")

        # Build join condition
        pk_join = " AND ".join([f"b.{pk} = c.{pk}" for pk in primary_keys])
        pk_first = primary_keys[0]

        # Build coalesce for primary keys
        pk_coalesce = ", ".join([f"COALESCE(b.{pk}, c.{pk}) as {pk}" for pk in primary_keys])

        # Use a simpler query that works across databases
        # The HASH comparison is used to detect changes without listing all columns
        return f"""
WITH base_data AS (
    SELECT *, '{base.full_name}' as _source FROM {base.full_name}
),
curr_data AS (
    SELECT *, '{curr.full_name}' as _source FROM {curr.full_name}
),
joined AS (
    SELECT
        CASE
            WHEN b.{pk_first} IS NULL THEN 'added'
            WHEN c.{pk_first} IS NULL THEN 'removed'
            ELSE 'modified'
        END as _diff_status,
        {pk_coalesce},
        b.{pk_first} as _base_pk,
        c.{pk_first} as _curr_pk
    FROM base_data b
    FULL OUTER JOIN curr_data c ON {pk_join}
)
SELECT * FROM joined
WHERE _base_pk IS NULL
   OR _curr_pk IS NULL
"""

    def schema_diff_sql(self, model_name: str) -> str:
        """
        Generate SQL to compare schema between environments.

        Uses INFORMATION_SCHEMA to compare column definitions.

        Args:
            model_name: Name of the model

        Returns:
            SQL query that shows schema differences
        """
        base = self._find_model_by_name(model_name, base=True)
        curr = self._find_model_by_name(model_name, base=False)

        if base is None or curr is None:
            raise ValueError(f"Model '{model_name}' must exist in both environments for schema diff")

        # Note: This is a simplified version. Real implementation may need
        # database-specific queries for INFORMATION_SCHEMA
        return f"""
WITH base_schema AS (
    SELECT column_name, data_type, ordinal_position
    FROM {base.database}.INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema = '{base.schema_name}'
      AND table_name = '{base.name}'
),
curr_schema AS (
    SELECT column_name, data_type, ordinal_position
    FROM {curr.database}.INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema = '{curr.schema_name}'
      AND table_name = '{curr.name}'
)
SELECT
    COALESCE(b.column_name, c.column_name) as column_name,
    b.data_type as base_type,
    c.data_type as curr_type,
    CASE
        WHEN b.column_name IS NULL THEN 'added'
        WHEN c.column_name IS NULL THEN 'removed'
        WHEN b.data_type != c.data_type THEN 'type_changed'
        ELSE 'unchanged'
    END as diff_status
FROM base_schema b
FULL OUTER JOIN curr_schema c ON b.column_name = c.column_name
WHERE b.column_name IS NULL
   OR c.column_name IS NULL
   OR b.data_type != c.data_type
ORDER BY COALESCE(b.ordinal_position, c.ordinal_position)
"""

    def profile_sql(self, model_name: str, base: bool = False) -> str:
        """
        Generate basic profiling SQL for a model.

        Args:
            model_name: Name of the model
            base: If True, use base environment

        Returns:
            SQL query with basic column statistics
        """
        model = self._find_model_by_name(model_name, base=base)
        if model is None:
            env = "base" if base else "current"
            raise ValueError(f"Model '{model_name}' not found in {env} environment")

        return f"""
SELECT
    COUNT(*) as total_rows,
    COUNT(*) - COUNT(*) FILTER (WHERE TRUE) as null_count
FROM {model.full_name}
"""
