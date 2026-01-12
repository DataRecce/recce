"""
Metadata Loader - Queries the recce_metadata schema.

This module handles all SQL queries to the recce_metadata schema,
loading invocations and model metadata into Python dataclasses.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from recce.adapter.metadata_adapter.models import InvocationInfo, ModelInfo

logger = logging.getLogger("uvicorn")


class MetadataLoader:
    """
    Loads model metadata from recce_metadata schema.

    The loader abstracts the SQL queries needed to read from the metadata
    tables, converting raw rows into typed ModelInfo and InvocationInfo objects.

    Attributes:
        connection: Database connection (SQLAlchemy connection or similar)
        schema: Name of the metadata schema (default: "recce_metadata")
    """

    def __init__(self, connection: Any, schema: str = "recce_metadata"):
        """
        Initialize the metadata loader.

        Args:
            connection: Database connection with execute() method
            schema: Name of the schema containing metadata tables
        """
        self.connection = connection
        self.schema = schema

    def _execute(self, sql: str) -> List[Dict]:
        """
        Execute SQL and return results as list of dicts.

        Args:
            sql: SQL query to execute

        Returns:
            List of dictionaries, one per row
        """
        result = self.connection.execute(sql)
        if hasattr(result, "fetchall"):
            rows = result.fetchall()
            # Handle different result types (SQLAlchemy, DuckDB, etc.)
            if rows and hasattr(rows[0], "_mapping"):
                return [dict(row._mapping) for row in rows]
            elif rows and hasattr(rows[0], "keys"):
                return [dict(row) for row in rows]
            else:
                # Assume it's a list of tuples with description
                columns = [desc[0] for desc in result.description] if hasattr(result, "description") else []
                return [dict(zip(columns, row)) for row in rows]
        return []

    def get_latest_invocations(self, limit: int = 2) -> List[InvocationInfo]:
        """
        Get most recent invocations for comparison.

        By default returns the 2 most recent invocations, which is typically
        what you want for comparing "current" vs "base" environments.

        Args:
            limit: Maximum number of invocations to return

        Returns:
            List of InvocationInfo, ordered by generated_at descending
        """
        sql = f"""
        SELECT
            invocation_id,
            generated_at,
            project_name,
            git_sha,
            git_branch,
            framework,
            adapter_type
        FROM {self.schema}.recce_invocations
        ORDER BY generated_at DESC
        LIMIT {limit}
        """
        rows = self._execute(sql)
        return [self._row_to_invocation(row) for row in rows]

    def get_invocation_by_id(self, invocation_id: str) -> Optional[InvocationInfo]:
        """
        Get specific invocation by ID.

        Args:
            invocation_id: UUID of the invocation

        Returns:
            InvocationInfo if found, None otherwise
        """
        sql = f"""
        SELECT
            invocation_id,
            generated_at,
            project_name,
            git_sha,
            git_branch,
            framework,
            adapter_type
        FROM {self.schema}.recce_invocations
        WHERE invocation_id = '{invocation_id}'
        """
        rows = self._execute(sql)
        return self._row_to_invocation(rows[0]) if rows else None

    def load_models_for_invocation(self, invocation_id: str) -> Dict[str, ModelInfo]:
        """
        Load all models for a given invocation.

        This is the core method that loads model metadata with pre-resolved
        database coordinates, enabling macro-free SQL generation.

        Args:
            invocation_id: UUID of the invocation

        Returns:
            Dictionary mapping unique_id to ModelInfo
        """
        sql = f"""
        SELECT
            unique_id,
            name,
            database_name as database,
            schema_name,
            checksum,
            resource_type,
            depends_on,
            package_name,
            raw_code,
            config
        FROM {self.schema}.recce_nodes_dbt
        WHERE invocation_id = '{invocation_id}'
        """
        rows = self._execute(sql)
        return {row["unique_id"]: self._row_to_model(row) for row in rows}

    def _row_to_invocation(self, row: Dict) -> InvocationInfo:
        """Convert a database row to InvocationInfo."""
        generated_at = row.get("generated_at")
        if isinstance(generated_at, str):
            generated_at = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))

        return InvocationInfo(
            invocation_id=row["invocation_id"],
            generated_at=generated_at,
            project_name=row.get("project_name", ""),
            git_sha=row.get("git_sha"),
            git_branch=row.get("git_branch"),
            framework=row.get("framework"),
            adapter_type=row.get("adapter_type"),
        )

    def _row_to_model(self, row: Dict) -> ModelInfo:
        """Convert a database row to ModelInfo."""
        import json

        depends_on = row.get("depends_on")
        # Handle depends_on as JSON string or list
        if isinstance(depends_on, str):
            try:
                depends_on = json.loads(depends_on)
            except (json.JSONDecodeError, TypeError):
                depends_on = []
        elif depends_on is None:
            depends_on = []

        # Handle config as JSON string or dict
        config = row.get("config")
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except (json.JSONDecodeError, TypeError):
                config = {}
        elif config is None:
            config = {}

        return ModelInfo(
            unique_id=row["unique_id"],
            name=row["name"],
            database=row["database"],
            schema_name=row["schema_name"],
            checksum=row.get("checksum", ""),
            resource_type=row.get("resource_type", "model"),
            depends_on=depends_on,
            package_name=row.get("package_name"),
            raw_code=row.get("raw_code"),
            config=config,
        )
