/**
 * CSV data extractors for each run type
 */

import type { QueryDiffResult } from "@/lib/api/adhocQuery";
import type { ProfileDiffResult, TopKDiffResult } from "@/lib/api/profile";
import type { RowCountDiffResult } from "@/lib/api/rowcount";
import type { DataFrame } from "@/lib/api/types";
import type { ValueDiffResult } from "@/lib/api/valuediff";

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
  // query_base returns a DataFrame directly (QueryResult = DataFrame)
  return extractDataFrame(result as DataFrame);
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

  // Prefer current, fall back to base
  const topK = typed?.current || typed?.base;
  if (!topK?.values) return null;

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
  result: unknown,
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
