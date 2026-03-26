"""Tests for export_utils streaming helpers."""

from recce.apis.export_utils import (
    SUPPORTED_EXPORT_TYPES,
    SUPPORTED_FORMATS,
    generate_export_filename,
    generate_xlsx_bytes,
    stream_csv_rows,
    stream_tsv_rows,
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
