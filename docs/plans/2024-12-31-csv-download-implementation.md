# CSV Download Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CSV export capabilities to the Run Result pane with options to copy as image, copy as CSV, and download as CSV.

**Architecture:** Create CSV utility module (`js/src/lib/csv/`) with formatting, extraction, and download functions. Refactor `RunResultShareMenu` component to expose these options in a flat menu structure. Each run type has a dedicated extractor function.

**Tech Stack:** TypeScript, React, MUI Menu, file-saver (already installed), Clipboard API

---

## Task 1: Create CSV Utility Module

**Files:**
- Create: `js/src/lib/csv/index.ts`
- Create: `js/src/lib/csv/format.ts`

**Step 1: Create the CSV format utility**

Create `js/src/lib/csv/format.ts`:

```typescript
/**
 * CSV formatting utilities with Excel-friendly output
 */

/**
 * Escape a value for CSV format
 * - Wrap in quotes if contains comma, quote, or newline
 * - Escape quotes by doubling them
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = typeof value === "object"
    ? JSON.stringify(value)
    : String(value);

  // Check if escaping is needed
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert tabular data to CSV string
 * @param columns - Column headers
 * @param rows - Row data (array of arrays)
 * @returns CSV string with UTF-8 BOM for Excel compatibility
 */
export function toCSV(columns: string[], rows: unknown[][]): string {
  const BOM = "\uFEFF";

  const headerRow = columns.map(escapeCSVValue).join(",");
  const dataRows = rows.map((row) =>
    row.map(escapeCSVValue).join(",")
  );

  return BOM + [headerRow, ...dataRows].join("\r\n");
}
```

**Step 2: Create the CSV index with download and clipboard utilities**

Create `js/src/lib/csv/index.ts`:

```typescript
/**
 * CSV export utilities
 */
import saveAs from "file-saver";

export { toCSV } from "./format";

/**
 * Trigger browser download of CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  saveAs(blob, filename);
}

/**
 * Copy CSV content to clipboard
 */
export async function copyCSVToClipboard(content: string): Promise<void> {
  await navigator.clipboard.writeText(content);
}

/**
 * Generate timestamp string for filenames
 * Format: YYYYMMDD-HHmmss
 */
export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Generate context-aware CSV filename
 */
export function generateCSVFilename(
  runType: string,
  params?: Record<string, unknown>
): string {
  const timestamp = generateTimestamp();
  const type = runType.replace(/_/g, "-");

  // Try to extract node name from params
  let nodeName: string | undefined;

  if (params?.node_names && Array.isArray(params.node_names) && params.node_names.length === 1) {
    nodeName = String(params.node_names[0]);
  } else if (params?.model && typeof params.model === "string") {
    nodeName = params.model;
  }

  // Sanitize node name for filesystem
  if (nodeName) {
    nodeName = nodeName.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
    return `${type}-${nodeName}-${timestamp}.csv`;
  }

  return `${type}-result-${timestamp}.csv`;
}
```

**Step 3: Verify the module compiles**

Run: `cd /Users/kliu/recceAll/recce && pnpm exec tsc --noEmit js/src/lib/csv/index.ts js/src/lib/csv/format.ts 2>&1 | head -20`

Expected: No errors (or only unrelated errors from other files)

**Step 4: Commit**

```bash
cd /Users/kliu/recceAll/recce
git add js/src/lib/csv/
git commit -m "feat(csv): add CSV formatting and download utilities"
```

---

## Task 2: Create CSV Data Extractors

**Files:**
- Create: `js/src/lib/csv/extractors.ts`
- Modify: `js/src/lib/csv/index.ts`

**Step 1: Create the extractors module**

Create `js/src/lib/csv/extractors.ts`:

