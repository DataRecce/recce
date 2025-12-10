/**
 * @file rowBuilders.ts
 * @description Shared row building utilities for diff grids
 *
 * Provides unified row generation logic for both querydiff (dual DataFrames)
 * and valuediff (joined DataFrame with in_a/in_b) scenarios.
 */

import _ from "lodash";
import { DataFrame, RowObjectType } from "@/lib/api/types";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { includesIgnoreCase, keyToNumber } from "@/utils/transforms";
import { ColumnMapEntry, MergeColumnMapEntry, RowStats } from "./gridUtils";

// ============================================================================
// Types
// ============================================================================

/**
 * Union type for column map entries (supports both querydiff and valuediff)
 */
export type DiffColumnMapEntry = ColumnMapEntry | MergeColumnMapEntry;

/**
 * Type guard to check if entry is a MergeColumnMapEntry (has separate base/current keys)
 */
function isMergeColumnMapEntry(
  entry: DiffColumnMapEntry,
): entry is MergeColumnMapEntry {
  return "baseColumnKey" in entry && "currentColumnKey" in entry;
}

/**
 * Configuration for building diff rows
 */
export interface BuildDiffRowsConfig {
  /**
   * Map of primary key values to base row data
   * Keys should already be normalized (e.g., lowercased if case-insensitive)
   */
  baseMap: Record<string, RowObjectType | undefined>;

  /**
   * Map of primary key values to current row data
   * Keys should already be normalized (e.g., lowercased if case-insensitive)
   */
  currentMap: Record<string, RowObjectType | undefined>;

  /**
   * Column definitions for base data
   * Used to iterate and extract values from base rows
   */
  baseColumns: DataFrame["columns"];

  /**
   * Column definitions for current data
   * Used to iterate and extract values from current rows
   * For joined data (valuediff), this is the same as baseColumns
   */
  currentColumns: DataFrame["columns"];

  /**
   * Column map for tracking column metadata and status
   * This object WILL BE MUTATED to update column.status when modifications are detected
   */
  columnMap: Record<string, DiffColumnMapEntry>;

  /**
   * List of primary key column names
   * These columns are stored directly on the row (not prefixed with base__/current__)
   */
  primaryKeys: string[];

  /**
   * Whether to use case-insensitive matching for column names and primary keys
   * - false (default): querydiff behavior (exact matching)
   * - true: valuediff behavior (case-insensitive)
   */
  caseInsensitive?: boolean;

  /**
   * Whether to filter out unchanged rows
   * When true, only rows with status "added", "removed", or "modified" are returned
   */
  changedOnly?: boolean;
}

/**
 * Result from building diff rows
 */
export interface BuildDiffRowsResult {
  /** The generated rows with __status and prefixed column values */
  rows: RowObjectType[];

