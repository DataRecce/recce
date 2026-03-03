/**
 * @file csv/extractors.ts
 * @description CSV data extractors for each run type
 */
import type {
  DataFrame,
  ProfileDiffResult,
  QueryDiffResult,
  RowCountDiffResult,
  TopKDiffResult,
  ValueDiffResult,
} from "../../api";

export interface CSVData {
  columns: string[];
  rows: unknown[][];
}

export interface CSVExportOptions {
  displayMode?: "inline" | "side_by_side";
  primaryKeys?: string[];
}

/**
 * Format a cell value for inline diff mode
 * If base and current are the same, return the value
 * If different, return "(base_value) (current_value)"
 */
function formatInlineDiffCell(
  baseValue: unknown,
  currentValue: unknown,
): unknown {
  // Convert to string for comparison
  const baseStr = baseValue == null ? "" : String(baseValue);
  const currentStr = currentValue == null ? "" : String(currentValue);

  if (baseStr === currentStr) {
    return baseValue;
  }

  // Format as "(base) (current)" when different
  const baseDisplay = baseValue == null ? "" : `(${baseValue})`;
  const currentDisplay = currentValue == null ? "" : `(${currentValue})`;
  return `${baseDisplay} ${currentDisplay}`.trim();
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
  // query_base returns a DataFrame directly (QueryResult = DataFrame)
  return extractDataFrame(result as DataFrame);
}

/**
 * Extract CSV data from query_diff result
 * Supports two result shapes:
 * 1. { diff: DataFrame } - joined diff result (QueryDiffJoinResultView)
 * 2. { base: DataFrame, current: DataFrame } - separate base/current (QueryDiffResultView)
 *
 * Display modes:
 * - "inline": Merged rows where same values shown as-is, differing values shown as "(base) (current)"
 * - "side_by_side": Single row per record with base__col, current__col columns
 *
 * Note: When base and current have different row counts (e.g., added/removed rows),
 * the merge is done positionally. Extra rows will show null for the missing environment.
 */
function extractQueryDiff(
  result: unknown,
  options?: CSVExportOptions,
): CSVData | null {
  const typed = result as QueryDiffResult;
  const displayMode = options?.displayMode ?? "inline";
  const primaryKeys = options?.primaryKeys ?? [];

  // First, check if diff DataFrame exists (joined result)
  if (typed?.diff) {
    return extractQueryDiffJoined(typed.diff, displayMode, primaryKeys);
  }

  // Fall back to base/current DataFrames
  return extractQueryDiffSeparate(typed, displayMode);
}

/**
 * Extract CSV from joined diff DataFrame (QueryDiffJoinResultView)
 * The diff DataFrame has columns like: pk, col1, col2, in_a, in_b
 * where in_a/in_b indicate presence in base/current
 *
 * The DataFrame may have separate rows for base (in_a=true) and current (in_b=true)
 * records. This function groups them by primary key and merges into single output rows.
 *
 * Produces same layout as extractQueryDiffSeparate for consistency.
 */
function extractQueryDiffJoined(
  diff: DataFrame,
  displayMode: "inline" | "side_by_side",
  primaryKeys: string[],
): CSVData | null {
  if (!diff?.columns || !diff?.data) return null;

  // Find in_a and in_b column indices
  const inAIndex = diff.columns.findIndex(
    (col) => col.key.toLowerCase() === "in_a",
  );
  const inBIndex = diff.columns.findIndex(
    (col) => col.key.toLowerCase() === "in_b",
  );

  // Get data columns (exclude in_a and in_b)
  const dataColumns = diff.columns.filter(
    (col) =>
      col.key.toLowerCase() !== "in_a" && col.key.toLowerCase() !== "in_b",
  );
  const dataColumnNames = dataColumns.map((col) => col.name);
  const dataColumnIndices = dataColumns.map((col) =>
    diff.columns.findIndex((c) => c.key === col.key),
  );

  // Find primary key column indices
  const pkIndices = primaryKeys
    .map((pk) => diff.columns.findIndex((col) => col.key === pk))
    .filter((idx) => idx >= 0);

  // Extract row values for data columns only
  const extractRowValues = (rowData: unknown[]): unknown[] => {
    return dataColumnIndices.map((colIndex) => rowData[colIndex]);
  };

  // Generate primary key string for grouping
  const getPrimaryKeyValue = (rowData: unknown[]): string => {
    if (pkIndices.length === 0) {
      // No primary keys - use row index (will be set later)
      return "";
    }
    return pkIndices.map((idx) => String(rowData[idx] ?? "")).join("|||");
  };

  // Group rows by primary key, separating base and current
  const groupedRows: Map<
    string,
    { base: unknown[] | null; current: unknown[] | null }
  > = new Map();
  const rowOrder: string[] = []; // Track insertion order

  diff.data.forEach((rowData, index) => {
    const inA = inAIndex >= 0 ? rowData[inAIndex] : true;
    const inB = inBIndex >= 0 ? rowData[inBIndex] : true;

    // Use primary key or index for grouping
    let pkValue = getPrimaryKeyValue(rowData);
    if (pkValue === "") {
      pkValue = String(index);
    }

    if (!groupedRows.has(pkValue)) {
      groupedRows.set(pkValue, { base: null, current: null });
      rowOrder.push(pkValue);
    }

    const group = groupedRows.get(pkValue);
    if (!group) return;

    const values = extractRowValues(rowData);

    if (inA) {
      group.base = values;
    }
    if (inB) {
      group.current = values;
    }
  });

  if (displayMode === "side_by_side") {
    // Side-by-side: columns like base__col1, current__col1, base__col2, current__col2
    const columns: string[] = [];
    dataColumnNames.forEach((name) => {
      columns.push(`base__${name}`, `current__${name}`);
    });

    const rows: unknown[][] = [];

    for (const pkValue of rowOrder) {
      const group = groupedRows.get(pkValue);
      if (!group) continue;

      const baseValues = group.base;
      const currentValues = group.current;

      const row: unknown[] = [];
      dataColumnNames.forEach((_, colIndex) => {
        row.push(baseValues ? baseValues[colIndex] : null);
        row.push(currentValues ? currentValues[colIndex] : null);
      });

      rows.push(row);
    }

    return { columns, rows };
  }

  // Inline mode: merged rows with diff shown in parentheses
  // Format: value if same, "(base_value) (current_value)" if different
  const columns = [...dataColumnNames];
  const rows: unknown[][] = [];

  for (const pkValue of rowOrder) {
    const group = groupedRows.get(pkValue);
    if (!group) continue;

    const baseValues = group.base;
    const currentValues = group.current;

    // Merge base and current into single row
    const row: unknown[] = [];
    dataColumnNames.forEach((_, colIndex) => {
      const baseVal = baseValues ? baseValues[colIndex] : null;
      const currentVal = currentValues ? currentValues[colIndex] : null;
      row.push(formatInlineDiffCell(baseVal, currentVal));
    });

    rows.push(row);
  }

  return { columns, rows };
}

