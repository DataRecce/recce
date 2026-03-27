# Export Row Limit Handling Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable full-result exports (CSV/TSV/Excel) from query runs, bypassing the 2,000-row preview limit, with row count display and large export warnings.

**Architecture:** New `total_row_count` field on DataFrame (populated via COUNT(*) at query time) flows to frontend where download buttons show human-readable counts. File downloads hit a new streaming GET endpoint that re-executes the query without the row limit. A confirmation dialog gates exports over 100k rows.

**Tech Stack:** Python (FastAPI, Pydantic, openpyxl), TypeScript (React, MUI, Vitest)

**Spec:** `docs/superpowers/specs/2026-03-26-export-row-limit-handling-design.md`

---

## Chunk 1: Backend — DataFrame model + COUNT(*) in query tasks

### Task 1: Add `total_row_count` to DataFrame model

**Files:**
- Modify: `recce/tasks/dataframe.py:51-55`
- Test: `tests/tasks/test_dataframe_total_row_count.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# tests/tasks/test_dataframe_total_row_count.py
from recce.tasks.dataframe import DataFrame, DataFrameColumn, DataFrameColumnType


def test_dataframe_total_row_count_default_none():
    """total_row_count defaults to None when not provided."""
    df = DataFrame(
        columns=[DataFrameColumn(name="id", type=DataFrameColumnType.INTEGER)],
        data=[(1,), (2,)],
    )
    assert df.total_row_count is None


def test_dataframe_total_row_count_set():
    """total_row_count can be set explicitly."""
    df = DataFrame(
        columns=[DataFrameColumn(name="id", type=DataFrameColumnType.INTEGER)],
        data=[(1,), (2,)],
        total_row_count=50000,
    )
    assert df.total_row_count == 50000


def test_dataframe_total_row_count_serialization():
    """total_row_count appears in JSON serialization."""
    df = DataFrame(
        columns=[DataFrameColumn(name="id", type=DataFrameColumnType.INTEGER)],
        data=[(1,), (2,)],
        total_row_count=12345,
    )
    d = df.model_dump()
    assert d["total_row_count"] == 12345


def test_dataframe_total_row_count_none_excluded_from_json():
    """total_row_count None is excluded when using exclude_none."""
    df = DataFrame(
        columns=[DataFrameColumn(name="id", type=DataFrameColumnType.INTEGER)],
        data=[(1,), (2,)],
    )
    d = df.model_dump(exclude_none=True)
    assert "total_row_count" not in d
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/tasks/test_dataframe_total_row_count.py -v`
Expected: FAIL — `total_row_count` field does not exist

- [ ] **Step 3: Add `total_row_count` field to DataFrame**

In `recce/tasks/dataframe.py`, add after line 55 (`more` field):

```python
    total_row_count: t.Optional[int] = Field(None, description="Total row count from the full query (before limit)")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/tasks/test_dataframe_total_row_count.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add recce/tasks/dataframe.py tests/tasks/test_dataframe_total_row_count.py
git commit -s -m "feat(dataframe): add total_row_count field to DataFrame model"
```

---

### Task 2: Add `execute_row_count` to QueryMixin

**Files:**
- Modify: `recce/tasks/query.py:20-56` (QueryMixin class)
- Test: `tests/tasks/test_query.py` (add tests)

- [ ] **Step 1: Write the failing test**

Add to `tests/tasks/test_query.py`:

```python
def test_query_execute_row_count(dbt_test_helper):
    """execute_row_count returns the total number of rows for a query."""
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """
    dbt_test_helper.create_model("customers", csv_data, csv_data)
    from recce.tasks.query import QueryMixin
    count = QueryMixin.execute_row_count('select * from {{ ref("customers") }}', base=False)
    assert count == 3


def test_query_execute_row_count_with_filter(dbt_test_helper):
    """execute_row_count respects WHERE clauses in the SQL."""
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """
    dbt_test_helper.create_model("customers", csv_data, csv_data)
    from recce.tasks.query import QueryMixin
    count = QueryMixin.execute_row_count(
        'select * from {{ ref("customers") }} where age > 25', base=False
    )
    assert count == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/tasks/test_query.py::test_query_execute_row_count tests/tasks/test_query.py::test_query_execute_row_count_with_filter -v`
Expected: FAIL — `execute_row_count` does not exist

- [ ] **Step 3: Implement `execute_row_count`**

In `recce/tasks/query.py`, add method to `QueryMixin` after `execute_sql` (after line 56):