```typescript
/**
 * CSV data extractors for each run type
 */
import type {
  DataFrame,
  QueryDiffResult,
  ValueDiffResult,
  ProfileDiffResult,
  RowCountDiffResult,
  TopKDiffResult,
} from "@/lib/api/types";

export interface CSVData {
  columns: string[];
  rows: unknown[][];
}

/**
 * Extract columns and rows from a DataFrame
 */
function extractDataFrame(df: DataFrame | undefined): CSVData | null {
  if (!df || !df.columns || !df.data) {
    return null;
  }
  return {
    columns: df.columns.map((col) => col.name),
    rows: df.data.map((row) => [...row]),
  };
}

/**
 * Extract CSV data from query result (single environment)
 */
function extractQuery(result: unknown): CSVData | null {
  return extractDataFrame(result as DataFrame);
}

/**
 * Extract CSV data from query_base result
 */
function extractQueryBase(result: unknown): CSVData | null {
  const typed = result as { base?: DataFrame };
  return extractDataFrame(typed?.base);
}

/**
 * Extract CSV data from query_diff result
 * Combines base and current with a source column
 */
function extractQueryDiff(result: unknown): CSVData | null {
  const typed = result as QueryDiffResult;

  // Prefer current, fall back to base
  const df = typed?.current || typed?.base;
  if (!df) return null;

  // If both exist, combine them
  if (typed?.base && typed?.current) {
    const baseColumns = typed.base.columns.map((c) => c.name);
    const currentColumns = typed.current.columns.map((c) => c.name);

    // Use current columns as the standard
    const columns = ["_source", ...currentColumns];
    const rows: unknown[][] = [];

    // Add base rows
    typed.base.data.forEach((row) => {
      rows.push(["base", ...row]);
    });

    // Add current rows
    typed.current.data.forEach((row) => {
      rows.push(["current", ...row]);
    });

    return { columns, rows };
  }

  return extractDataFrame(df);
}

/**
 * Extract CSV data from profile_diff result
 */
function extractProfileDiff(result: unknown): CSVData | null {
  const typed = result as ProfileDiffResult;

  // Profile data has metrics as columns, one row per profiled column
  const df = typed?.current || typed?.base;
  if (!df) return null;

  // If both exist, combine with source column
  if (typed?.base && typed?.current) {
    const columns = ["_source", ...typed.current.columns.map((c) => c.name)];
    const rows: unknown[][] = [];

    typed.base.data.forEach((row) => {
      rows.push(["base", ...row]);
    });
    typed.current.data.forEach((row) => {
      rows.push(["current", ...row]);
    });

    return { columns, rows };
  }

  return extractDataFrame(df);
}

/**
 * Extract CSV data from row_count_diff result
 */
function extractRowCountDiff(result: unknown): CSVData | null {
  const typed = result as RowCountDiffResult;
  if (!typed || typeof typed !== "object") return null;

  const columns = ["node", "base_count", "current_count", "diff", "diff_percent"];
  const rows: unknown[][] = [];

  for (const [nodeName, counts] of Object.entries(typed)) {
    if (counts && typeof counts === "object") {
      const base = (counts as { base?: number }).base;
      const current = (counts as { curr?: number }).curr;
      const diff = base !== undefined && current !== undefined ? current - base : null;
      const diffPercent = base && diff !== null ? ((diff / base) * 100).toFixed(2) + "%" : null;
      rows.push([nodeName, base, current, diff, diffPercent]);
    }
  }

  return { columns, rows };
}

/**
 * Extract CSV data from value_diff result
 */
function extractValueDiff(result: unknown): CSVData | null {
  const typed = result as ValueDiffResult;
  if (!typed?.data) return null;
  return extractDataFrame(typed.data);
}

/**
 * Extract CSV data from value_diff_detail result
 */
function extractValueDiffDetail(result: unknown): CSVData | null {
  return extractDataFrame(result as DataFrame);
}

/**
 * Extract CSV data from top_k_diff result
 */
function extractTopKDiff(result: unknown): CSVData | null {
  const typed = result as TopKDiffResult;

  // Prefer current, fall back to base
  const topK = typed?.current || typed?.base;
  if (!topK?.valids) return null;

  // TopK has { valids: [{ value, count }], nulls: number }
  const columns = ["_source", "value", "count"];
  const rows: unknown[][] = [];

  if (typed?.base?.valids) {
    typed.base.valids.forEach((item) => {
      rows.push(["base", item.value, item.count]);
    });
  }
  if (typed?.current?.valids) {
    typed.current.valids.forEach((item) => {
      rows.push(["current", item.value, item.count]);
    });
  }

  return { columns, rows };
}

/**
 * Map of run types to their extractor functions
 */
const extractors: Record<string, (result: unknown) => CSVData | null> = {
  query: extractQuery,
  query_base: extractQueryBase,
  query_diff: extractQueryDiff,
  profile: extractProfileDiff,
  profile_diff: extractProfileDiff,
  row_count: extractRowCountDiff,
  row_count_diff: extractRowCountDiff,
  value_diff: extractValueDiff,
  value_diff_detail: extractValueDiffDetail,
  top_k_diff: extractTopKDiff,
};

/**
 * Extract CSV data from a run result
 * @returns CSVData or null if the run type doesn't support CSV export
 */
export function extractCSVData(
  runType: string,
  result: unknown
): CSVData | null {
  const extractor = extractors[runType];
  if (!extractor) return null;

  try {
    return extractor(result);
  } catch {
    return null;
  }
}

/**
 * Check if a run type supports CSV export
 */
export function supportsCSVExport(runType: string): boolean {
  return runType in extractors;
}
```

