"""Streaming export utilities for CSV/TSV/Excel file generation."""

import csv
import io
import typing as t
from datetime import date

EXPORT_MAX_ROWS = 10_000_000
XLSX_MAX_ROWS = 1_000_000

SUPPORTED_EXPORT_TYPES = {"query", "query_base", "query_diff"}
SUPPORTED_FORMATS = {"csv", "tsv", "xlsx"}


def generate_export_filename(run_type: str, fmt: str) -> str:
    """Generate a filename for the export file."""
    today = date.today().isoformat()
    type_slug = run_type.replace("_", "-")
    return f"{type_slug}-export-{today}.{fmt}"


def stream_csv_rows(
    columns: t.List[str],
    row_iterator: t.Iterator[tuple],
) -> t.Iterator[str]:
    """Yield CSV-formatted strings in chunks."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(columns)
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    chunk_size = 1000
    chunk = []
    for row in row_iterator:
        chunk.append(row)
        if len(chunk) >= chunk_size:
            for r in chunk:
                writer.writerow(r)
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
            chunk = []

    if chunk:
        for r in chunk:
            writer.writerow(r)
        yield output.getvalue()


def stream_tsv_rows(
    columns: t.List[str],
    row_iterator: t.Iterator[tuple],
) -> t.Iterator[str]:
    """Yield TSV-formatted strings in chunks."""
    output = io.StringIO()
    writer = csv.writer(output, delimiter="\t")

    writer.writerow(columns)
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    chunk_size = 1000
    chunk = []
    for row in row_iterator:
        chunk.append(row)
        if len(chunk) >= chunk_size:
            for r in chunk:
                writer.writerow(r)
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
            chunk = []

    if chunk:
        for r in chunk:
            writer.writerow(r)
        yield output.getvalue()


def generate_xlsx_bytes(
    columns: t.List[str],
    row_iterator: t.Iterator[tuple],
    max_rows: int = XLSX_MAX_ROWS,
) -> bytes:
    """Generate XLSX bytes using openpyxl write_only mode."""
    from openpyxl import Workbook

    wb = Workbook(write_only=True)
    ws = wb.create_sheet()

    ws.append(columns)
    count = 0
    for row in row_iterator:
        if count >= max_rows:
            raise ValueError(f"Export exceeds maximum XLSX row limit of {max_rows:,} rows")
        ws.append(list(row))
        count += 1

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
