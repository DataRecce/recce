"""
Data models for the Metadata Adapter.

These dataclasses represent model and invocation metadata loaded from
the recce_metadata schema, with pre-resolved database coordinates.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class ModelInfo:
    """
    Represents a model from recce_metadata with resolved coordinates.

    The key insight is that `full_name` provides the fully qualified table
    reference, eliminating the need for macro compilation like {{ ref('orders') }}.

    Attributes:
        unique_id: Unique identifier (e.g., "model.jaffle_shop.orders")
        name: Model name (e.g., "orders")
        database: Database name (e.g., "jaffle_shop")
        schema_name: Schema name (e.g., "dev" or "prod")
        checksum: Content hash for change detection
        resource_type: Type of resource ("model", "seed", "snapshot")
        depends_on: List of upstream dependency unique_ids
        package_name: dbt package name
        raw_code: Original SQL/model code (optional)
        config: Model configuration (optional, defaults to empty dict)
        columns: Column metadata dict (optional, defaults to empty dict)
        primary_key: Primary key column name (optional)
    """

    unique_id: str
    name: str
    database: str
    schema_name: str
    checksum: str
    resource_type: str = "model"
    depends_on: List[str] = field(default_factory=list)
    package_name: Optional[str] = None
    raw_code: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)
    columns: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    primary_key: Optional[str] = None

    @property
    def full_name(self) -> str:
        """
        Fully qualified table reference for SQL generation.

        This is the cornerstone of the macro-free approach:
        Instead of compiling {{ ref('orders') }}, we directly use
        the resolved coordinate: database.schema.name

        Returns:
            Fully qualified table name (e.g., "jaffle_shop.dev.orders")
        """
        return f"{self.database}.{self.schema_name}.{self.name}"

    def to_lineage_node(self) -> dict:
        """
        Convert to the lineage node format expected by Recce's UI.

        This format matches the dbt adapter's get_lineage_cached() output
        to ensure consistent API responses.

        Returns:
            Dictionary compatible with LineageDiff.base/current format
        """
        node = {
            "id": self.unique_id,
            "name": self.name,
            "resource_type": self.resource_type,
            "package_name": self.package_name,
            "schema": self.schema_name,
            "config": self.config,
            "checksum": {"name": "sha256", "checksum": self.checksum},
            "raw_code": self.raw_code,
            "columns": self.columns,
        }
        if self.primary_key:
            node["primary_key"] = self.primary_key
        return node


@dataclass
class InvocationInfo:
    """
    Represents a recce_metadata invocation (a point-in-time snapshot).

    Each invocation captures the state of all models at a specific moment,
    enabling comparison between different environments or time points.

    Attributes:
        invocation_id: Unique identifier (UUID)
        generated_at: When the invocation was created
        project_name: Name of the dbt project
        git_sha: Git commit SHA (optional)
        git_branch: Git branch name (optional)
        framework: Framework type (e.g., "dbt-core", "dbt-cloud")
        adapter_type: Database adapter (e.g., "duckdb", "snowflake")
    """

    invocation_id: str
    generated_at: datetime
    project_name: str
    git_sha: Optional[str] = None
    git_branch: Optional[str] = None
    framework: Optional[str] = None
    adapter_type: Optional[str] = None

    def __repr__(self) -> str:
        branch_info = f" ({self.git_branch})" if self.git_branch else ""
        return f"Invocation({self.invocation_id[:8]}...{branch_info} @ {self.generated_at})"