**Step 2: Export extractors from index**

Modify `js/src/lib/csv/index.ts` - add at the end:

```typescript
export { extractCSVData, supportsCSVExport, type CSVData } from "./extractors";
```

**Step 3: Verify the module compiles**

Run: `cd /Users/kliu/recceAll/recce && pnpm exec tsc --noEmit js/src/lib/csv/*.ts 2>&1 | head -30`

Expected: No errors

**Step 4: Commit**

```bash
cd /Users/kliu/recceAll/recce
git add js/src/lib/csv/
git commit -m "feat(csv): add CSV data extractors for all tabular run types"
```

---

## Task 3: Add CSV Export Hook

**Files:**
- Create: `js/src/lib/hooks/useCSVExport.ts`

**Step 1: Create the CSV export hook**

Create `js/src/lib/hooks/useCSVExport.ts`:

```typescript
/**
 * Hook for CSV export functionality
 */
import { useCallback, useMemo } from "react";
import { toaster } from "@/components/ui/toaster";
import {
  toCSV,
  downloadCSV,
  copyCSVToClipboard,
  generateCSVFilename,
  extractCSVData,
  supportsCSVExport,
} from "@/lib/csv";
import type { Run } from "@/lib/api/types";

interface UseCSVExportOptions {
  run?: Run;
}

interface UseCSVExportResult {
  /** Whether CSV export is available for this run type */
  canExportCSV: boolean;
  /** Copy result data as CSV to clipboard */
  copyAsCSV: () => Promise<void>;
  /** Download result data as CSV file */
  downloadAsCSV: () => void;
}

export function useCSVExport({ run }: UseCSVExportOptions): UseCSVExportResult {
  const canExportCSV = useMemo(() => {
    if (!run?.type || !run?.result) return false;
    return supportsCSVExport(run.type);
  }, [run?.type, run?.result]);

  const getCSVContent = useCallback((): string | null => {
    if (!run?.type || !run?.result) return null;

    const csvData = extractCSVData(run.type, run.result);
    if (!csvData) return null;

    return toCSV(csvData.columns, csvData.rows);
  }, [run?.type, run?.result]);

  const copyAsCSV = useCallback(async () => {
    const content = getCSVContent();
    if (!content) {
      toaster.create({
        title: "Export failed",
        description: "Unable to extract data for CSV export",
        type: "error",
        duration: 3000,
      });
      return;
    }

    try {
      await copyCSVToClipboard(content);
      toaster.create({
        title: "Copied to clipboard",
        description: "CSV data copied successfully",
        type: "success",
        duration: 2000,
      });
    } catch (error) {
      toaster.create({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        type: "error",
        duration: 3000,
      });
    }
  }, [getCSVContent]);

  const downloadAsCSV = useCallback(() => {
    const content = getCSVContent();
    if (!content) {
      toaster.create({
        title: "Export failed",
        description: "Unable to extract data for CSV export",
        type: "error",
        duration: 3000,
      });
      return;
    }

    try {
      const filename = generateCSVFilename(run!.type, run!.params as Record<string, unknown>);
      downloadCSV(content, filename);
      toaster.create({
        title: "Downloaded",
        description: filename,
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      toaster.create({
        title: "Download failed",
        description: "Failed to download CSV file",
        type: "error",
        duration: 3000,
      });
    }
  }, [getCSVContent, run]);

  return {
    canExportCSV,
    copyAsCSV,
    downloadAsCSV,
  };
}
```

**Step 2: Verify the hook compiles**

Run: `cd /Users/kliu/recceAll/recce && pnpm exec tsc --noEmit js/src/lib/hooks/useCSVExport.ts 2>&1 | head -20`

Expected: No errors

