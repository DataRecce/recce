# Design: Export Options for Row Limit Handling (DRC-3039)

## Problem

The UI preview table caps at 2,000 rows — correct for display. But CSV/TSV/Excel exports also download only those 2,000 rows because the backend applies `QUERY_LIMIT = 2000` at the SQL execution level. Users need full query result exports, visibility into export size, and a safety net for large downloads.

## Requirements

1. CSV/TSV/Excel exports contain all rows from the query, not capped at 2,000
2. Download buttons display formatted row count (e.g., "12k rows", "1.2M rows")
3. Exports over 100,000 rows trigger a warning confirmation dialog
4. Canceling the warning does NOT start the download
5. 2,000-row preview limit in the UI table remains unchanged
6. No user/workspace configuration for row limits

## Architecture Decisions

### Server-side streaming export

Large exports (1M+ rows) cannot be generated client-side without OOMing the browser tab. The backend will re-execute the query without the 2,000 row limit and stream the result as a file download. The browser receives a file natively — no JSON payload in memory.

### COUNT(*) at query time

To display row counts on buttons and trigger the >100k warning, we run `SELECT COUNT(*) FROM (<user_query>)` **concurrently** with the limited preview query (not sequentially after it). The count is stored on the DataFrame and available immediately when results render. This avoids a second round-trip when the user opens the export menu.

The count query wraps the user's original SQL as a subquery. For `_query_diff_join` paths that generate complex INTERSECT/EXCEPT SQL, the count wraps the generated SQL expression, not the original `sql_template`.

**Known limitation:** The count is a separate query execution and may not match the export exactly for non-deterministic queries (e.g., `ORDER BY RANDOM()`, `TABLESAMPLE`). This is acceptable.

### Data drift between preview and export

The export endpoint re-executes the original SQL at download time. If the underlying data changed between preview and export, the exported data may differ from what was previewed. This is a known and accepted tradeoff — the alternative (caching full result sets server-side) would require significant storage infrastructure.

## Backend Changes

### 1. DataFrame model — add `total_row_count`

**File:** `recce/tasks/dataframe.py`

Add field to `DataFrame`:
```python
total_row_count: t.Optional[int] = Field(None, description="Total row count from the full query (before limit)")
```

### 2. Query tasks — run COUNT(*) wrapper

**File:** `recce/tasks/query.py`

Add a method to `QueryMixin`:
```python
@classmethod
def execute_row_count(cls, sql_template, base: bool = False) -> Optional[int]:
    """Execute SELECT COUNT(*) FROM (<sql>) to get total row count."""
```

Integrate into `QueryTask.execute_dbt()` and `QueryDiffTask._query_diff()`:
- Run the count query **concurrently** with the limited preview query (or immediately after within the same connection context)
- Store result on `DataFrame.total_row_count`
- Wrap in try/except — if count fails, `total_row_count` remains None (non-blocking)
- For `_query_diff_join` path: wrap the generated INTERSECT/EXCEPT SQL in the COUNT(*) wrapper, not the original `sql_template`

For SQLMesh adapter, add equivalent `fetchdf_count` method.

### 3. Streaming export endpoint

**File:** `recce/apis/run_api.py` (or new `recce/apis/export_api.py`)

New endpoint:
```
GET /api/runs/{run_id}/export?format=csv|tsv|xlsx
```

**Note:** GET (not POST) because this is a read operation and `window.open` sends GET requests.

