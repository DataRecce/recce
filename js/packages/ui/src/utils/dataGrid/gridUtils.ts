/**
 * @file gridUtils.ts
 * @description Shared utilities for data grid generation
 *
 * This module contains common functions used across all grid generation methods.
 */

import _ from "lodash";
import type {
  ColumnRenderMode,
  ColumnType,
  DataFrame,
  RowObjectType,
} from "../../api/types";
import { formatNumber } from "../formatters";
import { mergeKeysWithStatus } from "../mergeKeys";
import { getCaseInsensitive } from "../transforms";

// ============================================================================
// Types
// ============================================================================

export interface ColumnMapEntry {
  key: string;
  colType: ColumnType;
  status?: string;
  index?: number;
}

export interface MergeColumnMapEntry extends ColumnMapEntry {
  baseColumnKey: string;
  currentColumnKey: string;
}

export interface RowStats {
  added: number;
  removed: number;
  modified: number;
}

// ============================================================================
// Column Map Builders
// ============================================================================

/**
 * Builds a column map from a single DataFrame
 */
export function buildColumnMap(df: DataFrame): Record<string, ColumnMapEntry> {
  const result: Record<string, ColumnMapEntry> = {};
  df.columns.forEach((col, index) => {
    result[col.name] = {
      key: col.key,
      index,
      colType: col.type,
    };
  });
  return result;
}

/**
 * Builds a column map for joined data (with in_a/in_b columns)
 *
 * NOTE: Backend now guarantees in_a/in_b are always lowercase,
 * so we only need to register them as-is.
 *
 * @throws {Error} If required in_a or in_b columns are missing
 */
export function buildJoinedColumnMap(
  df: DataFrame,
): Record<string, ColumnMapEntry> {
  const result: Record<string, ColumnMapEntry> = {};

  df.columns.forEach((col, index) => {
    result[col.key] = {
      key: col.key,
      index,
      colType: col.type,
    };
  });

  // Verify required columns exist (while backend guarantees "in_a" and "in_b" as lowercase, we need to verify their presence)
  if (!result.in_a) {
    throw new Error("Joined DataFrame missing required 'in_a' column");
  }
  if (!result.in_b) {
    throw new Error("Joined DataFrame missing required 'in_b' column");
  }

  return result;
}

/**
 * Builds a merged column map from two DataFrames
 * Tracks status (added/removed/unchanged) for each column
 */
export function buildMergedColumnMap(
  base: DataFrame,
  current: DataFrame,
): Record<string, MergeColumnMapEntry> {
  const result: Record<string, MergeColumnMapEntry> = {};

  const mapStatus = mergeKeysWithStatus(
    base.columns.map((col) => col.key),
    current.columns.map((col) => col.key),
  ) as Record<string, string>;

  Object.entries(mapStatus).forEach(([key, status]) => {
    const baseColumn = base.columns.find((c) => c.key === key);
    const currentColumn = current.columns.find((c) => c.key === key);
    result[key] = {
      status,
      baseColumnKey: baseColumn?.key ?? "unknown",
      currentColumnKey: currentColumn?.key ?? "unknown",
      colType: baseColumn?.type ?? currentColumn?.type ?? "unknown",
      key: baseColumn?.key ?? currentColumn?.key ?? "unknown",
    };
  });

  return result;
}

// ============================================================================
// Primary Key Utilities
// ============================================================================

/**
 * Validates that all primary keys exist in the columns (exact matching)
 */
export function validatePrimaryKeys(
  columns: DataFrame["columns"],
  primaryKeys: string[],
): string[] {
  const keys: string[] = [];
  for (const key of primaryKeys) {
    const found = columns.find((col) => col.key === key);

    if (!found) {
      throw new Error(`Column ${key} not found`);
    }
    keys.push(found.key);
  }
  return keys;
}

/**
 * Generates a unique key string from primary key values in a row (exact matching)
 */
export function getPrimaryKeyValue(
  columns: DataFrame["columns"],
  primaryKeys: string[],
  row: RowObjectType,
): string {
  if (primaryKeys.length === 0) {
    return String(row._index);
  }

  const result: string[] = [];
  for (const key of primaryKeys) {
    const col = columns.find((c) => c.key === key);

    if (!col) {
      throw new Error(`Primary Column ${key} not found`);
    }

    const value = row[key];
    result.push(`${col.name}=${value}`);
  }
  return result.join("|");
}

// ============================================================================
// Cell Change Detection (DRC-3025: type-dispatched comparison)
// ============================================================================