**Step 3: Commit**

```bash
cd /Users/kliu/recceAll/recce
git add js/src/lib/hooks/useCSVExport.ts
git commit -m "feat(csv): add useCSVExport hook for CSV operations"
```

---

## Task 4: Refactor RunResultShareMenu Component

**Files:**
- Modify: `js/src/components/run/RunResultPane.tsx`

**Step 1: Update imports**

Add these imports at the top of `js/src/components/run/RunResultPane.tsx`:

```typescript
import { PiDownloadSimple, PiImage, PiTable } from "react-icons/pi";
import { useCSVExport } from "@/lib/hooks/useCSVExport";
```

**Step 2: Update RunResultShareMenu props interface**

Find the `RunResultShareMenu` component (around line 116) and update its props:

```typescript
const RunResultShareMenu = ({
  run,
  disableCopyToClipboard,
  onCopyToClipboard,
  onMouseEnter,
  onMouseLeave,
}: {
  run?: Run;
  disableCopyToClipboard: boolean;
  onCopyToClipboard: () => Promise<void>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) => {
```

**Step 3: Add CSV export hook inside RunResultShareMenu**

Inside the `RunResultShareMenu` component, after the existing state declarations, add:

```typescript
  const { canExportCSV, copyAsCSV, downloadAsCSV } = useCSVExport({ run });
```

**Step 4: Update menu items**

Replace the existing menu content (the `<Menu>` element and its children) with:

```typescript
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem
          onClick={async () => {
            await onCopyToClipboard();
            handleClose();
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          disabled={disableCopyToClipboard}
        >
          <ListItemIcon>
            <PiImage />
          </ListItemIcon>
          <ListItemText>Copy as Image</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={async () => {
            await copyAsCSV();
            handleClose();
          }}
          disabled={disableCopyToClipboard || !canExportCSV}
        >
          <ListItemIcon>
            <PiTable />
          </ListItemIcon>
          <ListItemText>Copy as CSV</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            downloadAsCSV();
            handleClose();
          }}
          disabled={disableCopyToClipboard || !canExportCSV}
        >
          <ListItemIcon>
            <PiDownloadSimple />
          </ListItemIcon>
          <ListItemText>Download as CSV</ListItemText>
        </MenuItem>
        <Divider />
        {authed ? (
          <MenuItem
            onClick={async () => {
              await handleShareClick();
              trackShareState({ name: "create" });
              handleClose();
            }}
          >
            <ListItemIcon>
              <TbCloudUpload />
            </ListItemIcon>
            <ListItemText>Share to Cloud</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              setShowModal(true);
              handleClose();
            }}
          >
            <ListItemIcon>
              <TbCloudUpload />
            </ListItemIcon>
            <ListItemText>Share</ListItemText>
          </MenuItem>
        )}
      </Menu>
```

**Step 5: Update RunResultShareMenu usage**

Find where `RunResultShareMenu` is used (around line 308) and add the `run` prop:

```typescript
            <RunResultShareMenu
              run={run}
              disableCopyToClipboard={disableCopyToClipboard}
              onCopyToClipboard={async () => {
                await onCopyToClipboard();
                trackCopyToClipboard({
                  type: run?.type ?? "unknown",
                  from: "run",
                });
              }}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
            />
```

**Step 6: Verify the file compiles**

Run: `cd /Users/kliu/recceAll/recce && pnpm exec tsc --noEmit js/src/components/run/RunResultPane.tsx 2>&1 | head -30`

Expected: No errors

**Step 7: Commit**

```bash
cd /Users/kliu/recceAll/recce
git add js/src/components/run/RunResultPane.tsx
git commit -m "feat(csv): add CSV export options to Share menu"
```

---

## Task 5: Update Standalone Copy Button (when share disabled)

**Files:**
- Modify: `js/src/components/run/RunResultPane.tsx`

**Step 1: Convert standalone button to menu**

Find the standalone button section (around line 291-306, the `featureToggles.disableShare` branch) and replace it with a menu similar to `RunResultShareMenu` but without the Share to Cloud option.

Replace this code block:

```typescript
          {featureToggles.disableShare ? (
            <Button
              variant="outlined"
              color="neutral"
              disabled={
                !runId || !run?.result || !!error || tabValue !== "result"
              }
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              size="small"
              onClick={onCopyToClipboard}
              startIcon={<PiCopy />}
              sx={{ textTransform: "none" }}
            >
              Copy to Clipboard
            </Button>
          ) : (
```

