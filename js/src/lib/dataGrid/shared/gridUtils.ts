/**
 * @file gridUtils.ts
 * @description Shared utilities for data grid generation
 *
 * This module contains common functions used across all grid generation methods.
 */

import _ from "lodash";
import {
  ColumnRenderMode,
  ColumnType,
  DataFrame,
  RowObjectType,
} from "@/lib/api/types";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { formatNumber } from "@/utils/formatters";
import { getCaseInsensitive, includesIgnoreCase } from "@/utils/transforms";

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
 * Builds a column map for joined data (with IN_A/IN_B columns)
 * Handles case-insensitivity for special columns
 */
export function buildJoinedColumnMap(
  df: DataFrame,
): Record<string, ColumnMapEntry> {
  const result: Record<string, ColumnMapEntry> = {};
  df.columns.forEach((col, index) => {
    // Handle IN_A/IN_B specially for case-insensitive matching
    if (
      col.name.toLowerCase() === "in_a" ||
      col.name.toLowerCase() === "in_b"
    ) {
      result[col.name.toUpperCase()] = {
        key: col.key,
        index,
        colType: col.type,
      };
      result[col.name.toLowerCase()] = {
        key: col.key,
        index,
        colType: col.type,
      };
    } else {
      result[col.name] = { key: col.key, index, colType: col.type };
    }
  });
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
 * Validates that all primary keys exist in the columns
 */
export function validatePrimaryKeys(
  columns: DataFrame["columns"],
  primaryKeys: string[],
  caseInsensitive = false,
): string[] {
  const keys: string[] = [];
  for (const key of primaryKeys) {
    const found = caseInsensitive
      ? columns.find((col) => includesIgnoreCase([col.key], key))
      : columns.find((col) => col.key === key);

    if (!found) {
      throw new Error(`Column ${key} not found`);
    }
    keys.push(found.key);
  }
  return keys;
}

/**
 * Generates a unique key string from primary key values in a row
 */
export function getPrimaryKeyValue(
  columns: DataFrame["columns"],
  primaryKeys: string[],
  row: RowObjectType,
  caseInsensitive = false,
): string {
  if (primaryKeys.length === 0) {
    return String(row._index);
  }

  const result: string[] = [];
  for (const key of primaryKeys) {
    const col = caseInsensitive
      ? columns.find((c) => includesIgnoreCase([c.key], key))
      : columns.find((c) => c.key === key);

    if (!col) {
      throw new Error(`Primary Column ${key} not found`);
    }

    const value = caseInsensitive
      ? (getCaseInsensitive(row, key) ?? "")
      : row[key];

    result.push(`${col.name}=${value}`);
  }
  return result.join("|");
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
  caseInsensitive = false,
): "added" | "removed" | "modified" | undefined {
  if (!baseRow) return "added";
  if (!currentRow) return "removed";

  // Check if this is a merged row (same object passed for both)
  const isMergedRow = baseRow === currentRow;

  // Check for modifications in non-PK columns
  for (const [name, column] of Object.entries(columnMap)) {
    if (name === "index") continue;

    const isPK = caseInsensitive
      ? includesIgnoreCase(primaryKeys, name)
      : primaryKeys.includes(name);

    if (isPK) continue;

    let baseVal: unknown;
    let currentVal: unknown;

    if (isMergedRow) {
      // Merged row: compare base__key vs current__key
      const baseKey = `base__${column.key}`;
      const currentKey = `current__${column.key}`;

      baseVal = caseInsensitive
        ? getCaseInsensitive(baseRow, baseKey)
        : baseRow[baseKey];
      currentVal = caseInsensitive
        ? getCaseInsensitive(currentRow, currentKey)
        : currentRow[currentKey];
    } else {
      // Separate rows: compare same key in different row objects
      baseVal = caseInsensitive
        ? getCaseInsensitive(baseRow, column.key)
        : baseRow[column.key];
      currentVal = caseInsensitive
        ? getCaseInsensitive(currentRow, column.key)
        : currentRow[column.key];
    }

    if (!_.isEqual(baseVal, currentVal)) {
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
export function columnRenderedValue(
  value: number,
  renderMode: ColumnRenderMode,
): string {
  // Handle special numeric values first
  if (Number.isNaN(value)) {
    return "NaN";
  }

  if (!Number.isFinite(value)) {
    return value > 0 ? "∞" : "-∞";
  }

  const locale = "en-US";

  if (typeof renderMode === "number") {
    return (
      formatNumber(value, locale, {
        maximumFractionDigits: renderMode,
        minimumFractionDigits: renderMode,
      }) ?? String(value)
    );
  }

  if (renderMode === "percent") {
    return (
      formatNumber(value, locale, {
        style: "percent",
        maximumFractionDigits: 2,
      }) ?? String(value)
    );
  }

  return String(value);
}

/**
 * Converts a row value to a rendered string with gray-out indicator
 */
export function toRenderedValue(
  row: RowObjectType,
  key: string,
  columnType?: ColumnType,
  columnRenderMode: ColumnRenderMode = "raw",
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
 */
export function getCellClass(
  row: RowObjectType,
  columnStatus: string | undefined,
  columnKey: string,
  isBase: boolean,
): string | undefined {
  const rowStatus = row.__status;

  if (rowStatus === "removed") return "diff-cell-removed";
  if (rowStatus === "added") return "diff-cell-added";
  if (columnStatus === "added" || columnStatus === "removed") return undefined;

  const baseKey = `base__${columnKey}`.toLowerCase();
  const currentKey = `current__${columnKey}`.toLowerCase();

  if (!_.isEqual(row[baseKey], row[currentKey])) {
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