Behavior:
1. Look up run from `RunDAO` by `run_id`
2. Validate run type is `query`, `query_base`, or `query_diff`
3. Re-execute the stored `sql_template` **without** `QUERY_LIMIT`
4. Stream results as `StreamingResponse` with appropriate content type and `Content-Disposition` header
5. For CSV/TSV: yield rows in chunks (e.g., 1,000 rows) using a Python generator
6. For XLSX: use `openpyxl` `write_only` mode to stream writes. Cap XLSX exports at 1,000,000 rows (Excel's sheet limit) — return 400 if exceeded, steering users to CSV/TSV.
7. **Server-side guard:** Apply a maximum export limit of 10M rows. Abort with HTTP 400 if the `total_row_count` exceeds this. Also apply a query timeout on the database connection for export queries.

Response headers:
```
Content-Type: text/csv | text/tab-separated-values | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="query-result-2026-03-26.csv"
```

For `query_diff` exports (non-join path):
- Re-execute both base and current SQL without limit
- Export as two-sheet Excel (base/current) or side-by-side CSV with `base__` / `current__` column prefixes
- Stream the merged result

**Deferred:** `query_diff` with join (primary keys) export is complex — the join-diff SQL merging logic would need to be ported to Python. Defer to a follow-up issue. For now, join-diff exports fall back to client-side (preview data only) with a note that export is limited to preview rows.

### 4. Run type guard

Only query-based run types support the export endpoint. Other types (profile, row_count, value_diff, top_k) continue using client-side export from preview data. The endpoint returns 400 for unsupported run types.

## Frontend Changes

### 5. DataFrame TypeScript type — add `total_row_count`

**File:** `js/packages/ui/src/api/types/base.ts`

```typescript
export interface DataFrame {
  // ... existing fields
  /** Total row count from full query (before preview limit) */
  total_row_count?: number;
}
```

### 6. Row count formatting utility

**File:** `js/packages/ui/src/utils/csv/format.ts` (or new `js/packages/ui/src/utils/formatRowCount.ts`)

```typescript
export function formatRowCount(n: number): string
```

Formatting rules:
- `< 1,000` → exact with commas: `"450 rows"`
- `1,000–999,999` → `"12k rows"`, `"450k rows"`
- `>= 1,000,000` → `"1.2M rows"`, `"3.5M rows"`

### 7. useCSVExport hook — expose totalRowCount

**File:** `js/packages/ui/src/hooks/useCSVExport.ts`

Add to `UseCSVExportResult`:
```typescript
/** Total row count from the full query (for display on export buttons) */
totalRowCount: number | null;
```

Derive from `run.result`:
- For `query` / `query_base`: `result.total_row_count`
- For `query_diff`: `Math.max(result.base?.total_row_count, result.current?.total_row_count)`

### 8. CSVExportProps — add totalRowCount

**File:** `js/packages/ui/src/components/run/RunResultPane.tsx`

```typescript
export interface CSVExportProps {
  // ... existing fields
  /** Total row count for display on download buttons */
  totalRowCount?: number | null;
}
```

### 9. Export menu — row count labels on download buttons

**Files:** `DefaultExportMenu` and `DefaultShareMenu` in `RunResultPane.tsx`

Update download menu item labels:
- `"Download as CSV"` → `"Download as CSV (12k rows)"` when `totalRowCount` is available
- `"Download as TSV"` → `"Download as TSV (12k rows)"`
- `"Download as Excel"` → `"Download as Excel (12k rows)"`
- Copy actions unchanged (no row count label — they use preview data)

### 10. Large export warning dialog

**File:** `js/packages/ui/src/components/run/RunResultPane.tsx` (inside `DefaultExportMenu` / `DefaultShareMenu`)

MUI `Dialog` component:
- **Trigger:** Any download button click when `totalRowCount > 100_000`
- **Title:** "Large Export Warning"
- **Body:** "You are about to download **{formatted count}**. This may take a while and produce a large file. Are you sure you want to continue?"
- **Actions:** "Cancel" (closes dialog) / "Continue" (proceeds with download)
- State: `showLargeExportWarning` boolean + `pendingExportFormat` to remember which format was requested

### 11. Download buttons hit backend endpoint

**File:** `js/packages/ui/src/hooks/useCSVExport.ts`

Replace `downloadAsCSV`, `downloadAsTSV`, `downloadAsExcel` implementations:

```typescript
// Instead of client-side file generation:
const downloadAsCSV = () => {
  if (shouldWarn) { setPendingFormat('csv'); setShowWarning(true); return; }
  triggerDownload('csv');
};

const triggerDownload = (format: string) => {
  window.open(`/api/runs/${run.run_id}/export?format=${format}`, '_blank');
};
```

**Copy-to-clipboard actions remain client-side** — they use the 2,000-row preview data. Only file downloads go through the backend.

## What Stays the Same

- 2,000-row preview limit in the UI table
- Copy as CSV / Copy as Text (client-side from preview)
- Copy as Image
- Non-query run type exports (profile_diff, row_count_diff, value_diff, top_k_diff) — small result sets, client-side
- No user/workspace row limit configuration

## Edge Cases

| Case | Behavior |
|------|----------|
| `total_row_count` <= 2,000 | Count shown on buttons. Download still goes through backend for consistency. |
| `total_row_count` is null (count query failed) | No count label on buttons. Export works without warning dialog. |
| User cancels mid-download | Browser handles natively; server generator stops on connection drop. |
| `query_diff` with different base/current counts | Show larger count on buttons. Warning triggers if either > 100k. |
| SQLMesh adapter | Same pattern — add `fetchdf_count` equivalent alongside existing `fetchdf_with_limit`. |
| Unsupported run type hits export endpoint | Returns HTTP 400 with descriptive error. |
| Server restart between preview and export | Run evicted from `RunDAO` memory — export returns 404. Acceptable: user re-runs the query. |
| XLSX export > 1M rows | Returns HTTP 400 with message to use CSV/TSV instead. |
| Export > 10M rows (any format) | Returns HTTP 400 — server-side safety guard. |
| `query_diff` with join (primary keys) | Falls back to client-side export (preview data only). Full export deferred. |
| Concurrent export requests | Allowed — no guard needed. Warehouse handles concurrency. |

## Files Changed

### Backend (Python)
| File | Change |
|------|--------|
| `recce/tasks/dataframe.py` | Add `total_row_count` field |
| `recce/tasks/query.py` | Add `execute_row_count()`, integrate into QueryTask/QueryDiffTask |
| `recce/apis/run_api.py` | Add `GET /api/runs/{run_id}/export` streaming endpoint |

### Frontend (TypeScript)
| File | Change |
|------|--------|
| `js/packages/ui/src/api/types/base.ts` | Add `total_row_count` to DataFrame |
| `js/packages/ui/src/utils/csv/format.ts` | Add `formatRowCount()` utility |
| `js/packages/ui/src/hooks/useCSVExport.ts` | Add `totalRowCount`, rewire downloads to backend |
| `js/packages/ui/src/components/run/RunResultPane.tsx` | Row count labels, warning dialog, updated CSVExportProps |

### Tests
| File | Change |
|------|--------|
| `tests/test_query.py` (or new) | Test `execute_row_count`, test export endpoint |
| `js/packages/ui/src/utils/csv/__tests__/format.test.ts` | Test `formatRowCount()` |
| `js/packages/ui/src/hooks/__tests__/useCSVExport.test.ts` (or new) | Test `totalRowCount` derivation |
