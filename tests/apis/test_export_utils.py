"""Tests for export_utils streaming helpers."""

from recce.apis.export_utils import (
    EXPORT_MAX_ROWS,
    MAX_CONCURRENT_EXPORTS,
    SUPPORTED_EXPORT_TYPES,
    SUPPORTED_FORMATS,
    XLSX_MAX_ROWS,
    generate_export_filename,
    generate_xlsx_bytes,
    stream_csv_rows,
    stream_tsv_rows,
    wrap_sql_with_export_limit,
)


def test_generate_export_filename_csv():
    filename = generate_export_filename("query", "csv")
    assert filename.startswith("query-export-")
    assert filename.endswith(".csv")


def test_generate_export_filename_query_diff():
    filename = generate_export_filename("query_diff", "tsv")
    assert "query-diff" in filename
    assert filename.endswith(".tsv")


def test_stream_csv_rows_basic():
    columns = ["id", "name"]
    rows = iter([(1, "Alice"), (2, "Bob")])
    chunks = list(stream_csv_rows(columns, rows))
    full = "".join(chunks)
    assert "id,name" in full
    assert "1,Alice" in full
    assert "2,Bob" in full


def test_stream_tsv_rows_basic():
    columns = ["id", "name"]
    rows = iter([(1, "Alice"), (2, "Bob")])
    chunks = list(stream_tsv_rows(columns, rows))
    full = "".join(chunks)
    assert "id\tname" in full
    assert "1\tAlice" in full


def test_stream_csv_rows_empty():
    columns = ["id"]
    rows = iter([])
    chunks = list(stream_csv_rows(columns, rows))
    full = "".join(chunks)
    assert "id" in full


def test_generate_xlsx_bytes():
    columns = ["id", "name"]
    rows = iter([(1, "Alice"), (2, "Bob")])
    data = generate_xlsx_bytes(columns, rows)
    assert len(data) > 0
    # XLSX files start with PK zip header
    assert data[:2] == b"PK"


def test_generate_xlsx_bytes_overflow():
    """XLSX generation should raise ValueError when row count exceeds max_rows."""
    import pytest

    columns = ["id"]
    rows = iter([(i,) for i in range(10)])
    with pytest.raises(ValueError, match="exceeds maximum XLSX row limit"):
        generate_xlsx_bytes(columns, rows, max_rows=5)


def test_supported_types_and_formats():
    assert "query" in SUPPORTED_EXPORT_TYPES
    assert "query_base" in SUPPORTED_EXPORT_TYPES
    assert "query_diff" in SUPPORTED_EXPORT_TYPES
    assert "csv" in SUPPORTED_FORMATS
    assert "tsv" in SUPPORTED_FORMATS
    assert "xlsx" in SUPPORTED_FORMATS


# --- Mitigation #1: Lowered export limits ---


def test_export_max_rows_is_bounded():
    """EXPORT_MAX_ROWS should be <=500k to prevent server OOM."""
    assert EXPORT_MAX_ROWS <= 500_000


def test_xlsx_max_rows_is_bounded():
    """XLSX_MAX_ROWS should be <=100k for reasonable memory usage."""
    assert XLSX_MAX_ROWS <= 100_000


def test_xlsx_max_rows_less_than_export_max():
    """XLSX limit must be <= CSV/TSV limit."""
    assert XLSX_MAX_ROWS <= EXPORT_MAX_ROWS


# --- Mitigation #2: Concurrent export limit ---


def test_max_concurrent_exports_is_reasonable():
    """Concurrent export limit should be small to prevent resource exhaustion."""
    assert 1 <= MAX_CONCURRENT_EXPORTS <= 5


# --- Mitigation #4: SQL-level LIMIT ---


def test_wrap_sql_with_export_limit_basic():
    """wrap_sql_with_export_limit wraps SQL in a subquery with LIMIT."""
    result = wrap_sql_with_export_limit("SELECT * FROM users", 500_000)
    assert "LIMIT 500000" in result
    assert "SELECT * FROM users" in result
    assert "_export_limited" in result


def test_wrap_sql_with_export_limit_preserves_original_sql():
    """The original SQL should appear intact inside the subquery."""
    original = "SELECT id, name FROM orders WHERE status = 'active'"
    result = wrap_sql_with_export_limit(original, 100)
    assert original in result
    assert "LIMIT 100" in result


def test_wrap_sql_with_export_limit_nested_query():
    """Should work with SQL that already contains subqueries."""
    nested = "SELECT * FROM (SELECT id FROM foo) AS sub WHERE id > 0"
    result = wrap_sql_with_export_limit(nested, 1000)
    assert nested in result
    assert "LIMIT 1000" in result
    # The outer wrapper should be the LIMIT
    assert result.endswith("LIMIT 1000")


def test_wrap_sql_with_export_limit_uses_export_max_rows():
    """Default usage should use EXPORT_MAX_ROWS constant."""
    result = wrap_sql_with_export_limit("SELECT 1", EXPORT_MAX_ROWS)
    assert f"LIMIT {EXPORT_MAX_ROWS}" in result
