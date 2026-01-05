# CSV Download Feature Design

## Overview

Add CSV export capabilities to the Run Result pane, refactoring the existing "Copy to Clipboard" button into a menu with multiple export options.

## Requirements

- Refactor "Copy to Clipboard" button into a dropdown menu
- Rename screenshot functionality to "Copy as Image"
- Add "Copy as CSV" option (copies CSV text to clipboard)
- Add "Download as CSV" option (downloads CSV file)
- Support all tabular result types
- Excel-friendly CSV format with UTF-8 BOM
- Context-aware filenames with timestamps

## Menu Structure

```
┌─────────────────────┐
│ Copy as Image       │  ← renamed from "Copy to Clipboard"
│ Copy as CSV         │  ← new (disabled if not tabular)
│ Download as CSV     │  ← new (disabled if not tabular)
├─────────────────────┤
│ Share to Cloud      │  ← existing (only if share enabled)
└─────────────────────┘
```

Button label remains "Share" for consistency.

## New Files

### `js/src/lib/csv.ts`

CSV utility functions:

```typescript
// Convert tabular data to CSV string (Excel-friendly with BOM)
export function toCSV(columns: string[], rows: unknown[][]): string

// Trigger browser download of CSV file
export function downloadCSV(content: string, filename: string): void

// Copy CSV content to clipboard
export function copyCSVToClipboard(content: string): Promise<void>
```

CSV formatting rules:
- UTF-8 BOM prefix (`\uFEFF`) for Excel compatibility
- Values containing commas, quotes, or newlines wrapped in double-quotes
- Double-quotes escaped as `""`
- NULL values exported as empty string
- Numbers exported without locale formatting (raw values)
- Booleans as `true`/`false`

### `js/src/lib/csvExtractors.ts`

Data extraction functions per result type:

```typescript
interface CSVData {
  columns: string[];
  rows: unknown[][];
}

// Returns CSVData or null if not supported
export function extractCSVData(runType: string, result: unknown): CSVData | null
```

## Supported Result Types

| Run Type | Data Location | Columns | Rows |
|----------|---------------|---------|------|
| `query` | `result.base` or `result.current` | `result.*.columns[].name` | `result.*.data` |
| `query_diff` | `result.base` + `result.current` | merged columns | merged rows with base/current markers |
| `query_base` | `result.base` | `result.base.columns[].name` | `result.base.data` |
| `profile` | `result.base` + `result.current` | profile metrics as columns | one row per column profiled |
| `row_count` | `result` | `[node, base_count, current_count, diff]` | one row per node |
| `value_diff` | `result` | value columns | diff rows |
| `top_k` | `result` | category + count columns | top-k rows |

## Filename Generation

Format: `{runType}-{nodeName}-{timestamp}.csv`

Timestamp format: `YYYYMMDD-HHmmss` (compact, sortable, filesystem-safe)

Examples:
- `query-diff-orders-20241231-143022.csv`
- `profile-customers-20241231-143022.csv`
- `row-count-20241231-143022.csv`
- `query-result-20241231-143022.csv` (fallback when no node name)

## Component Changes

### `RunResultPane.tsx`

Update `RunResultShareMenu` component:
- Rename "Copy to Clipboard" → "Copy as Image"
- Add "Copy as CSV" menu item
- Add "Download as CSV" menu item
- Pass `run` object to menu for data extraction
- Disable CSV options when `extractCSVData()` returns null

Standalone button case (when `featureToggles.disableShare` is true):
- Convert single button into dropdown menu
- Same options minus "Share to Cloud"

### Menu Item Disabled States

| Option | Disabled when |
|--------|---------------|
| Copy as Image | No result, error, or not on "Result" tab |
| Copy as CSV | Above + result type not tabular |
| Download as CSV | Above + result type not tabular |
| Share to Cloud | No result or error |

## User Feedback

- Toast notification on success: "Copied to clipboard", "Downloaded {filename}"
- Toast notification on error: "Failed to copy", "Failed to download"