```python
    @classmethod
    def execute_row_count(cls, sql_template, base: bool = False) -> Optional[int]:
        """Execute SELECT COUNT(*) FROM (<sql>) to get total row count.

        Wraps the user's SQL as a subquery and counts rows. Returns None if
        the count query fails (non-blocking — callers should treat None as unknown).
        """
        from jinja2.exceptions import TemplateSyntaxError

        dbt_adapter = default_context().adapter

        try:
            sql = dbt_adapter.generate_sql(sql_template, base)
            count_sql = f"SELECT COUNT(*) AS _total_row_count FROM ({sql}) AS _count_subquery"
            _, result = dbt_adapter.execute(count_sql, fetch=True, auto_begin=True)
            if result.rows:
                return int(result.rows[0][0])
            return None
        except Exception:
            return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/tasks/test_query.py::test_query_execute_row_count tests/tasks/test_query.py::test_query_execute_row_count_with_filter -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add recce/tasks/query.py tests/tasks/test_query.py
git commit -s -m "feat(query): add execute_row_count method to QueryMixin"
```

---

### Task 3: Integrate `total_row_count` into QueryTask

**Files:**
- Modify: `recce/tasks/query.py:80-119` (QueryTask class)
- Test: `tests/tasks/test_query.py` (add test)

- [ ] **Step 1: Write the failing test**

Add to `tests/tasks/test_query.py`:

```python
def test_query_result_has_total_row_count(dbt_test_helper):
    """QueryTask result includes total_row_count."""
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """
    dbt_test_helper.create_model("customers", csv_data, csv_data)
    params = {"sql_template": 'select * from {{ ref("customers") }}'}
    task = QueryTask(params)
    run_result = task.execute()
    assert run_result.total_row_count == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/tasks/test_query.py::test_query_result_has_total_row_count -v`
Expected: FAIL — `total_row_count` is None

- [ ] **Step 3: Integrate count into `execute_dbt`**

In `recce/tasks/query.py`, modify `QueryTask.execute_dbt()`:

```python
    def execute_dbt(self):
        from recce.adapter.dbt_adapter import DbtAdapter

        dbt_adapter: DbtAdapter = default_context().adapter

        limit = QUERY_LIMIT
        with dbt_adapter.connection_named("query"):
            self.connection = dbt_adapter.get_thread_connection()

            sql_template = self.params.sql_template
            table, more = self.execute_sql_with_limit(sql_template, base=self.is_base, limit=limit)
            self.check_cancel()

            total_row_count = self.execute_row_count(sql_template, base=self.is_base)

            df = DataFrame.from_agate(table, limit=limit, more=more)
            df.total_row_count = total_row_count
            return df
```

Also modify `QueryTask.execute_sqlmesh()`:

```python
    def execute_sqlmesh(self):
        from ..adapter.sqlmesh_adapter import SqlmeshAdapter

        sqlmesh_adapter: SqlmeshAdapter = default_context().adapter

        sql = self.params.get("sql_template")
        limit = QUERY_LIMIT
        df, more = sqlmesh_adapter.fetchdf_with_limit(sql, base=self.is_base, limit=limit)
        result = DataFrame.from_pandas(df, limit=limit, more=more)
        # Note: SQLMesh total_row_count deferred — would need fetchdf_count method
        return result
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/tasks/test_query.py::test_query_result_has_total_row_count -v`
Expected: PASS

- [ ] **Step 5: Run all existing query tests to check for regressions**

Run: `python -m pytest tests/tasks/test_query.py -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add recce/tasks/query.py tests/tasks/test_query.py
git commit -s -m "feat(query): populate total_row_count in QueryTask results"
```

---

### Task 4: Integrate `total_row_count` into QueryDiffTask

**Files:**
- Modify: `recce/tasks/query.py:137-178` (QueryDiffTask._query_diff)
- Test: `tests/tasks/test_query.py` (add test)

- [ ] **Step 1: Write the failing test**

Add to `tests/tasks/test_query.py`:

```python
def test_query_diff_result_has_total_row_count(dbt_test_helper):
    """QueryDiffTask result DataFrames include total_row_count."""
    csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """
    csv_data_base = """
        customer_id,name,age
        1,Alice,35
        2,Bob,25
        """
    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("customers") }}'}
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert run_result.base.total_row_count == 2
    assert run_result.current.total_row_count == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/tasks/test_query.py::test_query_diff_result_has_total_row_count -v`
Expected: FAIL — `total_row_count` is None

- [ ] **Step 3: Integrate count into `_query_diff`**