/**
 * Relative tolerance for comparing two approximate floats. Genuine DOUBLE
 * columns and computed profile aggregates (avg/median/proportions) carry
 * IEEE-754 rounding noise on the order of 1e-15..1e-16 in relative magnitude, so
 * a relative tolerance of 1e-9 swallows that noise with a wide safety margin
 * while still flagging genuine differences (a 0.5% change is ~5e6 × larger).
 *
 * Module-private: consumed only by {@link floatComparator}. Not exported.
 */
const FLOAT_RELATIVE_EPSILON = 1e-9;

/**
 * Absolute floor for the both-near-zero case. When `max(|a|, |b|)` is ~0 the
 * relative threshold collapses toward zero, so we floor it here: differences at
 * or below 1e-12 near zero read as float noise, while a real small value (e.g.
 * `0` vs `1e-3`) still reads as changed.
 */
const FLOAT_ABSOLUTE_FLOOR = 1e-12;

/** True when two finite numbers are equal within the magnitude-relative epsilon. */
function withinFloatEpsilon(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return diff <= Math.max(FLOAT_RELATIVE_EPSILON * scale, FLOAT_ABSOLUTE_FLOOR);
}

/**
 * `_.isEqualWith` customizer applying the magnitude-relative epsilon at every
 * numeric leaf of a FLOAT-typed cell.
 *
 * Numeric values arrive from the backend as exact strings (agate flattens
 * DECIMAL and DOUBLE alike to strings — DRC-3025), so the two float cases are:
 * - Two numeric STRINGS (the top-level cell value) → `parseFloat` both and
 *   compare within epsilon. Lossless at aggregate magnitudes.
 * - Two finite NUMBERS (floats nested inside a JSON/ARRAY/STRUCT cell, already
 *   parsed) → compare within epsilon directly.
 *
 * Everything else → `undefined`, deferring to lodash's default deep-equal, which
 * recurses into objects/arrays and re-invokes this customizer at each nested
 * value. Non-numeric strings, booleans, mixed types, one-sided null/undefined,
 * and NaN therefore keep exact equality.
 */
function floatComparator(base: unknown, current: unknown): boolean | undefined {
  if (
    typeof base === "number" &&
    typeof current === "number" &&
    Number.isFinite(base) &&
    Number.isFinite(current)
  ) {
    return withinFloatEpsilon(base, current);
  }

  if (typeof base === "string" && typeof current === "string") {
    const b = parseFloat(base);
    const c = parseFloat(current);
    if (Number.isFinite(b) && Number.isFinite(c)) {
      return withinFloatEpsilon(b, c);
    }
  }

  // Non-numeric, mixed-type, nullish, or NaN → defer to lodash deep-equal.
  return undefined;
}

/**
 * Single source of truth for "did this cell change?" across the data grid.
 *
 * Dispatches on the column's comparison type:
 * - `"float"` (approximate: DOUBLE/FLOAT data columns and computed profile
 *   aggregates) → one deep traversal via `_.isEqualWith` with
 *   {@link floatComparator}, so float precision is never compared — top-level
 *   numeric strings and floats nested inside JSON/ARRAY/STRUCT cells alike.
 * - everything else (`"number"`/decimal, `"integer"`, `"text"`, …, or an
 *   unknown/absent type) → exact deep-equal. A DECIMAL column is `"number"`, so
 *   a 1-cent change is never float-collapsed (the cycle-4 guard).
 *
 * @param base    Base cell value
 * @param current Current cell value
 * @param colType Column comparison type; only `"float"` enables the epsilon
 */
export function isCellChanged(
  base: unknown,
  current: unknown,
  colType?: ColumnType,
): boolean {
  if (colType === "float") {
    return !_.isEqualWith(base, current, floatComparator);
  }
  return !_.isEqual(base, current);
}

// ============================================================================
// Row Status Detection
// ============================================================================

/**
 * Determines the status of a row (added/removed/modified/unchanged)
 *
 * Supports two modes:
 * 1. Separate rows: baseRow and currentRow are different objects
 * 2. Merged rows: baseRow === currentRow, with values stored as base__key and current__key
 */
export function determineRowStatus(
  baseRow: RowObjectType | undefined,
  currentRow: RowObjectType | undefined,
  columnMap: Record<string, ColumnMapEntry>,
  primaryKeys: string[],
): "added" | "removed" | "modified" | undefined {
  if (!baseRow) return "added";
  if (!currentRow) return "removed";

  // Check if this is a merged row (same object passed for both)
  const isMergedRow = baseRow === currentRow;

  // Check for modifications in non-PK columns
  for (const [name, column] of Object.entries(columnMap)) {
    if (name === "index") continue;

    if (primaryKeys.includes(name)) continue;

    let baseVal: unknown;
    let currentVal: unknown;

    if (isMergedRow) {
      // Merged row: compare base__key vs current__key
      const baseKey = `base__${column.key}`;
      const currentKey = `current__${column.key}`;
      baseVal = baseRow[baseKey];
      currentVal = currentRow[currentKey];
    } else {
      // Separate rows: compare same key in different row objects
      baseVal = baseRow[column.key];
      currentVal = currentRow[column.key];
    }

    if (isCellChanged(baseVal, currentVal, column.colType)) {
      return "modified";
    }
  }

  return undefined;
}

