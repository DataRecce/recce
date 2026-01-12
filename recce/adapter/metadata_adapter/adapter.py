"""
RecceMetadataAdapter - Macro-free environment comparison adapter.

This adapter implements BaseAdapter using metadata from the recce_metadata
schema instead of manifest.json, enabling environment comparison without
requiring dbt macro compilation.
"""

import logging
import os
import re
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Literal, Optional, Set

import yaml

from recce.adapter.base import BaseAdapter
from recce.adapter.metadata_adapter.diff import (
    build_lineage_from_models,
    get_lineage_diff,
    list_modified_nodes,
)
from recce.adapter.metadata_adapter.loader import MetadataLoader
from recce.adapter.metadata_adapter.models import InvocationInfo, ModelInfo
from recce.adapter.metadata_adapter.sql_generators import MacroFreeSqlGenerator
from recce.models.types import LineageDiff
from recce.state import ArtifactsRoot

logger = logging.getLogger("uvicorn")


def _get_profiles_dir() -> str:
    """
    Get the profiles directory following dbt's precedence rules.

    Precedence: DBT_PROFILES_DIR > current working directory > ~/.dbt/
    """
    if os.getenv("DBT_PROFILES_DIR"):
        return os.getenv("DBT_PROFILES_DIR")
    elif os.path.exists(os.path.join(os.getcwd(), "profiles.yml")):
        return os.getcwd()
    else:
        return os.path.expanduser("~/.dbt/")


