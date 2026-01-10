/**
 * @file rowCountUtils.ts
 * @description Utilities for converting row count results to DataFrame format
 */

import type { DataFrame, RowCountDiffResult, RowCountResult } from "../../api";
import { deltaPercentageString } from "../delta";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended row data for row count diff grid
 */
export interface RowCountDiffRowData {
  name: string;
  base: number | null;
  current: number | null;
  delta: string;
}

/**
 * Extended row data for row count grid (single env)
 */
export interface RowCountRowData {
  name: string;
  current: number | null;
}

// ============================================================================
// Delta Calculation
// ============================================================================

/**
 * Calculates the delta string for row count comparison
 */
export function calculateDelta(
  base: number | null,
  current: number | null,
): string {
  if (base !== null && current !== null) {
    return base !== current ? deltaPercentageString(base, current) : "0";
  }

  if (base === current) return "N/A";
  if (base === null) return "Added";
  if (current === null) return "Removed";

  return "N/A";
}

// ============================================================================
// Data Conversion
// ============================================================================

/**
 * Converts RowCountDiffResult to DataFrame format
 *
 * @param result - The row count diff result from the backend
 * @returns DataFrame with name, base, current, and delta columns
 */
export function rowCountDiffResultToDataFrame(
  result: RowCountDiffResult,
): DataFrame {
  const entries = Object.entries(result);

  return {
    columns: [
      { key: "name", name: "Name", type: "text" },
      { key: "base", name: "Base Rows", type: "number" },
      { key: "current", name: "Current Rows", type: "number" },
      { key: "delta", name: "Delta", type: "text" },
    ],
    data: entries.map(([name, counts]) => {
      const base = typeof counts.base === "number" ? counts.base : null;
      const current = typeof counts.curr === "number" ? counts.curr : null;
      const delta = calculateDelta(base, current);

      return [name, base, current, delta];
    }),
  };
}

/**
 * Converts RowCountResult to DataFrame format
 *
 * @param result - The row count result from the backend
 * @returns DataFrame with name and current columns
 */
export function rowCountResultToDataFrame(result: RowCountResult): DataFrame {
  const entries = Object.entries(result);

  return {
    columns: [
      { key: "name", name: "Name", type: "text" },
      { key: "current", name: "Row Count", type: "number" },
    ],
    data: entries.map(([name, counts]) => {
      const current = typeof counts.curr === "number" ? counts.curr : null;
      return [name, current];
    }),
  };
}

// ============================================================================
// Row Status Determination
// ============================================================================

/**
 * Determines the diff status for a row count entry
 *
 * @param base - Base row count (null if not present)
 * @param current - Current row count (null if not present)
 * @returns Status string: "added" | "removed" | "modified" | undefined
 */
export function getRowCountDiffStatus(
  base: number | null,
  current: number | null,
): "added" | "removed" | "modified" | undefined {
  if (base === null && current !== null) return "added";
  if (base !== null && current === null) return "removed";
  if (base !== null && current !== null && base !== current) return "modified";
  return undefined;
}
