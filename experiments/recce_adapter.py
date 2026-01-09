"""
Recce SQL Adapter

A unified SQL adapter that:
- Reuses dbt profiles.yml for connection configuration
- Supports DuckDB and Snowflake (extensible to other warehouses)
- Uses sqlglot for dialect-aware SQL generation
- Provides the minimal interface Recce needs

Usage:
    from recce_adapter import RecceAdapter

    # From dbt profiles.yml
    adapter = RecceAdapter.from_dbt_profile("~/.dbt/profiles.yml", "jaffle_shop", "dev")

    # Direct connection
    adapter = RecceAdapter.connect_snowflake(
        account="xxx", user="user", password="pass",
        database="db", schema="schema", warehouse="wh"
    )

    # Execute queries
    result = adapter.execute("SELECT * FROM customers LIMIT 10")
    print(result.columns, result.rows)

    # Dialect-aware quoting
    table_ref = adapter.quote_table("my_schema", "my_table")
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import json


@dataclass
class QueryResult:
    """Result of a SQL query execution."""

    columns: List[str]
    rows: List[Tuple[Any, ...]]

    @property
    def row_count(self) -> int:
        return len(self.rows)

    def to_dicts(self) -> List[Dict[str, Any]]:
        """Convert to list of dictionaries."""
        return [dict(zip(self.columns, row)) for row in self.rows]

    def to_dataframe(self):
        """Convert to pandas DataFrame (if pandas available)."""
        try:
            import pandas as pd
            return pd.DataFrame(self.rows, columns=self.columns)
        except ImportError:
            raise ImportError("pandas is required for to_dataframe()")


def _try_import_sqlglot():
    """Try to import sqlglot for better dialect handling."""
    try:
        import sqlglot
        return sqlglot
    except ImportError:
        return None


class BaseDialect(ABC):
    """Base class for SQL dialect handling."""

    name: str
    sqlglot_dialect: Optional[str] = None  # sqlglot dialect name

    def __init__(self):
        self._sqlglot = _try_import_sqlglot()

    @abstractmethod
    def quote_identifier_fallback(self, name: str) -> str:
        """Quote a single identifier (fallback without sqlglot)."""
        pass

    def quote_identifier(self, name: str) -> str:
        """Quote a single identifier."""
        if self._sqlglot and self.sqlglot_dialect:
            try:
                return self._sqlglot.exp.to_identifier(name, quoted=True).sql(
                    dialect=self.sqlglot_dialect
                )
            except Exception:
                pass
        return self.quote_identifier_fallback(name)

    def quote_table(
        self,
        table: str,
        schema: Optional[str] = None,
        database: Optional[str] = None,
    ) -> str:
        """Quote a full table reference."""
        if self._sqlglot and self.sqlglot_dialect:
            try:
                parts = [p for p in [database, schema, table] if p]
                full_name = ".".join(parts)
                return self._sqlglot.exp.to_table(full_name).sql(
                    dialect=self.sqlglot_dialect
                )
            except Exception:
                pass

        # Fallback
        parts = []
        if database:
            parts.append(self.quote_identifier(database))
        if schema:
            parts.append(self.quote_identifier(schema))
        parts.append(self.quote_identifier(table))
        return ".".join(parts)


class DuckDBDialect(BaseDialect):
    """DuckDB SQL dialect."""

    name = "duckdb"
    sqlglot_dialect = "duckdb"

    def quote_identifier_fallback(self, name: str) -> str:
        # DuckDB uses double quotes, preserves case
        escaped = name.replace('"', '""')
        return f'"{escaped}"'


class SnowflakeDialect(BaseDialect):
    """Snowflake SQL dialect."""

    name = "snowflake"
    sqlglot_dialect = "snowflake"

    def quote_identifier_fallback(self, name: str) -> str:
        # Snowflake uses double quotes, case-sensitive when quoted
        escaped = name.replace('"', '""')
        return f'"{escaped}"'


class PostgresDialect(BaseDialect):
    """PostgreSQL dialect (for future use)."""

    name = "postgres"
    sqlglot_dialect = "postgres"

    def quote_identifier_fallback(self, name: str) -> str:
        escaped = name.replace('"', '""')
        return f'"{escaped}"'


class BigQueryDialect(BaseDialect):
    """BigQuery dialect (for future use)."""

    name = "bigquery"
    sqlglot_dialect = "bigquery"

    def quote_identifier_fallback(self, name: str) -> str:
        # BigQuery uses backticks
        escaped = name.replace("`", "\\`")
        return f"`{escaped}`"


# Dialect registry
DIALECTS = {
    "duckdb": DuckDBDialect(),
    "snowflake": SnowflakeDialect(),
    "postgres": PostgresDialect(),
    "bigquery": BigQueryDialect(),
}


class RecceAdapter:
    """
    Unified SQL adapter for Recce.

    Supports multiple warehouses through a common interface,
    reusing dbt profiles.yml for configuration.
    """

    def __init__(
        self,
        connection: Any,
        dialect: BaseDialect,
        connection_params: Optional[Dict] = None,
    ):
        """
        Initialize adapter with a database connection.

        Args:
            connection: Database connection object
            dialect: SQL dialect for quoting
            connection_params: Original connection parameters (for reconnection)
        """
        self._connection = connection
        self._dialect = dialect
        self._connection_params = connection_params or {}

    @property
    def dialect_name(self) -> str:
        """Get the dialect name."""
        return self._dialect.name

    def quote_identifier(self, name: str) -> str:
        """Quote a single identifier for this dialect."""
        return self._dialect.quote_identifier(name)

    def quote_table(
        self,
        table: str,
        schema: Optional[str] = None,
        database: Optional[str] = None,
    ) -> str:
        """Quote a full table reference for this dialect."""
        return self._dialect.quote_table(table, schema, database)

    def execute(self, sql: str, params: Optional[Dict] = None) -> QueryResult:
        """
        Execute a SQL query and return results.

        Args:
            sql: SQL query to execute
            params: Optional query parameters

        Returns:
            QueryResult with columns and rows
        """
        cursor = self._connection.cursor()
        try:
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)

            # Check if query returns results
            if cursor.description:
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                return QueryResult(columns=columns, rows=[tuple(row) for row in rows])
            else:
                return QueryResult(columns=[], rows=[])
        finally:
            cursor.close()

    def test_connection(self) -> bool:
        """Test if the connection is working."""
        try:
            result = self.execute("SELECT 1")
            return result.row_count == 1
        except Exception as e:
            print(f"Connection test failed: {e}")
            return False

    def get_columns(self, table: str, schema: Optional[str] = None) -> List[Dict[str, str]]:
        """
        Get column information for a table.

        Args:
            table: Table name
            schema: Optional schema name

        Returns:
            List of dicts with 'name' and 'type' keys
        """
        if self._dialect.name == "duckdb":
            sql = f"DESCRIBE {self.quote_table(table, schema)}"
            result = self.execute(sql)
            return [
                {"name": row[0], "type": row[1]}
                for row in result.rows
            ]
        elif self._dialect.name == "snowflake":
            sql = f"DESCRIBE TABLE {self.quote_table(table, schema)}"
            result = self.execute(sql)
            return [
                {"name": row[0], "type": row[1]}
                for row in result.rows
            ]
        else:
            raise NotImplementedError(f"get_columns not implemented for {self._dialect.name}")

    def close(self):
        """Close the database connection."""
        if self._connection:
            self._connection.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    # --- Factory methods ---

    @classmethod
    def from_dbt_profile(
        cls,
        profiles_path: Union[str, Path],
        profile_name: str,
        target_name: str,
    ) -> "RecceAdapter":
        """
        Create adapter from dbt profiles.yml.

        Args:
            profiles_path: Path to profiles.yml
            profile_name: Name of the profile (e.g., "jaffle_shop")
            target_name: Name of the target (e.g., "dev", "prod")

        Returns:
            Configured RecceAdapter
        """
        import yaml

        profiles_path = Path(profiles_path).expanduser()
        with open(profiles_path) as f:
            profiles = yaml.safe_load(f)

        if profile_name not in profiles:
            available = list(profiles.keys())
            raise ValueError(f"Profile '{profile_name}' not found. Available: {available}")

        profile = profiles[profile_name]
        outputs = profile.get("outputs", {})

        if target_name not in outputs:
            available = list(outputs.keys())
            raise ValueError(f"Target '{target_name}' not found. Available: {available}")

        config = outputs[target_name]
        dialect_type = config.get("type")

        if dialect_type == "duckdb":
            return cls.connect_duckdb(
                path=config.get("path", ":memory:"),
            )
        elif dialect_type == "snowflake":
            return cls.connect_snowflake(
                account=config["account"],
                user=config["user"],
                password=config.get("password"),
                private_key_path=config.get("private_key_path"),
                private_key_passphrase=config.get("private_key_passphrase"),
                database=config["database"],
                schema=config["schema"],
                warehouse=config["warehouse"],
                role=config.get("role"),
            )
        else:
            raise ValueError(f"Unsupported dialect: {dialect_type}. Supported: duckdb, snowflake")

    @classmethod
    def connect_duckdb(
        cls,
        path: str = ":memory:",
        read_only: bool = False,
    ) -> "RecceAdapter":
        """
        Connect to DuckDB.

        Args:
            path: Path to database file, or ":memory:" for in-memory
            read_only: Open in read-only mode

        Returns:
            RecceAdapter connected to DuckDB
        """
        try:
            import duckdb
        except ImportError:
            raise ImportError("duckdb package is required. Install with: pip install duckdb")

        connection = duckdb.connect(path, read_only=read_only)

        return cls(
            connection=connection,
            dialect=DIALECTS["duckdb"],
            connection_params={"path": path, "read_only": read_only},
        )

    @classmethod
    def connect_snowflake(
        cls,
        account: str,
        user: str,
        password: Optional[str] = None,
        private_key_path: Optional[str] = None,
        private_key_passphrase: Optional[str] = None,
        database: str = None,
        schema: str = None,
        warehouse: str = None,
        role: Optional[str] = None,
    ) -> "RecceAdapter":
        """
        Connect to Snowflake.

        Args:
            account: Snowflake account identifier
            user: Username
            password: Password (if using password auth)
            private_key_path: Path to private key file (if using key-pair auth)
            private_key_passphrase: Passphrase for private key
            database: Database name
            schema: Schema name
            warehouse: Warehouse name
            role: Optional role to use

        Returns:
            RecceAdapter connected to Snowflake
        """
        try:
            import snowflake.connector
        except ImportError:
            raise ImportError(
                "snowflake-connector-python is required. "
                "Install with: pip install snowflake-connector-python"
            )

        connect_params = {
            "account": account,
            "user": user,
            "database": database,
            "schema": schema,
            "warehouse": warehouse,
        }

        if role:
            connect_params["role"] = role

        # Handle authentication
        if private_key_path:
            # Key-pair authentication
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import serialization

            with open(Path(private_key_path).expanduser(), "rb") as key_file:
                private_key = serialization.load_pem_private_key(
                    key_file.read(),
                    password=private_key_passphrase.encode() if private_key_passphrase else None,
                    backend=default_backend(),
                )

            connect_params["private_key"] = private_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        elif password:
            connect_params["password"] = password
        else:
            raise ValueError("Either password or private_key_path must be provided")

        connection = snowflake.connector.connect(**connect_params)

        return cls(
            connection=connection,
            dialect=DIALECTS["snowflake"],
            connection_params={
                "account": account,
                "user": user,
                "database": database,
                "schema": schema,
                "warehouse": warehouse,
                "role": role,
            },
        )


class TemplateRenderer:
    """
    Render SQL templates with ref() and source() support.

    This is a simple replacement for dbt's Jinja rendering,
    supporting only the features Recce needs.
    """

    def __init__(self, adapter: RecceAdapter):
        self.adapter = adapter
        self._refs: Dict[str, Tuple[str, str, Optional[str]]] = {}  # name -> (schema, table, database)
        self._sources: Dict[Tuple[str, str], Tuple[str, str, Optional[str]]] = {}  # (source, table) -> (schema, table, database)

    def add_ref(
        self,
        model_name: str,
        schema: str,
        table: Optional[str] = None,
        database: Optional[str] = None,
    ):
        """
        Register a model for ref() resolution.

        Args:
            model_name: Model name as used in ref('model_name')
            schema: Schema where the model lives
            table: Table name (defaults to model_name)
            database: Optional database name
        """
        self._refs[model_name] = (schema, table or model_name, database)

    def add_source(
        self,
        source_name: str,
        table_name: str,
        schema: str,
        physical_table: Optional[str] = None,
        database: Optional[str] = None,
    ):
        """
        Register a source for source() resolution.

        Args:
            source_name: Source name as used in source('source_name', 'table_name')
            table_name: Table name in the source() call
            schema: Schema where the source lives
            physical_table: Actual table name (defaults to table_name)
            database: Optional database name
        """
        self._sources[(source_name, table_name)] = (schema, physical_table or table_name, database)

    def render(self, sql_template: str) -> str:
        """
        Render SQL template, replacing ref() and source() calls.

        Args:
            sql_template: SQL with {{ ref('...') }} and {{ source('...', '...') }}

        Returns:
            Rendered SQL with proper table references
        """
        import re

        sql = sql_template

        # Replace {{ ref('model_name') }}
        ref_pattern = r"\{\{\s*ref\(['\"]([^'\"]+)['\"]\)\s*\}\}"

        def ref_replacer(match):
            model_name = match.group(1)
            if model_name in self._refs:
                schema, table, database = self._refs[model_name]
                return self.adapter.quote_table(table, schema, database)
            else:
                raise ValueError(f"Unknown ref: {model_name}")

        sql = re.sub(ref_pattern, ref_replacer, sql)

        # Replace {{ source('source_name', 'table_name') }}
        source_pattern = r"\{\{\s*source\(['\"]([^'\"]+)['\"],\s*['\"]([^'\"]+)['\"]\)\s*\}\}"

        def source_replacer(match):
            source_name, table_name = match.group(1), match.group(2)
            key = (source_name, table_name)
            if key in self._sources:
                schema, table, database = self._sources[key]
                return self.adapter.quote_table(table, schema, database)
            else:
                raise ValueError(f"Unknown source: {source_name}.{table_name}")

        sql = re.sub(source_pattern, source_replacer, sql)

        return sql

    @classmethod
    def from_metadata(
        cls,
        adapter: RecceAdapter,
        nodes: List["NodeMetadata"],
    ) -> "TemplateRenderer":
        """
        Create renderer from extracted metadata.

        Args:
            adapter: SQL adapter
            nodes: List of NodeMetadata from metadata_extractor

        Returns:
            Configured TemplateRenderer
        """
        renderer = cls(adapter)

        for node in nodes:
            if node.resource_type in ("model", "seed", "snapshot"):
                renderer.add_ref(
                    model_name=node.name,
                    schema=node.schema_name,
                    table=node.name,
                )
            elif node.resource_type == "source":
                renderer.add_source(
                    source_name=node.source_name or node.package_name,
                    table_name=node.name,
                    schema=node.schema_name,
                    physical_table=node.name,
                )

        return renderer


# --- CLI for testing ---

if __name__ == "__main__":
    import sys

    print("=" * 60)
    print("Recce SQL Adapter Test")
    print("=" * 60)

    # Test 1: DuckDB connection
    print("\n[1] Testing DuckDB connection...")
    try:
        adapter = RecceAdapter.connect_duckdb(":memory:")
        if adapter.test_connection():
            print("    ✓ DuckDB connection successful")

            # Create test data
            adapter.execute("""
                CREATE TABLE test_customers (
                    id INTEGER,
                    name VARCHAR,
                    email VARCHAR
                )
            """)
            adapter.execute("""
                INSERT INTO test_customers VALUES
                (1, 'Alice', 'alice@example.com'),
                (2, 'Bob', 'bob@example.com'),
                (3, 'Charlie', 'charlie@example.com')
            """)

            # Query
            result = adapter.execute("SELECT * FROM test_customers ORDER BY id")
            print(f"    ✓ Query returned {result.row_count} rows")
            print(f"    Columns: {result.columns}")

            # Get columns
            columns = adapter.get_columns("test_customers")
            print(f"    ✓ Table has {len(columns)} columns: {[c['name'] for c in columns]}")

        adapter.close()
    except ImportError as e:
        print(f"    ⚠ Skipped: {e}")
    except Exception as e:
        print(f"    ✗ Failed: {e}")

    # Test 2: Quoting
    print("\n[2] Testing dialect-specific quoting...")
    for dialect_name, dialect in DIALECTS.items():
        quoted = dialect.quote_table("my_table", "my_schema", "my_database")
        print(f"    {dialect_name:12}: {quoted}")

    # Test 3: Template rendering
    print("\n[3] Testing template rendering...")
    try:
        adapter = RecceAdapter.connect_duckdb(":memory:")
        renderer = TemplateRenderer(adapter)

        renderer.add_ref("customers", "prod")
        renderer.add_ref("orders", "prod")
        renderer.add_source("raw", "payments", "raw_data")

        template = """
        SELECT c.*, o.order_id, p.amount
        FROM {{ ref('customers') }} c
        JOIN {{ ref('orders') }} o ON c.id = o.customer_id
        JOIN {{ source('raw', 'payments') }} p ON o.id = p.order_id
        """

        rendered = renderer.render(template)
        print(f"    Template: ...ref('customers')...ref('orders')...source('raw', 'payments')...")
        print(f"    Rendered: {rendered.strip()[:80]}...")
        print("    ✓ Template rendering successful")

        adapter.close()
    except ImportError as e:
        print(f"    ⚠ Skipped: {e}")
    except Exception as e:
        print(f"    ✗ Failed: {e}")

    # Test 4: From dbt profiles.yml (if exists)
    print("\n[4] Testing dbt profiles.yml loading...")
    profiles_path = Path("~/.dbt/profiles.yml").expanduser()
    if profiles_path.exists():
        try:
            import yaml
            with open(profiles_path) as f:
                profiles = yaml.safe_load(f)
            print(f"    Found profiles: {list(profiles.keys())}")

            # Try to find a duckdb profile
            for profile_name, profile in profiles.items():
                for target_name, target in profile.get("outputs", {}).items():
                    if target.get("type") == "duckdb":
                        print(f"    Found DuckDB target: {profile_name}.{target_name}")
                        try:
                            adapter = RecceAdapter.from_dbt_profile(
                                profiles_path, profile_name, target_name
                            )
                            if adapter.test_connection():
                                print(f"    ✓ Connected to {profile_name}.{target_name}")
                            adapter.close()
                        except Exception as e:
                            print(f"    ✗ Connection failed: {e}")
                        break
        except Exception as e:
            print(f"    ✗ Failed to parse profiles.yml: {e}")
    else:
        print(f"    ⚠ No profiles.yml found at {profiles_path}")

    print("\n" + "=" * 60)
    print("Tests completed")
    print("=" * 60)
