"""
Experiment 3: Unified SQL Layer (sqlglot + SQLAlchemy)

Replace dbt adapters with a unified SQL adapter using:
- sqlglot for dialect-aware SQL generation and quoting
- SQLAlchemy for universal database connections
"""

from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import re


@dataclass
class QueryResult:
    """Result of a SQL query execution."""

    columns: List[str]
    rows: List[Tuple[Any, ...]]
    row_count: int

    def to_dicts(self) -> List[Dict[str, Any]]:
        """Convert to list of dictionaries."""
        return [dict(zip(self.columns, row)) for row in self.rows]


class UnifiedSqlAdapter:
    """
    Unified SQL adapter using sqlglot for dialect handling
    and SQLAlchemy for connection management.

    Supports: snowflake, bigquery, postgres, redshift, duckdb, databricks
    """

    DIALECT_MAP = {
        "snowflake": "snowflake",
        "bigquery": "bigquery",
        "postgres": "postgres",
        "redshift": "redshift",
        "duckdb": "duckdb",
        "databricks": "databricks",
        "spark": "spark",
    }

    def __init__(self, connection_string: str, dialect: str):
        """
        Initialize adapter with connection string and dialect.

        Args:
            connection_string: SQLAlchemy connection string
            dialect: Database dialect name (snowflake, bigquery, etc.)
        """
        self._connection_string = connection_string
        self.dialect = self.DIALECT_MAP.get(dialect, dialect)
        self._engine = None

    @property
    def engine(self):
        """Lazy initialization of SQLAlchemy engine."""
        if self._engine is None:
            from sqlalchemy import create_engine

            self._engine = create_engine(self._connection_string)
        return self._engine

    def quote_identifier(self, name: str) -> str:
        """
        Quote an identifier for the current dialect.

        Examples:
            snowflake: "my_column" -> "MY_COLUMN" (uppercase)
            bigquery: "my_column" -> `my_column`
            postgres: "my_column" -> "my_column"
        """
        try:
            import sqlglot

            return sqlglot.exp.to_identifier(name, quoted=True).sql(dialect=self.dialect)
        except ImportError:
            # Fallback without sqlglot
            return self._fallback_quote_identifier(name)

    def quote_table(self, schema: str, table: str, database: Optional[str] = None) -> str:
        """
        Quote a table reference for the current dialect.

        Examples:
            snowflake: "prod", "customers" -> "PROD"."CUSTOMERS"
            bigquery: "dataset", "customers" -> `dataset`.`customers`
            postgres: "public", "customers" -> "public"."customers"
        """
        try:
            import sqlglot

            if database:
                full_name = f"{database}.{schema}.{table}"
            else:
                full_name = f"{schema}.{table}"
            return sqlglot.exp.to_table(full_name).sql(dialect=self.dialect)
        except ImportError:
            return self._fallback_quote_table(schema, table, database)

    def execute(self, sql: str, params: Optional[Dict] = None) -> QueryResult:
        """
        Execute SQL and return results.

        Args:
            sql: SQL query to execute
            params: Optional query parameters

        Returns:
            QueryResult with columns, rows, and row_count
        """
        from sqlalchemy import text

        with self.engine.connect() as conn:
            result = conn.execute(text(sql), params or {})

            if result.returns_rows:
                columns = list(result.keys())
                rows = [tuple(row) for row in result.fetchall()]
                return QueryResult(columns=columns, rows=rows, row_count=len(rows))
            else:
                return QueryResult(columns=[], rows=[], row_count=result.rowcount)

    def test_connection(self) -> bool:
        """Test if the connection is working."""
        try:
            result = self.execute("SELECT 1")
            return len(result.rows) == 1
        except Exception as e:
            print(f"Connection test failed: {e}")
            return False

    # --- Factory methods ---

    @classmethod
    def from_dbt_profile(
        cls, profiles_path: str, profile_name: str, target_name: str
    ) -> "UnifiedSqlAdapter":
        """
        Create adapter from dbt profiles.yml.

        Args:
            profiles_path: Path to profiles.yml
            profile_name: Name of the profile
            target_name: Name of the target

        Returns:
            Configured UnifiedSqlAdapter
        """
        import yaml

        profiles_path = Path(profiles_path).expanduser()
        with open(profiles_path) as f:
            profiles = yaml.safe_load(f)

        config = profiles[profile_name]["outputs"][target_name]
        dialect = config["type"]

        connection_string = cls._build_connection_string(config)
        return cls(connection_string, dialect)

    @staticmethod
    def _build_connection_string(config: Dict[str, Any]) -> str:
        """Convert dbt profile config to SQLAlchemy connection string."""
        dialect = config["type"]

        if dialect == "snowflake":
            # snowflake://user:password@account/database/schema?warehouse=wh
            return (
                f"snowflake://{config['user']}:{config.get('password', '')}"
                f"@{config['account']}/{config['database']}/{config['schema']}"
                f"?warehouse={config['warehouse']}"
            )

        elif dialect == "postgres":
            # postgresql://user:password@host:port/dbname
            return (
                f"postgresql://{config['user']}:{config.get('password', '')}"
                f"@{config['host']}:{config.get('port', 5432)}/{config['dbname']}"
            )

        elif dialect == "bigquery":
            # bigquery://project/dataset
            project = config.get("project") or config.get("database")
            dataset = config.get("dataset") or config.get("schema", "")
            return f"bigquery://{project}/{dataset}"

        elif dialect == "duckdb":
            # duckdb:///path/to/db.duckdb or duckdb:///:memory:
            path = config.get("path", ":memory:")
            return f"duckdb:///{path}"

        elif dialect == "redshift":
            # redshift+psycopg2://user:password@host:port/dbname
            return (
                f"redshift+psycopg2://{config['user']}:{config.get('password', '')}"
                f"@{config['host']}:{config.get('port', 5439)}/{config['dbname']}"
            )

        elif dialect == "databricks":
            # databricks://token:xxx@host:443/catalog
            return (
                f"databricks://token:{config['token']}"
                f"@{config['host']}:443"
                f"/{config.get('catalog', 'hive_metastore')}"
            )

        else:
            raise ValueError(f"Unsupported dialect: {dialect}")

    # --- Fallback methods (when sqlglot not available) ---

    def _fallback_quote_identifier(self, name: str) -> str:
        """Quote identifier without sqlglot."""
        if self.dialect == "bigquery":
            return f"`{name}`"
        elif self.dialect == "snowflake":
            return f'"{name.upper()}"'
        else:
            return f'"{name}"'

    def _fallback_quote_table(
        self, schema: str, table: str, database: Optional[str] = None
    ) -> str:
        """Quote table without sqlglot."""
        q = self._fallback_quote_identifier

        if database:
            return f"{q(database)}.{q(schema)}.{q(table)}"
        return f"{q(schema)}.{q(table)}"


