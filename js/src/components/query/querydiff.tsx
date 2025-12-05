/**
 * @file querydiff.tsx
 * @description Query diff grid generation and rendering components
 *
 * REFACTORED: Now uses shared utilities from @/lib/dataGrid/shared
 */

import _ from "lodash";
import React from "react";
import { ColumnOrColumnGroup } from "react-data-grid";
import "./styles.css";
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
  buildMergedColumnMap,
  getPrimaryKeyValue,
  toDiffColumn,
  validatePrimaryKeys,
} from "@/lib/dataGrid/shared";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { dataFrameToRowObjects, keyToNumber } from "@/utils/transforms";

// ============================================================================
// Types
// ============================================================================

export interface QueryDataDiffGridOptions {
  primaryKeys?: string[];
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  pinnedColumns?: string[];
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  columnsRenderMode?: Record<string, ColumnRenderMode>;
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
  changedOnly?: boolean;
  baseTitle?: string;
  currentTitle?: string;
  displayMode?: "side_by_side" | "inline";
}

// ============================================================================
// Main Grid Generation Function
// ============================================================================

export function toDataDiffGrid(
  _base?: DataFrame,
  _current?: DataFrame,
  options?: QueryDataDiffGridOptions,
) {
  const base = _base ?? { columns: [], data: [] };
  const current = _current ?? { columns: [], data: [] };
  const primaryKeys = options?.primaryKeys ?? [];
  const pinnedColumns = options?.pinnedColumns ?? [];
  const changedOnly = options?.changedOnly ?? false;
  const displayMode = options?.displayMode ?? "side_by_side";
  const columnsRenderMode = options?.columnsRenderMode ?? {};

  const baseData = dataFrameToRowObjects(base);
  const currentData = dataFrameToRowObjects(current);

  const columns: (ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  })[] = [];

  // REFACTORED: Use shared utility
  const columnMap = buildMergedColumnMap(base, current);

  // Build row maps indexed by primary key
  const baseMap: Record<string, RowObjectType> = {};
  const currentMap: Record<string, RowObjectType> = {};
  let invalidPKeyBase = false;
  let invalidPKeyCurrent = false;

  if (primaryKeys.length === 0) {
    baseData.forEach((row) => {
      baseMap[String(row._index)] = row;
    });
    currentData.forEach((row) => {
      currentMap[String(row._index)] = row;
    });
  } else {
    // REFACTORED: Use shared utility
    const basePKKeys = validatePrimaryKeys(base.columns, primaryKeys, false);
    baseData.forEach((row) => {
      const key = getPrimaryKeyValue(base.columns, basePKKeys, row, false);
      if (key in baseMap) {
        invalidPKeyBase = true;
      }
      baseMap[key] = row;
    });

    const currentPKKeys = validatePrimaryKeys(
      current.columns,
      primaryKeys,
      false,
    );
    currentData.forEach((row) => {
      const key = getPrimaryKeyValue(
        current.columns,
        currentPKKeys,
        row,
        false,
      );
      if (key in currentMap) {
        invalidPKeyCurrent = true;
      }
      currentMap[key] = row;
    });
  }

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
    const baseRow = baseMap[key] as RowObjectType | undefined;
    const currentRow = currentMap[key] as RowObjectType | undefined;
    const row: RowObjectType = {
      _index: keyToNumber(key),
      __status: undefined,
    };

    if (baseRow) {
      base.columns.forEach((col) => {
        if (primaryKeys.includes(col.key)) {
          row[String(col.key).toLowerCase()] = baseRow[col.key];
          return;
        }
        row[`base__${col.key}`.toLowerCase()] = baseRow[col.key];
      });
    }

    if (currentRow) {
      current.columns.forEach((col) => {
        if (primaryKeys.includes(col.key)) {
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
      for (const [name, mergedColumn] of Object.entries(columnMap)) {
        if (name === "index") {
          continue;
        }

        if (primaryKeys.includes(name)) {
          continue;
        }

        if (
          mergedColumn.baseColumnKey === "unknown" ||
          mergedColumn.currentColumnKey === "unknown"
        ) {
          continue;
        }

        if (
          !_.isEqual(
            baseRow[mergedColumn.baseColumnKey],
            currentRow[mergedColumn.currentColumnKey],
          )
        ) {
          row.__status = "modified";
          mergedColumn.status = "modified";
        }
      }
      if (row.__status === "modified") {
        rowStats.modified++;
      }
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
        primaryKeys: options?.primaryKeys,
        pinnedColumns: options?.pinnedColumns,
        onPrimaryKeyChange: options?.onPrimaryKeyChange,
        onPinnedColumnsChange: options?.onPinnedColumnsChange,
        onColumnsRenderModeChanged: options?.onColumnsRenderModeChanged,
        // querydiff uses exact matching (not case-insensitive)
        caseInsensitive: false,
      },
    });

  // Build columns: primary keys or index
  if (primaryKeys.length === 0) {
    columns.push({
      key: "_index",
      width: 50,
      maxWidth: 100,
      name: "",
      cellClass: "index-column",
    });
  } else {
    primaryKeys.forEach((name) => {
      const columnStatus = columnMap[name]?.status ?? "";
      const columnType = columnMap[name]?.colType ?? "unknown";

      columns.push({
        key: name,
        name: (
          <DataFrameColumnGroupHeader
            name={name}
            columnStatus={columnStatus}
            columnType={columnType}
            primaryKeys={options?.primaryKeys}
            pinnedColumns={options?.pinnedColumns}
            onPrimaryKeyChange={options?.onPrimaryKeyChange}
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
  }

  // Build columns: pinned columns
  pinnedColumns.forEach((name) => {
    const columnStatus = columnMap[name]?.status ?? "";
    const columnType = columnMap[name]?.colType ?? "unknown";

    if (name === "index") {
      return;
    }

    if (primaryKeys.includes(name)) {
      return;
    }

    columns.push(
      toColumn(name, columnStatus, columnType, columnsRenderMode[name]),
    );
  });

  // Build columns: other columns
  Object.entries(columnMap).forEach(([name, mergedColumn]) => {
    const columnStatus = mergedColumn.status ?? "";
    const columnType = columnMap[name]?.colType ?? "unknown";

    if (name === "index") return;
    if (primaryKeys.includes(name)) return;
    if (pinnedColumns.includes(name)) return;

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
      toColumn(name, columnStatus, columnType, columnsRenderMode[name]),
    );
  });

  return {
    columns,
    rows,
    invalidPKeyBase,
    invalidPKeyCurrent,
  };
}