With:

```typescript
          {featureToggles.disableShare ? (
            <RunResultExportMenu
              run={run}
              disableExport={!runId || !run?.result || !!error || tabValue !== "result"}
              onCopyAsImage={onCopyToClipboard}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
            />
          ) : (
```

**Step 2: Create RunResultExportMenu component**

Add this new component before `RunResultShareMenu` (around line 115):

```typescript
const RunResultExportMenu = ({
  run,
  disableExport,
  onCopyAsImage,
  onMouseEnter,
  onMouseLeave,
}: {
  run?: Run;
  disableExport: boolean;
  onCopyAsImage: () => Promise<void>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const { canExportCSV, copyAsCSV, downloadAsCSV } = useCSVExport({ run });

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="neutral"
        onClick={handleClick}
        endIcon={<PiCaretDown />}
        sx={{ textTransform: "none" }}
      >
        Export
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem
          onClick={async () => {
            await onCopyAsImage();
            handleClose();
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          disabled={disableExport}
        >
          <ListItemIcon>
            <PiImage />
          </ListItemIcon>
          <ListItemText>Copy as Image</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={async () => {
            await copyAsCSV();
            handleClose();
          }}
          disabled={disableExport || !canExportCSV}
        >
          <ListItemIcon>
            <PiTable />
          </ListItemIcon>
          <ListItemText>Copy as CSV</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            downloadAsCSV();
            handleClose();
          }}
          disabled={disableExport || !canExportCSV}
        >
          <ListItemIcon>
            <PiDownloadSimple />
          </ListItemIcon>
          <ListItemText>Download as CSV</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
```

**Step 3: Verify the file compiles**

Run: `cd /Users/kliu/recceAll/recce && pnpm exec tsc --noEmit js/src/components/run/RunResultPane.tsx 2>&1 | head -30`

Expected: No errors

**Step 4: Commit**

```bash
cd /Users/kliu/recceAll/recce
git add js/src/components/run/RunResultPane.tsx
git commit -m "feat(csv): add Export menu when share is disabled"
```

---

## Task 6: Manual Testing

**Step 1: Start the development server**

Run: `cd /Users/kliu/recceAll/recce && pnpm dev`

**Step 2: Test CSV export for query results**

1. Navigate to a query run result
2. Click the "Share" dropdown menu
3. Verify "Copy as Image", "Copy as CSV", "Download as CSV" options appear
4. Click "Copy as CSV" - verify toast shows success
5. Paste in text editor - verify CSV format with headers and data
6. Click "Download as CSV" - verify file downloads with correct filename

**Step 3: Test CSV export for other result types**

Test each supported type:
- query_diff
- profile / profile_diff
- row_count / row_count_diff
- value_diff / value_diff_detail
- top_k_diff

**Step 4: Test disabled states**

1. For non-tabular results (histogram, lineage), verify CSV options are disabled
2. When no result is available, verify all options are disabled
3. When not on "Result" tab, verify options are disabled

**Step 5: Test Export menu (when share disabled)**

1. Set `featureToggles.disableShare = true` in dev environment
2. Verify "Export" button appears instead of "Share"
3. Verify menu has same options minus "Share to Cloud"

---

## Task 7: Final Review and Cleanup

**Step 1: Run linter**

Run: `cd /Users/kliu/recceAll/recce && pnpm lint`

Fix any linting errors.

**Step 2: Run type check**

Run: `cd /Users/kliu/recceAll/recce && pnpm exec tsc --noEmit`

Fix any type errors.

**Step 3: Run tests**

Run: `cd /Users/kliu/recceAll/recce && pnpm test`

Fix any failing tests.

**Step 4: Final commit**

```bash
cd /Users/kliu/recceAll/recce
git add -A
git commit -m "chore: fix linting and type errors for CSV export feature"
```

---

## Summary

Files created:
- `js/src/lib/csv/index.ts` - CSV export utilities
- `js/src/lib/csv/format.ts` - CSV formatting
- `js/src/lib/csv/extractors.ts` - Data extractors per run type
- `js/src/lib/hooks/useCSVExport.ts` - React hook for CSV operations

Files modified:
- `js/src/components/run/RunResultPane.tsx` - Menu refactoring

Total commits: 6