  /** Statistics about row changes */
  rowStats: RowStats;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a column name is a primary key
 */
function isPrimaryKey(
  columnName: string,
  primaryKeys: string[],
  caseInsensitive: boolean,
): boolean {
  return caseInsensitive
    ? includesIgnoreCase(primaryKeys, columnName)
    : primaryKeys.includes(columnName);
}

/**
 * Gets the column key to use for value comparison
 * For MergeColumnMapEntry, uses baseColumnKey/currentColumnKey
 * For ColumnMapEntry, uses the single key
 */
function getComparisonKeys(entry: DiffColumnMapEntry): {
  baseKey: string;
  currentKey: string;
} {
  if (isMergeColumnMapEntry(entry)) {
    return {
      baseKey: entry.baseColumnKey,
      currentKey: entry.currentColumnKey,
    };
  }
  return {
    baseKey: entry.key,
    currentKey: entry.key,
  };
}

/**
 * Populates row values from a source row for the given columns
 *
 * @param targetRow - The row object to populate
 * @param sourceRow - The source row to extract values from
 * @param columns - Column definitions to iterate
 * @param prefix - Prefix to add to column keys (e.g., "base__" or "current__")
 * @param primaryKeys - Primary key column names (stored without prefix)
 * @param caseInsensitive - Whether to use case-insensitive matching
 */
function populateRowValues(
  targetRow: RowObjectType,
  sourceRow: RowObjectType,
  columns: DataFrame["columns"],
  prefix: string,
  primaryKeys: string[],
  caseInsensitive: boolean,
): void {
  columns.forEach((col) => {
    const colKey = col.key;
    const isPK = isPrimaryKey(colKey, primaryKeys, caseInsensitive);

    if (isPK) {
      // Primary keys stored directly (not prefixed)
      targetRow[String(colKey).toLowerCase()] = sourceRow[colKey];
    } else {
      // Non-PK columns are prefixed
      targetRow[`${prefix}${colKey}`.toLowerCase()] = sourceRow[colKey];
    }
  });
}

/**
 * Detects if a row has been modified by comparing base and current values
 * Also mutates columnMap entries to mark modified columns
 *
 * @returns true if any non-PK column value differs
 */
function detectModifications(
  baseRow: RowObjectType,
  currentRow: RowObjectType,
  columnMap: Record<string, DiffColumnMapEntry>,
  primaryKeys: string[],
  caseInsensitive: boolean,
): boolean {
  let isModified = false;

  for (const [name, column] of Object.entries(columnMap)) {
    // Skip index column
    if (name === "index") continue;

    // Skip primary key columns
    if (isPrimaryKey(name, primaryKeys, caseInsensitive)) continue;

    const { baseKey, currentKey } = getComparisonKeys(column);

    // Skip if either key is unknown (column added/removed in schema)
    if (baseKey === "unknown" || currentKey === "unknown") continue;

    const baseValue = baseRow[baseKey];
    const currentValue = currentRow[currentKey];

    if (!_.isEqual(baseValue, currentValue)) {
      isModified = true;
      // Mutate column status to track which columns have modifications
      column.status = "modified";
    }
  }

  return isModified;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Builds diff rows from base and current row maps
 *
 * @description This function unifies the row generation logic from both
 * `toDataDiffGrid` (querydiff) and `toValueDiffGrid` (valuediff).
 *
 * Key behaviors:
 * - Merges base and current row keys to determine all unique rows
 * - Creates row objects with `_index` and `__status` fields
 * - Prefixes non-PK columns with `base__` or `current__` (lowercased)
 * - Stores PK columns directly without prefix
 * - Detects added/removed/modified status
 * - Mutates columnMap to mark modified columns
 * - Optionally filters to changed rows only
 *
 * @example
 * ```typescript
 * // For querydiff (two separate DataFrames)
 * const result = buildDiffRows({
 *   baseMap,
 *   currentMap,
 *   baseColumns: base.columns,
 *   currentColumns: current.columns,
 *   columnMap: mergedColumnMap,
 *   primaryKeys: ["id"],
 *   caseInsensitive: false,
 *   changedOnly: false,
 * });
 *
 * // For valuediff (joined DataFrame)
 * const result = buildDiffRows({
 *   baseMap,
 *   currentMap,
 *   baseColumns: df.columns,
 *   currentColumns: df.columns, // Same columns for both
 *   columnMap: joinedColumnMap,
 *   primaryKeys: ["id"],
 *   caseInsensitive: true,
 *   changedOnly: true,
 * });
 * ```
 */
export function buildDiffRows(
  config: BuildDiffRowsConfig,
): BuildDiffRowsResult {
  const {
    baseMap,
    currentMap,
    baseColumns,
    currentColumns,
    columnMap,
    primaryKeys,
    caseInsensitive = false,
    changedOnly = false,
  } = config;

  // Merge base and current keys to get all unique row identifiers
  const mergedMap = mergeKeysWithStatus(
    Object.keys(baseMap),
    Object.keys(currentMap),
  );

  const rowStats: RowStats = {
    added: 0,
    removed: 0,
    modified: 0,
  };

  // Build rows from merged keys
  let rows = Object.entries(mergedMap).map(([key]) => {
    const baseRow = baseMap[key];
    const currentRow = currentMap[key];

    // Initialize row with index and undefined status
    const row: RowObjectType = {
      _index: keyToNumber(key),
      __status: undefined,
    };

    // Populate base values
    if (baseRow) {
      populateRowValues(
        row,
        baseRow,
        baseColumns,
        "base__",
        primaryKeys,
        caseInsensitive,
      );
    }

    // Populate current values
    if (currentRow) {
      populateRowValues(
        row,
        currentRow,
        currentColumns,
        "current__",
        primaryKeys,
        caseInsensitive,
      );
    }

    // Determine row status
    if (!baseRow) {
      row.__status = "added";
      rowStats.added++;
    } else if (!currentRow) {
      row.__status = "removed";
      rowStats.removed++;
    } else {
      // Both rows exist - check for modifications
      const isModified = detectModifications(
        baseRow,
        currentRow,
        columnMap,
        primaryKeys,
        caseInsensitive,
      );

      if (isModified) {
        row.__status = "modified";
        rowStats.modified++;
      }
    }

    return row;
  });

  // Filter to changed rows if requested
  if (changedOnly) {
    rows = rows.filter(
      (row) =>
        row.__status === "added" ||
        row.__status === "removed" ||
        row.__status === "modified",
    );
  }

  return { rows, rowStats };
}
