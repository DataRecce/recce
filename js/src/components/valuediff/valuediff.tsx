/**
 * @file valuediff.tsx
 * @description Value diff grid generation for joined data (with IN_A/IN_B columns)
 *
 * REFACTORED: Now uses shared utilities from @/lib/dataGrid/shared
 */

import _ from "lodash";
import { ColumnOrColumnGroup } from "react-data-grid";
import "../query/styles.css";
import React from "react";
import {
  DataFrameColumnGroupHeader,
  defaultRenderCell,
} from "@/components/ui/dataGrid";
import {
  ColumnRenderMode,
  ColumnType,
  DataFrame,
  RowObjectType,
} from "@/lib/api/types";
import {
  buildJoinedColumnMap,
  getPrimaryKeyValue,
  toDiffColumn,
  validatePrimaryKeys,
} from "@/lib/dataGrid/shared";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import {
  dataFrameToRowObjects,
  getCaseInsensitive,
  getValueAtPath,
  includesIgnoreCase,
  keyToNumber,
} from "@/utils/transforms";
import { QueryDataDiffGridOptions } from "../query/querydiff";

// ============================================================================
// Main Grid Generation Function
// ============================================================================

export function toValueDiffGrid(
  df: DataFrame,
  primaryKeys: string[],
  options?: QueryDataDiffGridOptions,
) {
  const pinnedColumns = options?.pinnedColumns ?? [];
  const changedOnly = options?.changedOnly ?? false;
  const displayMode = options?.displayMode ?? "inline";
  const columnsRenderMode = options?.columnsRenderMode ?? {};
  const transformedData = dataFrameToRowObjects(df);

  const columns: (ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  })[] = [];

  // REFACTORED: Use shared utility for column map
  const columnMap = buildJoinedColumnMap(df);

  // Build row maps based on IN_A/IN_B columns
  const baseMap: Record<string, RowObjectType | undefined> = {};
  const currentMap: Record<string, RowObjectType | undefined> = {};

  if (primaryKeys.length === 0) {
    throw new Error("Primary keys are required");
  }

  // REFACTORED: Use shared utility for PK validation
  const primaryKeyKeys = validatePrimaryKeys(df.columns, primaryKeys, true);
  const inBaseIndex = columnMap.IN_A.key;
  const inCurrentIndex = columnMap.IN_B.key;

  transformedData.forEach((row) => {
    // REFACTORED: Use shared utility for PK value generation
    const key = getPrimaryKeyValue(df.columns, primaryKeyKeys, row, true);

    if (getCaseInsensitive(row, inBaseIndex)) {
      baseMap[key.toLowerCase()] = row;
    }

    if (getCaseInsensitive(row, inCurrentIndex)) {
      currentMap[key.toLowerCase()] = row;
    }
  });

  const mergedMap = mergeKeysWithStatus(
    Object.keys(baseMap),
    Object.keys(currentMap),
  );

  const rowStats = {
    added: 0,
    removed: 0,
    modified: 0,
  };

  let rows = Object.entries(mergedMap).map(([key]) => {
    const baseRow = baseMap[key];
    const currentRow = currentMap[key];
    const row: RowObjectType = {
      _index: keyToNumber(key),
      __status: undefined,
    };

    if (baseRow) {
      df.columns.forEach((col) => {
        if (includesIgnoreCase(primaryKeys, col.key)) {
          // Add the primary key value directly (not prefixed with base__/current__)
          row[String(col.key).toLowerCase()] = baseRow[col.key];
          return;
        }
        row[`base__${col.key}`.toLowerCase()] = baseRow[col.key];
      });
    }

    if (currentRow) {
      df.columns.forEach((col) => {
        if (includesIgnoreCase(primaryKeys, col.key)) {
          // Add the primary key value directly (not prefixed with base__/current__)
          row[String(col.key).toLowerCase()] = currentRow[col.key];
          return;
        }
        row[`current__${col.key}`.toLowerCase()] = currentRow[col.key];
      });
    }

    // Check if row is added, removed, or modified
    if (!baseRow) {
      row.__status = "added";
      rowStats.added++;
    } else if (!currentRow) {
      row.__status = "removed";
      rowStats.removed++;
    } else {
      for (const [name, column] of Object.entries(columnMap)) {
        if (name === "index") {
          continue;
        }

        if (includesIgnoreCase(primaryKeys, name)) {
          continue;
        }

        if (!_.isEqual(baseRow[column.key], currentRow[column.key])) {
          row.__status = "modified";
          column.status = "modified";
        }
      }
    }

    if (row.__status === "modified") {
      rowStats.modified++;
    }

    return row;
  });

  if (changedOnly) {
    rows = rows.filter(
      (row) =>
        row.__status === "added" ||
        row.__status === "removed" ||
        row.__status === "modified",
    );
  }

  // Column builder helper
  const toColumn = (
    name: string,
    columnStatus: string,
    columnType: ColumnType,
    columnRenderMode: ColumnRenderMode = "raw",
  ) =>
    toDiffColumn({
      name,
      columnStatus,
      columnType,
      columnRenderMode,
      displayMode,
      baseTitle: options?.baseTitle,
      currentTitle: options?.currentTitle,
      headerProps: {
        primaryKeys,
        pinnedColumns: options?.pinnedColumns,
        onPinnedColumnsChange: options?.onPinnedColumnsChange,
        onColumnsRenderModeChanged: options?.onColumnsRenderModeChanged,
        // valuediff uses case-insensitive matching
        caseInsensitive: true,
      },
    });

  // Build columns: primary keys
  primaryKeys.forEach((name) => {
    const col = getValueAtPath(columnMap, name);
    if (!col) {
      throw new Error(`Primary column ${name} not found in DataFrame`);
    }
    const columnStatus = col.status ?? "";
    const columnType = col.colType;

    columns.push({
      key: name,
      name: (
        <DataFrameColumnGroupHeader
          name={name}
          columnStatus={columnStatus}
          primaryKeys={primaryKeys.map((k) => k.toLowerCase())}
          columnType={"unknown"}
          caseInsensitive
          pinnedColumns={options?.pinnedColumns}
          onPinnedColumnsChange={options?.onPinnedColumnsChange}
          onColumnsRenderModeChanged={options?.onColumnsRenderModeChanged}
        />
      ),
      frozen: true,
      cellClass: (row: RowObjectType) => {
        if (row.__status) {
          return `diff-header-${row.__status}`;
        }
        return undefined;
      },
      renderCell: defaultRenderCell,
      columnType,
      columnRenderMode: columnsRenderMode[name],
    });
  });

  // Build columns: pinned columns
  pinnedColumns.forEach((name) => {
    const col = getValueAtPath(columnMap, name);
    if (!col) {
      throw new Error(`Pinned column ${name} not found in DataFrame`);
    }
    const columnStatus = col.status ?? "";
    const columnType = col.colType;

    if (includesIgnoreCase(primaryKeys, name)) {
      return;
    }

    columns.push(
      toColumn(name, columnStatus, columnType, columnsRenderMode[name]),
    );
  });

  // Build columns: other columns (excluding IN_A/IN_B and already added)
  Object.entries(columnMap).forEach(([name, mergedColumn]) => {
    const columnStatus = mergedColumn.status ?? "";

    // Skip IN_A/IN_B columns
    if (includesIgnoreCase(["in_a", "IN_A", "in_b", "IN_B"], name)) {
      return;
    }

    if (includesIgnoreCase(primaryKeys, name)) {
      return;
    }

    if (includesIgnoreCase(pinnedColumns, name)) {
      return;
    }

    if (changedOnly && rowStats.modified > 0) {
      if (
        columnStatus !== "added" &&
        columnStatus !== "removed" &&
        columnStatus !== "modified"
      ) {
        return;
      }
    }

    columns.push(
      toColumn(
        name,
        columnStatus,
        mergedColumn.colType,
        columnsRenderMode[name],
      ),
    );
  });

  return {
    columns,
    rows,
  };
}
