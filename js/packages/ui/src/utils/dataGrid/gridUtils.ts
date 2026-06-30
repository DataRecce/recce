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
// Cell Change Detection (float-precision aware) — DRC-3025
// ============================================================================

/**
 * Relative epsilon for raw / full-precision numeric comparison.
 *
 * "Float precision is not meant to be compared." Accumulated rounding error
 * (e.g. `0.1 + 0.2 !== 0.3`) sits around 1e-16 in relative magnitude, so a
 * relative tolerance of 1e-9 swallows float noise with a wide safety margin
 * while still flagging genuine differences (a 0.5% change is ~5e6 × larger).
 */
export const FLOAT_RELATIVE_EPSILON = 1e-9;

const NUMERIC_COLUMN_TYPES: ReadonlySet<ColumnType> = new Set<ColumnType>([
  "number",
  "integer",
]);

/**
 * Number of decimal places a render mode displays on the underlying value.
 * Returns `null` for "raw" mode (full precision → relative-epsilon path).
 */
function displayedDecimals(renderMode?: ColumnRenderMode): number | null {
  if (renderMode === "raw") return null;
  if (typeof renderMode === "number") return renderMode;
  // "percent" shows up to 2 fraction digits of value × 100, i.e. 2 extra
  // decimals on the underlying fraction (12.34% ≈ 0.1234).
  if (renderMode === "percent") return 4;
  // "delta" and the default both format with smart 2-decimal rounding.
  return 2;
}

/**
 * Coerces a cell value to a finite number when the column is numeric.
 * Returns `null` for nullish, NaN, non-finite, or non-numeric values so the
 * caller can fall back to exact equality.
 */
function toComparableNumber(
  value: unknown,
  columnType?: ColumnType,
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (
    typeof value === "string" &&
    columnType != null &&
    NUMERIC_COLUMN_TYPES.has(columnType)
  ) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function numericChanged(
  base: number,
  current: number,
  renderMode?: ColumnRenderMode,
): boolean {
  const decimals = displayedDecimals(renderMode);

  // Raw / full-precision: relative epsilon. Raw mode must NOT resurrect the
  // spurious float-noise diff.
  if (decimals === null) {
    return (
      Math.abs(base - current) >
      FLOAT_RELATIVE_EPSILON * Math.max(Math.abs(base), Math.abs(current), 1)
    );
  }

  // Formatted: compare at ONE digit below displayed precision, so two values
  // that merely *display* the same (e.g. both shown as "3") are not assumed
  // equal — the extra digit is the discriminator.
  const factor = 10 ** (decimals + 1);
  return Math.round(base * factor) !== Math.round(current * factor);
}

/**
 * Single source of truth for "did this cell change?" across the data grid.
 *
 * - Numeric cells use float-precision-aware comparison:
 *   - formatted modes (N decimals / percent / delta / default) compare at
 *     N + 1 decimals — float noise below the visible precision is ignored,
 *     but a real change one digit below the display is still caught.
 *   - raw mode uses a relative epsilon ({@link FLOAT_RELATIVE_EPSILON}).
 * - Non-numeric cells keep exact (`_.isEqual`) equality.
 * - One-sided null/undefined (and NaN-vs-number) counts as changed.
 *
 * @param base       Base cell value
 * @param current    Current cell value
 * @param columnType Column data type (drives numeric-string coercion)
 * @param renderMode Active column render mode (drives compared precision)
 */
export function isCellChanged(
  base: unknown,
  current: unknown,
  columnType?: ColumnType,
  renderMode?: ColumnRenderMode,
): boolean {
  const baseNullish = base === null || base === undefined;
  const currentNullish = current === null || current === undefined;
  if (baseNullish || currentNullish) {
    // Changed unless BOTH sides are nullish.
    return !(baseNullish && currentNullish);
  }

  const baseNum = toComparableNumber(base, columnType);
  const currentNum = toComparableNumber(current, columnType);

  if (baseNum !== null && currentNum !== null) {
    return numericChanged(baseNum, currentNum, renderMode);
  }

  // Non-numeric, mixed-type, or NaN on one side → exact equality.
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
 *
 * @param columnRenderModes Optional per-column render modes (keyed by column
 *   name or key), used for float-precision-aware change detection. When a
 *   column has no entry, the default formatted (2-decimal) tolerance applies.
 */
export function determineRowStatus(
  baseRow: RowObjectType | undefined,
  currentRow: RowObjectType | undefined,
  columnMap: Record<string, ColumnMapEntry>,
  primaryKeys: string[],
  columnRenderModes?: Record<string, ColumnRenderMode>,
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

    const renderMode =
      columnRenderModes?.[name] ?? columnRenderModes?.[column.key];

    if (isCellChanged(baseVal, currentVal, column.colType, renderMode)) {
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
    if (columnType === "number") {
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
 *
 * @param columnRenderMode Active render mode for the column (drives
 *   float-precision-aware change detection). Defaults to formatted 2-decimal
 *   tolerance when omitted.
 * @param columnType Column data type (drives numeric-string coercion).
 */
export function getCellClass(
  row: RowObjectType,
  columnStatus: string | undefined,
  columnKey: string,
  isBase: boolean,
  columnRenderMode?: ColumnRenderMode,
  columnType?: ColumnType,
): string | undefined {
  const rowStatus = row.__status;

  if (rowStatus === "removed") return "diff-cell-removed";
  if (rowStatus === "added") return "diff-cell-added";
  if (columnStatus === "added" || columnStatus === "removed") return undefined;

  const baseKey = `base__${columnKey}`.toLowerCase();
  const currentKey = `current__${columnKey}`.toLowerCase();

  if (
    isCellChanged(row[baseKey], row[currentKey], columnType, columnRenderMode)
  ) {
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