/**
 * Extract CSV from separate base/current DataFrames (QueryDiffResultView)
 */
function extractQueryDiffSeparate(
  typed: QueryDiffResult,
  displayMode: "inline" | "side_by_side",
): CSVData | null {
  const df = typed?.current || typed?.base;
  if (!df) return null;

  // If only one exists, just return it
  if (!typed?.base || !typed?.current) {
    return extractDataFrame(df);
  }

  const columnNames = typed.current.columns.map((c) => c.name);

  if (displayMode === "side_by_side") {
    // Side-by-side: columns like base__col1, current__col1, base__col2, current__col2
    const columns: string[] = [];
    columnNames.forEach((name) => {
      columns.push(`base__${name}`, `current__${name}`);
    });

    const rows: unknown[][] = [];
    const maxRows = Math.max(typed.base.data.length, typed.current.data.length);

    for (let i = 0; i < maxRows; i++) {
      const row: unknown[] = [];
      const baseRow = i < typed.base.data.length ? typed.base.data[i] : null;
      const currentRow =
        i < typed.current.data.length ? typed.current.data[i] : null;

      columnNames.forEach((_, colIndex) => {
        row.push(baseRow ? baseRow[colIndex] : null);
        row.push(currentRow ? currentRow[colIndex] : null);
      });

      rows.push(row);
    }

    return { columns, rows };
  }

  // Inline mode: merged rows with diff shown in parentheses
  // Format: value if same, "(base_value) (current_value)" if different
  const columns = [...columnNames];
  const rows: unknown[][] = [];

  const maxRows = Math.max(typed.base.data.length, typed.current.data.length);
  for (let i = 0; i < maxRows; i++) {
    const baseRow = i < typed.base.data.length ? typed.base.data[i] : null;
    const currentRow =
      i < typed.current.data.length ? typed.current.data[i] : null;

    // Merge base and current into single row
    const row: unknown[] = [];
    columnNames.forEach((_, colIndex) => {
      const baseVal = baseRow ? baseRow[colIndex] : null;
      const currentVal = currentRow ? currentRow[colIndex] : null;
      row.push(formatInlineDiffCell(baseVal, currentVal));
    });

    rows.push(row);
  }

  return { columns, rows };
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

  const columns = [
    "node",
    "base_count",
    "current_count",
    "diff",
    "diff_percent",
  ];
  const rows: unknown[][] = [];

  for (const [nodeName, counts] of Object.entries(typed)) {
    if (counts && typeof counts === "object") {
      const base = (counts as { base?: number | null }).base;
      const current = (counts as { curr?: number | null }).curr;
      const diff = base != null && current != null ? current - base : null;
      const diffPercent =
        base && diff !== null ? ((diff / base) * 100).toFixed(2) + "%" : null;
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

  // Check if either base or current has values
  const hasBaseValues = !!typed?.base?.values;
  const hasCurrentValues = !!typed?.current?.values;
  if (!hasBaseValues && !hasCurrentValues) return null;

  // TopK has { values: [...], counts: [...], valids: number }
  const columns = ["_source", "value", "count"];
  const rows: unknown[][] = [];

  if (typed?.base?.values) {
    typed.base.values.forEach((value, index) => {
      rows.push(["base", value, typed.base.counts[index]]);
    });
  }
  if (typed?.current?.values) {
    typed.current.values.forEach((value, index) => {
      rows.push(["current", value, typed.current.counts[index]]);
    });
  }

  return { columns, rows };
}

/**
 * Map of run types to their extractor functions
 * Some extractors accept options (like query_diff for displayMode)
 */
const extractors: Record<
  string,
  (result: unknown, options?: CSVExportOptions) => CSVData | null
> = {
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
 * @param runType - The type of run (query, query_diff, etc.)
 * @param result - The run result data
 * @param options - Optional export options (e.g., displayMode for query_diff)
 * @returns CSVData or null if the run type doesn't support CSV export
 */
export function extractCSVData(
  runType: string,
  result: unknown,
  options?: CSVExportOptions,
): CSVData | null {
  const extractor = extractors[runType];
  if (!extractor) return null;

  try {
    return extractor(result, options);
  } catch (error) {
    console.error(
      `Failed to extract CSV data for run type "${runType}":`,
      error,
    );
    return null;
  }
}

/**
 * Check if a run type supports CSV export
 */
export function supportsCSVExport(runType: string): boolean {
  return runType in extractors;
}