class SimpleTemplateRenderer:
    """
    Simple template renderer for ref() and source().

    Does NOT support full Jinja - only what Recce needs:
    - {{ ref('model_name') }}
    - {{ source('source_name', 'table_name') }}
    """

    REF_PATTERN = re.compile(r"\{\{\s*ref\(['\"](\w+)['\"]\)\s*\}\}")
    SOURCE_PATTERN = re.compile(r"\{\{\s*source\(['\"](\w+)['\"],\s*['\"](\w+)['\"]\)\s*\}\}")

    def __init__(self, adapter: UnifiedSqlAdapter, node_lookup: Dict[str, Tuple[str, str]]):
        """
        Initialize renderer.

        Args:
            adapter: SQL adapter for quoting
            node_lookup: Dict mapping model_name -> (schema, table)
        """
        self.adapter = adapter
        self.ref_lookup = node_lookup
        self.source_lookup: Dict[Tuple[str, str], Tuple[str, str]] = {}

    def add_source(self, source_name: str, table_name: str, schema: str, physical_table: str):
        """Add a source to the lookup."""
        self.source_lookup[(source_name, table_name)] = (schema, physical_table)

    def render(self, sql_template: str) -> str:
        """
        Render SQL template, replacing ref() and source().

        Args:
            sql_template: SQL with {{ ref() }} and {{ source() }} calls

        Returns:
            Rendered SQL with proper table references
        """
        sql = sql_template

        # Replace ref()
        def ref_replacer(match):
            model_name = match.group(1)
            if model_name in self.ref_lookup:
                schema, table = self.ref_lookup[model_name]
                return self.adapter.quote_table(schema, table)
            # Return original if not found (might be macro issue)
            return match.group(0)

        sql = self.REF_PATTERN.sub(ref_replacer, sql)

        # Replace source()
        def source_replacer(match):
            source_name, table_name = match.group(1), match.group(2)
            key = (source_name, table_name)
            if key in self.source_lookup:
                schema, table = self.source_lookup[key]
                return self.adapter.quote_table(schema, table)
            return match.group(0)

        sql = self.SOURCE_PATTERN.sub(source_replacer, sql)

        return sql


# --- CLI for testing ---

if __name__ == "__main__":
    import sys

    print("=== Unified SQL Adapter Test ===\n")

    # Test 1: DuckDB (in-memory, no credentials needed)
    print("1. Testing DuckDB connection...")
    try:
        adapter = UnifiedSqlAdapter("duckdb:///:memory:", "duckdb")
        if adapter.test_connection():
            print("   ✓ DuckDB connection successful")

            # Create test table and query
            adapter.execute("CREATE TABLE test (id INT, name VARCHAR)")
            adapter.execute("INSERT INTO test VALUES (1, 'Alice'), (2, 'Bob')")
            result = adapter.execute("SELECT * FROM test ORDER BY id")

            print(f"   ✓ Query returned {result.row_count} rows")
            print(f"   Columns: {result.columns}")
            print(f"   Rows: {result.rows}")
        else:
            print("   ✗ DuckDB connection failed")
    except Exception as e:
        print(f"   ✗ DuckDB test failed: {e}")

    # Test 2: Quoting
    print("\n2. Testing dialect-specific quoting...")
    for dialect in ["snowflake", "bigquery", "postgres", "duckdb"]:
        adapter = UnifiedSqlAdapter("duckdb:///:memory:", dialect)
        quoted = adapter.quote_table("my_schema", "my_table")
        print(f"   {dialect:12}: {quoted}")

    # Test 3: Template rendering
    print("\n3. Testing template rendering...")
    adapter = UnifiedSqlAdapter("duckdb:///:memory:", "snowflake")
    renderer = SimpleTemplateRenderer(
        adapter,
        node_lookup={
            "customers": ("prod", "customers"),
            "orders": ("prod", "orders"),
        },
    )
    renderer.add_source("raw", "payments", "raw_data", "payments")

    template = """
    SELECT *
    FROM {{ ref('customers') }} c
    JOIN {{ ref('orders') }} o ON c.id = o.customer_id
    JOIN {{ source('raw', 'payments') }} p ON o.id = p.order_id
    """

    rendered = renderer.render(template)
    print(f"   Template:\n{template}")
    print(f"   Rendered:\n{rendered}")