In `recce/tasks/query.py`, modify `QueryDiffTask._query_diff()`:

```python
    def _query_diff(
        self,
        dbt_adapter,
        sql_template: str,
        base_sql_template: Optional[str] = None,
        preview_change: bool = False,
    ):
        limit = QUERY_LIMIT

        self.connection = dbt_adapter.get_thread_connection()
        if preview_change:
            base, base_more = self.execute_sql_with_limit(base_sql_template, base=False, limit=limit)
        else:
            base, base_more = self.execute_sql_with_limit(base_sql_template or sql_template, base=True, limit=limit)
        self.check_cancel()

        current, current_more = self.execute_sql_with_limit(sql_template, base=False, limit=limit)
        self.check_cancel()

        # Get total row counts
        if preview_change:
            base_total = self.execute_row_count(base_sql_template, base=False)
        else:
            base_total = self.execute_row_count(base_sql_template or sql_template, base=True)
        current_total = self.execute_row_count(sql_template, base=False)

        base_df = DataFrame.from_agate(base, limit=limit, more=base_more)
        base_df.total_row_count = base_total
        current_df = DataFrame.from_agate(current, limit=limit, more=current_more)
        current_df.total_row_count = current_total

        if self.params.primary_keys:
            column_keys = [col.key for col in current_df.columns]
            self.params.primary_keys = normalize_keys_to_columns(self.params.primary_keys, column_keys)

        return QueryDiffResult(
            base=base_df,
            current=current_df,
        )
```

Also modify `_sqlmesh_query_diff` similarly (add comment noting SQLMesh count deferred).

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/tasks/test_query.py::test_query_diff_result_has_total_row_count -v`
Expected: PASS

- [ ] **Step 5: Run all query tests for regressions**

Run: `python -m pytest tests/tasks/test_query.py -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add recce/tasks/query.py tests/tasks/test_query.py
git commit -s -m "feat(query): populate total_row_count in QueryDiffTask results"
```

---

### Task 5: Add streaming export endpoint

**Files:**
- Modify: `recce/apis/run_api.py` (add endpoint)
- Create: `recce/apis/export_utils.py` (streaming helpers)
- Test: `tests/apis/test_export_endpoint.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# tests/apis/test_export_endpoint.py
import csv
import io
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from recce.models import Run
from recce.models.types import RunType
from recce.tasks.dataframe import DataFrame, DataFrameColumn, DataFrameColumnType


@pytest.fixture
def mock_run():
    """Create a mock run with query result (as dict, matching Pydantic serialization)."""
    run = Run(
        run_id=str(uuid4()),
        type=RunType.QUERY,
        params={"sql_template": "select 1 as id, 'Alice' as name"},
        result={
            "columns": [
                {"key": "id", "name": "id", "type": "integer"},
                {"key": "name", "name": "name", "type": "text"},
            ],
            "data": [(1, "Alice"), (2, "Bob"), (3, "Charlie")],
            "total_row_count": 3,
        },
    )
    return run


def test_export_endpoint_csv(mock_run):
    """GET /api/runs/{run_id}/export?format=csv returns CSV file."""
    from recce.server import app

    client = TestClient(app)

    with patch("recce.apis.run_api.RunDAO") as MockDAO:
        dao_instance = MockDAO.return_value
        dao_instance.find_run_by_id.return_value = mock_run

        with patch("recce.tasks.query.QueryMixin") as MockMixin:
            # Mock execute_sql_with_limit to return unlimited data
            mock_table = MagicMock()
            mock_table.column_names = ["id", "name"]
            mock_table.column_types = [MagicMock(), MagicMock()]
            mock_table.rows = [
                MagicMock(values=lambda: (1, "Alice")),
                MagicMock(values=lambda: (2, "Bob")),
                MagicMock(values=lambda: (3, "Charlie")),
            ]
            MockMixin.execute_sql_with_limit.return_value = (mock_table, False)

            response = client.get(
                f"/api/runs/{mock_run.run_id}/export?format=csv"
            )

    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]
    assert ".csv" in response.headers["content-disposition"]


def test_export_endpoint_unsupported_run_type():
    """GET /api/runs/{run_id}/export returns 400 for non-query run types."""
    from recce.server import app

    client = TestClient(app)

    run = Run(
        run_id=str(uuid4()),
        type=RunType.ROW_COUNT_DIFF,
        params={"node_names": ["model_a"]},
    )

    with patch("recce.apis.run_api.RunDAO") as MockDAO:
        dao_instance = MockDAO.return_value
        dao_instance.find_run_by_id.return_value = run

        response = client.get(f"/api/runs/{run.run_id}/export?format=csv")

    assert response.status_code == 400