// ============================================================================
// Value Rendering Utilities
// ============================================================================

/**
 * Formats a numeric value based on render mode
 *
 * Handles special values:
 * - NaN: Returns "NaN" (no formatting applied)
 * - Infinity: Returns "∞" or "-∞" (no formatting applied)
 */
/**
 * Formats a number with up to maxDecimals decimal places, without trailing zeros
 * Uses banker's rounding (round half to even) for unbiased rounding.
 *
 * e.g., formatSmartDecimal(123, 2) => "123"
 *       formatSmartDecimal(123.4, 2) => "123.4"
 *       formatSmartDecimal(123.456, 2) => "123.46"
 *       formatSmartDecimal(123.445, 2) => "123.44" (banker's rounding)
 */
export function formatSmartDecimal(value: number, maxDecimals = 2): string {
  // Normalize -0 to 0 (Intl.NumberFormat renders -0 as "-0" per ECMA-402)
  const normalizedValue = Object.is(value, -0) ? 0 : value;

  const result =
    formatNumber(normalizedValue, "en-US", {
      maximumFractionDigits: maxDecimals,
      roundingMode: "halfEven",
    } as Intl.NumberFormatOptions) ?? String(value);

  // Normalize "-0" to "0" (can happen when small negative numbers round to zero)
  return result === "-0" ? "0" : result;
}

export function columnRenderedValue(
  value: number,
  renderMode?: ColumnRenderMode,
): string {
  // Handle special numeric values first
  if (Number.isNaN(value)) {
    return "NaN";
  }

  if (!Number.isFinite(value)) {
    return value > 0 ? "∞" : "-∞";
  }

  const locale = "en-US";

  if (renderMode === "raw") {
    return String(value);
  }

  if (typeof renderMode === "number") {
    // Smart formatting: up to N decimals, no trailing zeros
    return formatSmartDecimal(value, renderMode);
  }

  if (renderMode === "percent") {
    return (
      formatNumber(value, locale, {
        style: "percent",
        maximumFractionDigits: 2,
      }) ?? String(value)
    );
  }

  // Default: smart 2-decimal formatting
  return formatSmartDecimal(value, 2);
}

/**
 * Converts a row value to a rendered string with gray-out indicator
 */
export function toRenderedValue(
  row: RowObjectType,
  key: string,
  columnType?: ColumnType,
  columnRenderMode?: ColumnRenderMode,
): [string, boolean] {
  const value = getCaseInsensitive(row, key);

  if (value == null) {
    return ["-", true];
  }

  let renderedValue: string;
  let grayOut = false;

  // noinspection SuspiciousTypeOfGuard
  if (typeof value === "boolean") {
    // workaround for https://github.com/adazzle/react-data-grid/issues/882
    renderedValue = value.toString();
  } else if (value === "") {
    renderedValue = "(empty)";
    grayOut = true;
  } else if (typeof value === "number") {
    renderedValue = columnRenderedValue(value, columnRenderMode);
  } else {
    if (columnType === "number" || columnType === "float") {
      renderedValue = columnRenderedValue(parseFloat(value), columnRenderMode);
    } else {
      renderedValue = String(value);
    }
  }

  return [renderedValue, grayOut];
}

// ============================================================================
// Cell Class Utilities
// ============================================================================

/**
 * Gets the CSS class for a cell based on row and column status
 */
export function getCellClass(
  row: RowObjectType,
  columnStatus: string | undefined,
  columnKey: string,
  isBase: boolean,
  colType?: ColumnType,
): string | undefined {
  const rowStatus = row.__status;

  if (rowStatus === "removed") return "diff-cell-removed";
  if (rowStatus === "added") return "diff-cell-added";
  if (columnStatus === "added" || columnStatus === "removed") return undefined;

  const baseKey = `base__${columnKey}`.toLowerCase();
  const currentKey = `current__${columnKey}`.toLowerCase();

  if (isCellChanged(row[baseKey], row[currentKey], colType)) {
    return isBase ? "diff-cell-removed" : "diff-cell-added";
  }

  return undefined;
}

/**
 * Gets the CSS class for a header cell based on column status
 */
export function getHeaderCellClass(
  columnStatus: string | undefined,
): string | undefined {
  if (columnStatus === "added") return "diff-header-added";
  if (columnStatus === "removed") return "diff-header-removed";
  return undefined;
}