def _load_profile_config(
    profiles_dir: Optional[str] = None,
    project_dir: Optional[str] = None,
    profile_name: Optional[str] = None,
    target_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Load connection configuration from profiles.yml.

    Args:
        profiles_dir: Directory containing profiles.yml
        project_dir: Directory containing dbt_project.yml (to get default profile name)
        profile_name: Override profile name
        target_name: Override target name

    Returns:
        Dictionary containing the target configuration from profiles.yml

    Raises:
        ValueError: If profile or target cannot be found
    """
    # Determine profiles directory
    if profiles_dir is None:
        profiles_dir = _get_profiles_dir()

    profiles_path = os.path.join(profiles_dir, "profiles.yml")
    if not os.path.exists(profiles_path):
        raise ValueError(f"profiles.yml not found at {profiles_path}")

    # Load profiles.yml
    with open(profiles_path, "r") as f:
        profiles = yaml.safe_load(f)

    # Determine profile name from dbt_project.yml if not provided
    if profile_name is None:
        project_dir = project_dir or os.getcwd()
        dbt_project_path = os.path.join(project_dir, "dbt_project.yml")
        if os.path.exists(dbt_project_path):
            with open(dbt_project_path, "r") as f:
                dbt_project = yaml.safe_load(f)
                profile_name = dbt_project.get("profile")

        if profile_name is None:
            # Use the first profile if only one exists
            if len(profiles) == 1:
                profile_name = list(profiles.keys())[0]
            else:
                raise ValueError(
                    "Multiple profiles found and no profile specified. "
                    "Use --profile to specify which profile to use."
                )

    if profile_name not in profiles:
        raise ValueError(f"Profile '{profile_name}' not found in profiles.yml")

    profile = profiles[profile_name]

    # Determine target
    if target_name is None:
        target_name = profile.get("target")

    if target_name is None:
        raise ValueError(f"No target specified for profile '{profile_name}'")

    outputs = profile.get("outputs", {})
    if target_name not in outputs:
        raise ValueError(f"Target '{target_name}' not found in profile '{profile_name}'")

    target_config = outputs[target_name]

    # Add profile/target info to config for logging
    target_config["_profile_name"] = profile_name
    target_config["_target_name"] = target_name

    logger.info(f"Loaded profile '{profile_name}' target '{target_name}' (type: {target_config.get('type')})")

    return target_config


def _create_connection_from_profile(
    profiles_dir: Optional[str] = None,
    project_dir: Optional[str] = None,
    profile_name: Optional[str] = None,
    target_name: Optional[str] = None,
) -> Any:
    """
    Create a database connection from profiles.yml configuration.

    Supports multiple warehouse types:
    - duckdb: Local DuckDB database
    - snowflake: Snowflake connection via snowflake-connector-python
    - bigquery: BigQuery connection via google-cloud-bigquery
    - postgres: PostgreSQL connection via psycopg2
    - redshift: Redshift connection via redshift_connector

    Args:
        profiles_dir: Directory containing profiles.yml
        project_dir: Directory containing dbt_project.yml
        profile_name: Override profile name
        target_name: Override target name

    Returns:
        Database connection object

    Raises:
        ValueError: If warehouse type is not supported
        ImportError: If required connector package is not installed
    """
    config = _load_profile_config(
        profiles_dir=profiles_dir,
        project_dir=project_dir,
        profile_name=profile_name,
        target_name=target_name,
    )

    warehouse_type = config.get("type")
    profile_name = config.get("_profile_name")
    target_name = config.get("_target_name")

    if warehouse_type == "duckdb":
        return _create_duckdb_connection(config)
    elif warehouse_type == "snowflake":
        return _create_snowflake_connection(config)
    elif warehouse_type == "bigquery":
        return _create_bigquery_connection(config)
    elif warehouse_type == "postgres":
        return _create_postgres_connection(config)
    elif warehouse_type == "redshift":
        return _create_redshift_connection(config)
    else:
        raise ValueError(
            f"Unsupported warehouse type '{warehouse_type}' in profile '{profile_name}' "
            f"target '{target_name}'. Supported types: duckdb, snowflake, bigquery, postgres, redshift"
        )


def _create_duckdb_connection(config: Dict[str, Any]) -> Any:
    """Create DuckDB connection from profile config."""
    import duckdb

    db_path = config.get("path")
    if db_path is None:
        raise ValueError("No 'path' specified for DuckDB target")

    # Expand environment variables and user home
    db_path = os.path.expandvars(os.path.expanduser(db_path))

    logger.info(f"Connecting to DuckDB: {db_path}")
    return duckdb.connect(db_path, read_only=True)


def _create_snowflake_connection(config: Dict[str, Any]) -> Any:
    """Create Snowflake connection from profile config."""
    try:
        import snowflake.connector
    except ImportError:
        raise ImportError(
            "snowflake-connector-python is required for Snowflake connections. "
            "Install it with: pip install snowflake-connector-python"
        )

    conn_params = {
        "account": config.get("account"),
        "user": config.get("user"),
        "password": config.get("password"),
        "database": config.get("database"),
        "schema": config.get("schema"),
        "warehouse": config.get("warehouse"),
        "role": config.get("role"),
    }

    # Handle authenticator (for SSO, key-pair, etc.)
    if config.get("authenticator"):
        conn_params["authenticator"] = config.get("authenticator")

    # Handle private key authentication
    if config.get("private_key_path"):
        conn_params["private_key_file"] = os.path.expanduser(config.get("private_key_path"))
        if config.get("private_key_passphrase"):
            conn_params["private_key_file_pwd"] = config.get("private_key_passphrase")

    # Remove None values
    conn_params = {k: v for k, v in conn_params.items() if v is not None}

    logger.info(f"Connecting to Snowflake account: {config.get('account')}")
    return snowflake.connector.connect(**conn_params)


def _create_bigquery_connection(config: Dict[str, Any]) -> Any:
    """Create BigQuery connection from profile config."""
    try:
        from google.cloud import bigquery
    except ImportError:
        raise ImportError(
            "google-cloud-bigquery is required for BigQuery connections. "
            "Install it with: pip install google-cloud-bigquery"
        )

    project = config.get("project")
    keyfile = config.get("keyfile")

    if keyfile:
        keyfile = os.path.expanduser(keyfile)
        client = bigquery.Client.from_service_account_json(keyfile, project=project)
    else:
        # Use default credentials (GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)
        client = bigquery.Client(project=project)

    logger.info(f"Connecting to BigQuery project: {project}")
    return client


def _create_postgres_connection(config: Dict[str, Any]) -> Any:
    """Create PostgreSQL connection from profile config."""
    try:
        import psycopg2
    except ImportError:
        raise ImportError(
            "psycopg2 is required for PostgreSQL connections. " "Install it with: pip install psycopg2-binary"
        )

    conn_params = {
        "host": config.get("host"),
        "port": config.get("port", 5432),
        "user": config.get("user"),
        "password": config.get("password"),
        "dbname": config.get("dbname") or config.get("database"),
    }

    # Remove None values
    conn_params = {k: v for k, v in conn_params.items() if v is not None}

    logger.info(f"Connecting to PostgreSQL: {config.get('host')}:{config.get('port', 5432)}")
    return psycopg2.connect(**conn_params)


def _create_redshift_connection(config: Dict[str, Any]) -> Any:
    """Create Redshift connection from profile config."""
    try:
        import redshift_connector
    except ImportError:
        raise ImportError(
            "redshift_connector is required for Redshift connections. "
            "Install it with: pip install redshift_connector"
        )

    conn_params = {
        "host": config.get("host"),
        "port": config.get("port", 5439),
        "user": config.get("user"),
        "password": config.get("password"),
        "database": config.get("dbname") or config.get("database"),
    }

    # Remove None values
    conn_params = {k: v for k, v in conn_params.items() if v is not None}

    logger.info(f"Connecting to Redshift: {config.get('host')}:{config.get('port', 5439)}")
    return redshift_connector.connect(**conn_params)


class RecceMetadataAdapter(BaseAdapter):
    """
    Adapter that reads from recce_metadata schema instead of manifest.json.

    Key differences from DbtAdapter:
    - No manifest.json loading - reads from warehouse metadata tables
    - No Jinja compilation - SQL generated with resolved coordinates
    - Models are pre-loaded with database.schema.name resolved
    - Change detection via checksum comparison (O(1) per model)

    Attributes:
        connection: Database connection for executing queries
        metadata_schema: Name of the schema containing metadata tables
        base_invocation: InvocationInfo for base environment
        curr_invocation: InvocationInfo for current environment
        base_models: Models from base invocation (keyed by unique_id)
        curr_models: Models from current invocation (keyed by unique_id)
        sql_generator: MacroFreeSqlGenerator instance
    """

    def __init__(
        self,
        connection: Any,
        metadata_schema: str = "recce_metadata",
        base_invocation_id: Optional[str] = None,
        current_invocation_id: Optional[str] = None,
    ):
        """
        Initialize the metadata adapter.

        Args:
            connection: Database connection with execute() method
            metadata_schema: Name of the schema containing metadata tables
            base_invocation_id: UUID of base invocation (None = second latest)
            current_invocation_id: UUID of current invocation (None = latest)
        """
        self.connection = connection
        self.metadata_schema = metadata_schema
        self._loader = MetadataLoader(connection, metadata_schema)

        # Resolve invocations
        self._base_invocation: Optional[InvocationInfo] = None
        self._curr_invocation: Optional[InvocationInfo] = None
        self._base_models: Dict[str, ModelInfo] = {}
        self._curr_models: Dict[str, ModelInfo] = {}

        self._resolve_invocations(base_invocation_id, current_invocation_id)
        self._load_models()

        # Initialize SQL generator
        self.sql_generator = MacroFreeSqlGenerator(self._base_models, self._curr_models)

    def _resolve_invocations(self, base_invocation_id: Optional[str], current_invocation_id: Optional[str]):
        """
        Resolve invocation IDs to InvocationInfo objects.

        If IDs are not provided, uses the two most recent invocations.
        """
        if base_invocation_id and current_invocation_id:
            # Both IDs provided - load directly
            self._base_invocation = self._loader.get_invocation_by_id(base_invocation_id)
            self._curr_invocation = self._loader.get_invocation_by_id(current_invocation_id)
        else:
            # Load latest invocations
            latest = self._loader.get_latest_invocations(limit=2)
            if len(latest) >= 1:
                self._curr_invocation = latest[0]
            if len(latest) >= 2:
                self._base_invocation = latest[1]

        logger.info(f"Base invocation: {self._base_invocation}")
        logger.info(f"Current invocation: {self._curr_invocation}")

    def _load_models(self):
        """Load models for both invocations."""
        if self._base_invocation:
            self._base_models = self._loader.load_models_for_invocation(self._base_invocation.invocation_id)
            logger.info(f"Loaded {len(self._base_models)} base models")
            # Log schemas for debugging
            if self._base_models:
                schemas = set(m.schema_name for m in self._base_models.values())
                logger.debug(f"Base environment schemas: {schemas}")
                # Log first model's full_name as example
                first_model = next(iter(self._base_models.values()))
                logger.debug(f"Base example model full_name: {first_model.full_name}")

        if self._curr_invocation:
            self._curr_models = self._loader.load_models_for_invocation(self._curr_invocation.invocation_id)
            logger.info(f"Loaded {len(self._curr_models)} current models")
            # Log schemas for debugging
            if self._curr_models:
                schemas = set(m.schema_name for m in self._curr_models.values())
                logger.debug(f"Current environment schemas: {schemas}")
                # Log first model's full_name as example
                first_model = next(iter(self._curr_models.values()))
                logger.debug(f"Current example model full_name: {first_model.full_name}")

        # Compare base and current models to verify they have different schemas
        if self._base_models and self._curr_models:
            # Find a common model and compare schemas
            common_models = set(self._base_models.keys()) & set(self._curr_models.keys())
            if common_models:
                sample_id = next(iter(common_models))
                base_model = self._base_models[sample_id]
                curr_model = self._curr_models[sample_id]
                logger.info(f"Schema comparison for '{base_model.name}':")
                logger.info(f"  Base: {base_model.full_name}")
                logger.info(f"  Current: {curr_model.full_name}")
                if base_model.schema_name == curr_model.schema_name:
                    logger.warning("WARNING: Base and current models have SAME schema!")
                else:
                    logger.info(f"  Schemas are different: '{base_model.schema_name}' vs '{curr_model.schema_name}'")

        # Load column information from the warehouse for schema change detection
        self._load_columns_from_warehouse()

    def _load_columns_from_warehouse(self):
        """
        Query column information from the warehouse for all models.

        This enables schema change detection by populating the columns field
        in each ModelInfo. Uses INFORMATION_SCHEMA.COLUMNS which is supported
        across most SQL databases.
        """
        # Collect all unique tables to query
        tables_to_query: Dict[str, list] = {}  # full_name -> list of (models_dict, model)

        for model in self._base_models.values():
            if model.resource_type in ("model", "seed", "snapshot"):
                key = f"{model.database}.{model.schema_name}.{model.name}"
                if key not in tables_to_query:
                    tables_to_query[key] = []
                tables_to_query[key].append((self._base_models, model))

        for model in self._curr_models.values():
            if model.resource_type in ("model", "seed", "snapshot"):
                key = f"{model.database}.{model.schema_name}.{model.name}"
                if key not in tables_to_query:
                    tables_to_query[key] = []
                tables_to_query[key].append((self._curr_models, model))

        # Query columns for each unique table
        loaded_count = 0
        for full_name, model_refs in tables_to_query.items():
            model = model_refs[0][1]  # Use first model to get coordinates
            columns = self._query_table_columns(model.database, model.schema_name, model.name)

            if columns:
                # Apply columns to all models referencing this table
                for models_dict, m in model_refs:
                    m.columns = columns
                loaded_count += 1

        logger.info(f"Loaded columns for {loaded_count}/{len(tables_to_query)} tables")

    def _query_table_columns(self, database: str, schema: str, table: str) -> Dict[str, Dict[str, Any]]:
        """
        Query column information for a specific table from the warehouse.

        Args:
            database: Database name
            schema: Schema name
            table: Table name

        Returns:
            Dictionary mapping column_name to {name, type} dict
        """
        # Use INFORMATION_SCHEMA which works across most databases
        sql = f"""
        SELECT column_name, data_type
        FROM {database}.INFORMATION_SCHEMA.COLUMNS
        WHERE table_schema = '{schema}'
          AND table_name = '{table}'
        ORDER BY ordinal_position
        """

        try:
            result = self.connection.execute(sql)
            rows = result.fetchall()

            columns = {}
            for row in rows:
                # Handle tuple or dict result types
                if isinstance(row, tuple):
                    col_name, col_type = row[0], row[1]
                else:
                    col_name = row.get("column_name") or row.get("COLUMN_NAME")
                    col_type = row.get("data_type") or row.get("DATA_TYPE")

                if col_name:
                    columns[col_name] = {"name": col_name, "type": col_type}

            return columns
        except Exception as e:
            # Table might not exist in warehouse (e.g., never materialized)
            logger.debug(f"Could not load columns for {database}.{schema}.{table}: {e}")
            return {}

    # =========================================================================
    # BaseAdapter Interface Implementation
    # =========================================================================

    @classmethod
    def load(cls, **kwargs) -> "RecceMetadataAdapter":
        """
        Factory method to create adapter from CLI kwargs.

        Connection is determined in this order:
        1. Pre-existing 'connection' object (for testing)
        2. Create from profiles.yml using dbt profile/target settings

        Supported warehouse types (from profiles.yml):
        - duckdb: Local DuckDB database
        - snowflake: Snowflake data warehouse
        - bigquery: Google BigQuery
        - postgres: PostgreSQL database
        - redshift: Amazon Redshift

        Expected kwargs (from CLI):
            profiles_dir: Directory containing profiles.yml
            project_dir: Directory containing dbt_project.yml
            profile: Profile name to use
            target: Target name to use
            metadata_schema: Schema name (default: "recce_metadata")
            base_invocation_id: Optional UUID for base environment
            curr_invocation_id: Optional UUID for current environment

        Or direct kwargs:
            connection: Pre-existing database connection
        """
        # Use provided connection or create from profiles.yml
        connection = kwargs.get("connection")
        if connection is None:
            connection = _create_connection_from_profile(
                profiles_dir=kwargs.get("profiles_dir"),
                project_dir=kwargs.get("project_dir"),
                profile_name=kwargs.get("profile"),
                target_name=kwargs.get("target"),
            )

        return cls(
            connection=connection,
            metadata_schema=kwargs.get("metadata_schema", "recce_metadata"),
            base_invocation_id=kwargs.get("base_invocation_id"),
            current_invocation_id=kwargs.get("curr_invocation_id"),
        )

    def get_lineage(self, base: Optional[bool] = False) -> dict:
        """
        Return DAG structure from loaded models.

        Args:
            base: If True, return base lineage; otherwise current

        Returns:
            Dictionary with 'nodes', 'parent_map', 'child_map' keys
        """
        models = self._base_models if base else self._curr_models
        return build_lineage_from_models(models)

    def get_lineage_diff(self) -> LineageDiff:
        """
        Compare base vs current using checksums.

        Returns:
            LineageDiff containing base lineage, current lineage, and diff map
        """
        return get_lineage_diff(self._base_models, self._curr_models)

    def select_nodes(
        self,
        select: Optional[str] = None,
        exclude: Optional[str] = None,
        packages: Optional[list[str]] = None,
        view_mode: Optional[Literal["all", "changed_models"]] = None,
    ) -> Set[str]:
        """
        Select nodes based on criteria.

        For MVP, implements basic selection. Full dbt selector syntax
        (e.g., "state:modified+") can be added later.

        Args:
            select: Selection pattern (e.g., model name or "state:modified")
            exclude: Exclusion pattern
            packages: Filter by package names
            view_mode: "all" or "changed_models"

        Returns:
            Set of unique_ids matching the selection
        """
        # Start with all current models
        selected = set(self._curr_models.keys())

        # Filter by view_mode
        if view_mode == "changed_models":
            changes = list_modified_nodes(self._base_models, self._curr_models)
            selected = {uid for uid, _ in changes}

        # Filter by select pattern
        if select:
            if select == "state:modified":
                changes = list_modified_nodes(self._base_models, self._curr_models)
                selected = {uid for uid, _ in changes}
            elif select.startswith("model."):
                # Direct unique_id match
                if select in selected:
                    selected = {select}
                else:
                    selected = set()
            else:
                # Treat as model name pattern
                selected = {uid for uid, m in self._curr_models.items() if select in m.name and uid in selected}

        # Filter by packages
        if packages:
            selected = {
                uid
                for uid in selected
                if self._curr_models.get(uid, ModelInfo("", "", "", "", "")).package_name in packages
            }

        # Apply exclusions
        if exclude:
            selected = {
                uid for uid in selected if exclude not in self._curr_models.get(uid, ModelInfo("", "", "", "", "")).name
            }

        return selected

    def get_model(self, model_id: str, base: bool = False) -> Optional[ModelInfo]:
        """
        Get model by unique_id.

        Args:
            model_id: Unique ID (e.g., "model.jaffle_shop.orders")
            base: If True, get from base; otherwise current

        Returns:
            ModelInfo if found, None otherwise
        """
        models = self._base_models if base else self._curr_models
        return models.get(model_id)

    def get_node_name_by_id(self, unique_id: str) -> Optional[str]:
        """
        Get model name from unique_id.

        Checks current first, then base.

        Args:
            unique_id: Unique ID (e.g., "model.jaffle_shop.orders")

        Returns:
            Model name (e.g., "orders") if found, None otherwise
        """
        model = self._curr_models.get(unique_id) or self._base_models.get(unique_id)
        return model.name if model else None

    def support_tasks(self) -> Dict[str, bool]:
        """
        Get the adapter supported tasks.

        Returns map of task names to whether they're supported.
        """
        return {
            "row_count_diff": True,
            "value_diff": True,
            "schema_diff": True,
            "query": True,
            "query_diff": True,
            "profile_diff": False,  # TODO: Implement
            "top_k_diff": False,  # TODO: Implement
            "histogram_diff": False,  # TODO: Implement
            "lineage_diff": True,
        }

    def export_artifacts(self) -> ArtifactsRoot:
        """
        Export artifacts for state persistence.

        Returns:
            ArtifactsRoot with base and current model data
        """
        return ArtifactsRoot(
            base={
                "invocation": self._base_invocation.__dict__ if self._base_invocation else None,
                "models": {k: v.__dict__ for k, v in self._base_models.items()},
            },
            current={
                "invocation": self._curr_invocation.__dict__ if self._curr_invocation else None,
                "models": {k: v.__dict__ for k, v in self._curr_models.items()},
            },
        )

    # =========================================================================
    # SQL Execution Methods
    # =========================================================================

    def execute_sql(self, sql: str, limit: Optional[int] = None) -> Any:
        """
        Execute raw SQL against the warehouse.

        Args:
            sql: SQL query to execute
            limit: Optional row limit

        Returns:
            Query results (format depends on connection type)
        """
        if limit:
            sql = f"SELECT * FROM ({sql}) LIMIT {limit}"
        return self.connection.execute(sql)

    def row_count_diff(self, model_name: str) -> Dict[str, int]:
        """
        Get row counts for a model in both environments.

        Args:
            model_name: Name of the model

        Returns:
            Dictionary with 'base' and 'current' row counts
        """
        sql = self.sql_generator.row_count_diff_sql(model_name)
        result = self.execute_sql(sql)

        counts = {}
        for row in result.fetchall():
            env = row[0] if isinstance(row, tuple) else row["environment"]
            count = row[1] if isinstance(row, tuple) else row["row_count"]
            counts[env] = count

        return counts

    def data_diff(self, model_name: str, primary_keys: list, limit: int = 100) -> Any:
        """
        Get data differences between environments.

        Args:
            model_name: Name of the model
            primary_keys: Columns that uniquely identify rows
            limit: Maximum rows to return

        Returns:
            Query results showing added/removed/modified rows
        """
        sql = self.sql_generator.data_diff_sql(model_name, primary_keys)
        return self.execute_sql(sql, limit=limit)

    # =========================================================================
    # Connection Management (for task compatibility)
    # =========================================================================

    @contextmanager
    def connection_named(self, name: str) -> Iterator[None]:
        """
        Context manager for connection handling.

        For the metadata adapter, we use a single persistent connection,
        so this is a no-op that maintains API compatibility with DbtAdapter.

        Args:
            name: Connection name (for logging/debugging)
        """
        logger.debug(f"Connection context: {name}")
        yield

    def get_thread_connection(self) -> Any:
        """
        Get the current thread's database connection.

        Returns the adapter's connection for task execution.
        """
        return self.connection

    def cancel(self, connection: Any) -> None:
        """
        Cancel a running query on the given connection.

        For DuckDB, we can't easily cancel queries, so this is a no-op.
        Other databases may support cancellation.
        """
        logger.debug("Cancel requested (not implemented for this adapter)")

    def execute(self, sql: str, fetch: bool = True, auto_begin: bool = True) -> tuple:
        """
        Execute SQL and return results in dbt-compatible format.

        Args:
            sql: SQL query to execute
            fetch: Whether to fetch results
            auto_begin: Whether to auto-begin transaction (ignored)

        Returns:
            Tuple of (status, result_table) matching dbt adapter format
        """
        result = self.connection.execute(sql)

        if fetch and hasattr(result, "fetchall"):
            rows = result.fetchall()
            # Get column names
            if hasattr(result, "description") and result.description:
                columns = [desc[0] for desc in result.description]
            else:
                columns = []

            # Create an agate-like table structure for compatibility
            from recce.adapter.metadata_adapter.result_table import ResultTable

            table = ResultTable(columns, rows)
            return ("OK", table)

        return ("OK", None)

    # =========================================================================
    # SQL Generation (macro-free ref() replacement)
    # =========================================================================

    def generate_sql(self, sql_template: str, base: bool = False, context: Dict = None) -> str:
        """
        Generate executable SQL by replacing table references with full table names.

        Supports two patterns:
        1. {{ ref('model') }} - Jinja-style ref syntax
        2. Bare table names (e.g., 'customers') - Auto-resolved using sqlglot

        Unlike the dbt adapter which compiles Jinja templates, this uses
        sqlglot to parse and transform table references to fully qualified names.

        Args:
            sql_template: SQL with table references
            base: If True, resolve refs to base environment tables
            context: Additional context (ignored in metadata adapter)

        Returns:
            SQL with table references replaced by fully qualified table names
        """
        import sqlglot
        import sqlglot.expressions as exp

        models = self._base_models if base else self._curr_models
        env_name = "base" if base else "current"

        # Build lookup of model names (case-insensitive) -> full_name
        model_lookup: Dict[str, str] = {}
        for model in models.values():
            model_lookup[model.name.lower()] = model.full_name

        logger.debug(f"generate_sql called for {env_name} environment, base={base}")
        # Log detailed model info for debugging
        if model_lookup:
            sample_models = list(model_lookup.items())[:3]
            logger.debug(f"Model lookup sample ({env_name}): {sample_models}")
            # Verify we're using the right model set
            logger.debug(f"Using {'_base_models' if base else '_curr_models'} with {len(models)} models")

        # Step 1: Replace {{ ref('model_name') }} with placeholder for sqlglot parsing
        # Store the mapping of placeholder -> model_name
        ref_placeholders: Dict[str, str] = {}
        ref_pattern = r"\{\{\s*ref\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}"

        def replace_ref_with_placeholder(match) -> str:
            model_name = match.group(1)
            # Use a placeholder that's a valid SQL identifier
            placeholder = f"__ref_{model_name.replace('-', '_')}__"
            ref_placeholders[placeholder.lower()] = model_name
            return placeholder

        sql = re.sub(ref_pattern, replace_ref_with_placeholder, sql_template)

        # Step 2: Parse SQL with sqlglot and qualify table names
        try:
            parsed = sqlglot.parse_one(sql)

            def qualify_tables(node):
                if not isinstance(node, exp.Table):
                    return node
                # Skip if already qualified
                if node.db or node.catalog:
                    logger.debug(f"Table already qualified: {node}")
                    return node

                table_name = node.name.lower()
                logger.debug(f"Processing table: '{table_name}' (original: '{node.name}')")

                # Check if it's a ref placeholder
                if table_name in ref_placeholders:
                    model_name = ref_placeholders[table_name]
                    full_name = model_lookup.get(model_name.lower())
                    logger.debug(f"  Ref placeholder '{table_name}' -> model '{model_name}' -> full_name '{full_name}'")
                else:
                    # Check if it's a known model
                    full_name = model_lookup.get(table_name)
                    logger.debug(f"  Direct lookup '{table_name}' -> full_name '{full_name}'")

                if not full_name:
                    logger.debug(f"  No full_name found for '{table_name}', leaving as-is")
                    return node  # Unknown table, leave as-is

                # Parse the full name and create qualified table
                parts = full_name.split(".")
                if len(parts) == 3:
                    return exp.Table(
                        this=exp.to_identifier(parts[2]),
                        db=exp.to_identifier(parts[1]),
                        catalog=exp.to_identifier(parts[0]),
                        alias=node.alias,
                    )
                elif len(parts) == 2:
                    return exp.Table(this=exp.to_identifier(parts[1]), db=exp.to_identifier(parts[0]), alias=node.alias)
                return node

            result = parsed.copy().transform(qualify_tables)
            generated_sql = result.sql()
            logger.debug(f"Generated SQL for {env_name}: {generated_sql}")
            return generated_sql

        except Exception as e:
            # If sqlglot parsing fails, fall back to simple ref() replacement only
            logger.warning(f"sqlglot parsing failed, using simple replacement: {e}")

            def replace_ref(match) -> str:
                model_name = match.group(1)
                full_name = model_lookup.get(model_name.lower())
                if full_name:
                    return full_name
                logger.warning(f"Model '{model_name}' not found for ref() replacement")
                return model_name

            return re.sub(ref_pattern, replace_ref, sql_template)

    # =========================================================================
    # Convenience Properties
    # =========================================================================

    @property
    def base_invocation(self) -> Optional[InvocationInfo]:
        """Get base invocation info."""
        return self._base_invocation

    @property
    def curr_invocation(self) -> Optional[InvocationInfo]:
        """Get current invocation info."""
        return self._curr_invocation

    @property
    def base_models(self) -> Dict[str, ModelInfo]:
        """Get base models dictionary."""
        return self._base_models

    @property
    def curr_models(self) -> Dict[str, ModelInfo]:
        """Get current models dictionary."""
        return self._curr_models

    def find_model_by_name(self, model_name: str, base: bool = False) -> Optional[ModelInfo]:
        """
        Find a model by name.

        Args:
            model_name: Name of the model (e.g., "orders")
            base: If True, search base; otherwise current

        Returns:
            ModelInfo if found, None otherwise
        """
        models = self._base_models if base else self._curr_models
        for model in models.values():
            if model.name == model_name:
                return model
        return None