def test_export_endpoint_run_not_found():
    """GET /api/runs/{run_id}/export returns 404 for missing run."""
    from recce.server import app

    client = TestClient(app)
    fake_id = str(uuid4())

    with patch("recce.apis.run_api.RunDAO") as MockDAO:
        dao_instance = MockDAO.return_value
        dao_instance.find_run_by_id.return_value = None

        response = client.get(f"/api/runs/{fake_id}/export?format=csv")

    assert response.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/apis/test_export_endpoint.py -v`
Expected: FAIL — endpoint does not exist (404 on all)

- [ ] **Step 2.5: Add `openpyxl` dependency**

`openpyxl` is not currently in the project dependencies. Add it to `pyproject.toml` under dependencies:

```bash
# In the [project] dependencies section of pyproject.toml, add:
# "openpyxl>=3.1.0",
# Then install:
make install-dev
```

- [ ] **Step 3: Create `export_utils.py` with streaming helpers**

```python
# recce/apis/export_utils.py
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

    # Header
    writer.writerow(columns)
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    # Data rows in chunks
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

    # Remaining rows
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

    # Header
    writer.writerow(columns)
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    # Data rows in chunks
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
        ws.append(list(row))
        count += 1
        if count >= max_rows:
            break

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
```

- [ ] **Step 4: Add the export endpoint to `run_api.py`**

Add imports at top of `recce/apis/run_api.py`:

```python
from fastapi.responses import StreamingResponse, Response
from recce.apis.export_utils import (
    EXPORT_MAX_ROWS,
    XLSX_MAX_ROWS,
    SUPPORTED_EXPORT_TYPES,
    SUPPORTED_FORMATS,
    generate_export_filename,
    stream_csv_rows,
    stream_tsv_rows,
    generate_xlsx_bytes,
)
```

Add endpoint after the existing `aggregate_runs_handler`:

```python
@run_router.get("/runs/{run_id}/export")
async def export_run_handler(run_id: UUID, format: str = Query("csv", description="Export format: csv, tsv, or xlsx")):
    """Export full query results as a downloadable file.

    Re-executes the stored SQL query without the preview row limit
    and streams the result as CSV, TSV, or XLSX.
    """
    if format not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}. Use: {', '.join(SUPPORTED_FORMATS)}")

    run = RunDAO().find_run_by_id(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.type.value not in SUPPORTED_EXPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Export not supported for run type: {run.type.value}. Supported: {', '.join(SUPPORTED_EXPORT_TYPES)}"
        )

    # Check total_row_count against limits
    total_row_count = _get_total_row_count(run)
    if total_row_count is not None:
        if total_row_count > EXPORT_MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"Export too large ({total_row_count:,} rows). Maximum is {EXPORT_MAX_ROWS:,} rows."
            )
        if format == "xlsx" and total_row_count > XLSX_MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"Excel exports are limited to {XLSX_MAX_ROWS:,} rows. Use CSV or TSV for larger exports."
            )

    filename = generate_export_filename(run.type.value, format)

    try:
        columns, row_iter = _execute_export_query(run)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export query failed: {str(e)}")

    if format == "csv":
        return StreamingResponse(
            stream_csv_rows(columns, row_iter),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    elif format == "tsv":
        return StreamingResponse(
            stream_tsv_rows(columns, row_iter),
            media_type="text/tab-separated-values",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    elif format == "xlsx":
        xlsx_bytes = generate_xlsx_bytes(columns, row_iter)
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


def _get_total_row_count(run) -> t.Optional[int]:
    """Extract total_row_count from run result.

    Note: Run.result is always a dict (Pydantic serialization), never a DataFrame instance.
    """
    result = run.result
    if not isinstance(result, dict):
        return None

    # Single query result (DataFrame dict with total_row_count at top level)
    if "total_row_count" in result and isinstance(result["total_row_count"], (int, float)):
        return int(result["total_row_count"])

    # QueryDiffResult — base/current dicts each may have total_row_count
    base = result.get("base")
    curr = result.get("current")
    base_count = base.get("total_row_count") if isinstance(base, dict) else None
    curr_count = curr.get("total_row_count") if isinstance(curr, dict) else None
    counts = [int(c) for c in [base_count, curr_count] if c is not None]
    return max(counts) if counts else None


def _execute_export_query(run) -> t.Tuple[t.List[str], t.Iterator[tuple]]:
    """Re-execute the run's SQL query without row limit and return columns + row iterator."""
    from recce.core import default_context
    from recce.tasks.query import QueryMixin

    params = run.params if isinstance(run.params, dict) else run.params.dict()
    sql_template = params.get("sql_template")
    run_type = run.type.value if hasattr(run.type, "value") else run.type

    context = default_context()
    dbt_adapter = context.adapter

    if run_type in ("query", "query_base"):
        is_base = run_type == "query_base"
        # execute_sql_with_limit manages its own connection via default_context().adapter
        # Pass limit=None to get all rows (no limit applied)
        table, _ = QueryMixin.execute_sql_with_limit(sql_template, base=is_base)
        columns = list(table.column_names)
        rows = [tuple(row.values()) for row in table.rows]
        return columns, iter(rows)

    elif run_type == "query_diff":
        base_sql = params.get("base_sql_template")
        base_table, _ = QueryMixin.execute_sql_with_limit(base_sql or sql_template, base=True)
        current_table, _ = QueryMixin.execute_sql_with_limit(sql_template, base=False)

            columns = [f"base__{c}" for c in base_table.column_names] + \
                      [f"current__{c}" for c in current_table.column_names]

            def merged_rows():
                base_rows = [tuple(r.values()) for r in base_table.rows]
                curr_rows = [tuple(r.values()) for r in current_table.rows]
                max_len = max(len(base_rows), len(curr_rows))
                num_cols = len(current_table.column_names)
                empty = tuple([None] * num_cols)
                for i in range(max_len):
                    b = base_rows[i] if i < len(base_rows) else empty
                    c = curr_rows[i] if i < len(curr_rows) else empty
                    yield b + c

            return columns, merged_rows()

    raise ValueError(f"Unsupported export run type: {run_type}")
```

Also add `import typing as t` to the imports if not present.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/apis/test_export_endpoint.py -v`
Expected: Tests pass (some may need mock adjustments — iterate)

- [ ] **Step 6: Run full backend test suite for regressions**

Run: `make test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add recce/apis/export_utils.py recce/apis/run_api.py tests/apis/test_export_endpoint.py
git commit -s -m "feat(api): add streaming export endpoint for query results"
```

---

## Chunk 2: Frontend — Row count formatting, TypeScript types, hook changes

### Task 6: Add `total_row_count` to frontend DataFrame type

**Files:**
- Modify: `js/packages/ui/src/api/types/base.ts:75-86`

- [ ] **Step 1: Add the field**

In `js/packages/ui/src/api/types/base.ts`, add after the `more` field (line 85):

```typescript
  /** Total row count from full query result (before preview limit) */
  total_row_count?: number;
```

- [ ] **Step 2: Run type check**

Run: `cd js && pnpm type:check`
Expected: PASS (additive change, no breakage)

- [ ] **Step 3: Commit**

```bash
git add js/packages/ui/src/api/types/base.ts
git commit -s -m "feat(ui): add total_row_count to DataFrame type"
```

---

### Task 7: Add `formatRowCount` utility

**Files:**
- Modify: `js/packages/ui/src/utils/csv/format.ts` (add function)
- Modify: `js/packages/ui/src/utils/csv/index.ts` (export it)
- Test: `js/packages/ui/src/utils/csv/__tests__/format.test.ts` (add tests)

- [ ] **Step 1: Write the failing tests**

Add to `js/packages/ui/src/utils/csv/__tests__/format.test.ts`:

```typescript
import { formatRowCount } from "../format";

describe("formatRowCount", () => {
  test("should format small numbers with commas", () => {
    expect(formatRowCount(0)).toBe("0 rows");
    expect(formatRowCount(1)).toBe("1 row");
    expect(formatRowCount(42)).toBe("42 rows");
    expect(formatRowCount(999)).toBe("999 rows");
  });

  test("should format thousands with k suffix", () => {
    expect(formatRowCount(1000)).toBe("1k rows");
    expect(formatRowCount(1200)).toBe("1.2k rows");
    expect(formatRowCount(12000)).toBe("12k rows");
    expect(formatRowCount(12500)).toBe("12.5k rows");
    expect(formatRowCount(450000)).toBe("450k rows");
    expect(formatRowCount(999999)).toBe("1M rows");
  });

  test("should format millions with M suffix", () => {
    expect(formatRowCount(1000000)).toBe("1M rows");
    expect(formatRowCount(1200000)).toBe("1.2M rows");
    expect(formatRowCount(3500000)).toBe("3.5M rows");
    expect(formatRowCount(10000000)).toBe("10M rows");
  });

  test("should drop .0 decimal for round numbers", () => {
    expect(formatRowCount(1000)).toBe("1k rows");
    expect(formatRowCount(2000000)).toBe("2M rows");
  });

  test("should handle singular row", () => {
    expect(formatRowCount(1)).toBe("1 row");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd js && pnpm test -- --run packages/ui/src/utils/csv/__tests__/format.test.ts`
Expected: FAIL — `formatRowCount` does not exist

- [ ] **Step 3: Implement `formatRowCount`**

Add to `js/packages/ui/src/utils/csv/format.ts` at the end of the file:

```typescript
/**
 * Format a row count as a human-readable string
 * - < 1,000: exact number ("450 rows")
 * - 1,000–999,999: thousands ("12k rows", "450k rows")
 * - >= 1,000,000: millions ("1.2M rows", "3.5M rows")
 */
export function formatRowCount(n: number): string {
  const label = n === 1 ? "row" : "rows";

  if (n < 1000) {
    return `${n} ${label}`;
  }

  if (n < 1_000_000) {
    const k = n / 1000;
    // Round up to M if k would display as 1000
    if (k >= 999.95) {
      return `1M ${label}`;
    }
    const formatted = k % 1 === 0 ? String(k) : k.toFixed(1);
    return `${formatted}k ${label}`;
  }

  const m = n / 1_000_000;
  const formatted = m % 1 === 0 ? String(m) : m.toFixed(1);
  return `${formatted}M ${label}`;
}
```

- [ ] **Step 4: Export from index**

In `js/packages/ui/src/utils/csv/index.ts`, update the format export:

```typescript
export { formatRowCount, toCSV, toTSV } from "./format";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd js && pnpm test -- --run packages/ui/src/utils/csv/__tests__/format.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add js/packages/ui/src/utils/csv/format.ts js/packages/ui/src/utils/csv/index.ts js/packages/ui/src/utils/csv/__tests__/format.test.ts
git commit -s -m "feat(ui): add formatRowCount utility for human-readable row counts"
```

---

### Task 8: Add `totalRowCount` and `runId` to `useCSVExport` hook

**Files:**
- Modify: `js/packages/ui/src/hooks/useCSVExport.ts`

- [ ] **Step 1: Add `totalRowCount` and `runId` to the hook interface and return value**

In `js/packages/ui/src/hooks/useCSVExport.ts`:

Add `runId` to the options interface:

```typescript
interface UseCSVExportOptions {
  run?: Run;
  runId?: string;
  viewOptions?: Record<string, unknown>;
}
```

Add `totalRowCount` to the result interface:

```typescript
interface UseCSVExportResult {
  canExportCSV: boolean;
  totalRowCount: number | null;
  copyAsCSV: () => Promise<void>;
  copyAsTSV: () => Promise<void>;
  downloadAsCSV: () => void;
  downloadAsTSV: () => void;
  downloadAsExcel: () => void;
}
```

Add the `totalRowCount` derivation inside the hook:

```typescript
const totalRowCount = useMemo(() => {
  if (!run?.result) return null;
  const result = run.result as Record<string, unknown>;

  // Single query (DataFrame with total_row_count)
  if ("total_row_count" in result && typeof result.total_row_count === "number") {
    return result.total_row_count;
  }

  // Query diff (base/current DataFrames)
  const base = result.base as Record<string, unknown> | undefined;
  const current = result.current as Record<string, unknown> | undefined;
  const baseTrc = typeof base?.total_row_count === "number" ? base.total_row_count : null;
  const currTrc = typeof current?.total_row_count === "number" ? current.total_row_count : null;

  if (baseTrc !== null && currTrc !== null) return Math.max(baseTrc, currTrc);
  return baseTrc ?? currTrc;
}, [run?.result]);
```

- [ ] **Step 2: Replace download implementations to use backend endpoint**

Replace the `downloadAsCSV`, `downloadAsTSV`, `downloadAsExcel` callbacks:

```typescript
const triggerBackendDownload = useCallback(
  (format: string) => {
    if (!runId) return;
    // Use hidden anchor to avoid popup blockers (especially after warning dialog)
    const a = document.createElement("a");
    a.href = `/api/runs/${runId}/export?format=${format}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
  [runId],
);

const downloadAsCSV = useCallback(() => {
  // For non-query types, fall back to client-side
  if (!runId || !["query", "query_base", "query_diff"].includes(run?.type ?? "")) {
    // Original client-side logic
    const content = getCSVContent();
    if (!content) {
      toaster.create({ title: "Export failed", description: "Unable to extract data for CSV export", type: "error", duration: 3000 });
      return;
    }
    const filename = generateCSVFilename(run?.type ?? "", run?.params as Record<string, unknown>);
    downloadCSVFile(content, filename);
    toaster.create({ title: "Downloaded", description: filename, type: "success", duration: 3000 });
    return;
  }
  triggerBackendDownload("csv");
}, [runId, run, getCSVContent, triggerBackendDownload]);
```

Apply the same pattern for `downloadAsTSV` and `downloadAsExcel`.

**Note:** Rename the imported `downloadCSV` from browser utils to `downloadCSVFile` (or similar) to avoid name collision with the hook's `downloadAsCSV`. Alternatively, keep the original name and call it explicitly as the module function.

- [ ] **Step 3: Update the return value**

```typescript
return {
  canExportCSV,
  totalRowCount,
  copyAsCSV,
  copyAsTSV,
  downloadAsCSV,
  downloadAsExcel,
  downloadAsTSV,
};
```

- [ ] **Step 4: Update the consumer in `RunResultPaneOss.tsx`**

In `js/packages/ui/src/components/run/RunResultPaneOss.tsx`, pass `runId` to the hook:

```typescript
const csvExport = useCSVExport({
  run,
  runId,
  viewOptions: viewOptions as Record<string, unknown>,
});
```

- [ ] **Step 5: Run type check and tests**

Run: `cd js && pnpm type:check && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/packages/ui/src/hooks/useCSVExport.ts js/packages/ui/src/components/run/RunResultPaneOss.tsx
git commit -s -m "feat(ui): wire download actions to backend export endpoint"
```

---

## Chunk 3: Frontend — Export menu UI changes (row counts, warning dialog)

### Task 9: Add `totalRowCount` to `CSVExportProps` and update menu labels

**Files:**
- Modify: `js/packages/ui/src/components/run/RunResultPane.tsx:70-83` (CSVExportProps)
- Modify: `js/packages/ui/src/components/run/RunResultPane.tsx:329-441` (DefaultExportMenu)
- Modify: `js/packages/ui/src/components/run/RunResultPane.tsx:447-589` (DefaultShareMenu)

- [ ] **Step 1: Add `totalRowCount` to `CSVExportProps`**

In `RunResultPane.tsx`, update the interface:

```typescript
export interface CSVExportProps {
  canExportCSV: boolean;
  totalRowCount?: number | null;
  copyAsCSV: () => Promise<void>;
  copyAsTSV?: () => Promise<void>;
  downloadAsCSV: () => void;
  downloadAsTSV?: () => void;
  downloadAsExcel?: () => void;
}
```

- [ ] **Step 2: Add import for `formatRowCount`**

Add to imports:

```typescript
import { formatRowCount } from "../../utils";
```

Ensure `formatRowCount` is exported from `js/packages/ui/src/utils/index.ts`. Check the barrel export chain: `utils/index.ts` re-exports from `utils/csv/index.ts` which now exports `formatRowCount`.

- [ ] **Step 3: Create a helper for download label text**

Add a helper function inside the file (before `DefaultExportMenu`):

```typescript
function downloadLabel(base: string, totalRowCount?: number | null): string {
  if (totalRowCount != null && totalRowCount > 0) {
    return `${base} (${formatRowCount(totalRowCount)})`;
  }
  return base;
}
```

- [ ] **Step 4: Update `DefaultExportMenu` download menu items**

Replace the `ListItemText` for each download action:

```tsx
{/* Download as CSV */}
<ListItemText>
  {downloadLabel("Download as CSV", csvExport?.totalRowCount)}
</ListItemText>

{/* Download as TSV */}
<ListItemText>
  {downloadLabel("Download as TSV", csvExport?.totalRowCount)}
</ListItemText>

{/* Download as Excel */}
<ListItemText>
  {downloadLabel("Download as Excel", csvExport?.totalRowCount)}
</ListItemText>
```

Copy actions ("Copy as Image", "Copy as Text", "Copy as CSV") remain unchanged — no row count.

- [ ] **Step 5: Update `DefaultShareMenu` download menu items identically**

Same changes as Step 4, applied to the `DefaultShareMenu` component.

- [ ] **Step 6: Run type check and lint**

Run: `cd js && pnpm type:check && pnpm lint:fix`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add js/packages/ui/src/components/run/RunResultPane.tsx
git commit -s -m "feat(ui): show row counts on download menu items"
```

---

### Task 10: Add large export warning dialog

**Files:**
- Modify: `js/packages/ui/src/components/run/RunResultPane.tsx` (both menu components)

- [ ] **Step 1: Add MUI Dialog imports**

Add to imports in `RunResultPane.tsx`:

```typescript
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
```

- [ ] **Step 2: Create `LargeExportWarningDialog` component**

Add before `DefaultExportMenu`:

```tsx
const LARGE_EXPORT_THRESHOLD = 100_000;

interface LargeExportWarningDialogProps {
  open: boolean;
  rowCount: number;
  onContinue: () => void;
  onCancel: () => void;
}

const LargeExportWarningDialog = memo(
  ({ open, rowCount, onContinue, onCancel }: LargeExportWarningDialogProps) => (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>Large Export Warning</DialogTitle>
      <DialogContent>
        <DialogContentText>
          You are about to download <strong>{formatRowCount(rowCount)}</strong>.
          This may take a while and produce a large file. Are you sure you want
          to continue?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onContinue} variant="contained">
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  ),
);
LargeExportWarningDialog.displayName = "LargeExportWarningDialog";
```

- [ ] **Step 3: Wire dialog into `DefaultExportMenu`**

Add state to `DefaultExportMenu`:

```typescript
const [showWarning, setShowWarning] = useState(false);
const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

const totalRowCount = csvExport?.totalRowCount ?? 0;
const needsWarning = totalRowCount > LARGE_EXPORT_THRESHOLD;

const handleDownload = (action: () => void) => {
  if (needsWarning) {
    setPendingAction(() => action);
    setShowWarning(true);
  } else {
    action();
    handleClose();
  }
};

const handleWarningContinue = () => {
  setShowWarning(false);
  pendingAction?.();
  setPendingAction(null);
  handleClose();
};

const handleWarningCancel = () => {
  setShowWarning(false);
  setPendingAction(null);
};
```

Update download menu item `onClick` handlers:

```tsx
{/* Download as CSV */}
<MenuItem
  onClick={() => handleDownload(() => csvExport?.downloadAsCSV())}
  disabled={disableExport || !csvExport?.canExportCSV}
>
```

Add dialog at end of component return (before closing `</>`):

```tsx
<LargeExportWarningDialog
  open={showWarning}
  rowCount={totalRowCount}
  onContinue={handleWarningContinue}
  onCancel={handleWarningCancel}
/>
```

- [ ] **Step 4: Wire dialog into `DefaultShareMenu` identically**

Same state and handler pattern as Step 3.

- [ ] **Step 5: Run type check, lint, and tests**

Run: `cd js && pnpm type:check && pnpm lint:fix && pnpm test`
Expected: PASS

- [ ] **Step 6: Update existing test mock**

In `js/src/components/run/__tests__/RunResultPane.test.tsx`, update the `useCSVExport` mock to include `totalRowCount`:

```typescript
useCSVExport: vi.fn(() => ({
  canExportCSV: true,
  totalRowCount: 500,
  copyAsCSV: vi.fn(),
  copyAsTSV: vi.fn(),
  downloadAsCSV: vi.fn(),
  downloadAsTSV: vi.fn(),
  downloadAsExcel: vi.fn(),
})),
```

- [ ] **Step 7: Run all frontend tests**

Run: `cd js && pnpm test`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add js/packages/ui/src/components/run/RunResultPane.tsx js/src/components/run/__tests__/RunResultPane.test.tsx
git commit -s -m "feat(ui): add large export warning dialog for >100k rows"
```

---

## Chunk 4: Integration verification and cleanup

### Task 11: Full build and format check

**Files:** None (verification only)

- [ ] **Step 1: Run Python formatting and linting**

Run: `make format && make flake8`
Expected: PASS

- [ ] **Step 2: Run Python tests**

Run: `make test`
Expected: All tests PASS

- [ ] **Step 3: Run frontend build**

Run: `cd js && pnpm lint:fix && pnpm type:check && pnpm test && pnpm run build`
Expected: All PASS

- [ ] **Step 4: Verify no regressions with `recce server`**

Run: `recce server` and manually verify:
1. Run a query — result appears with preview data
2. Open Export menu — download buttons show row counts
3. Click download — file downloads from backend endpoint
4. For a large result (>100k rows) — warning dialog appears

- [ ] **Step 5: Final commit if any formatting changes**

```bash
git add -A
git commit -s -m "chore: formatting and lint fixes"
```
