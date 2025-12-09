/**
 * @file toDataGrid.ts
 * @description Simple data grid generation for single DataFrame display
 *
 * Unlike toDataDiffGrid and toValueDiffGrid, this handles non-diff scenarios
 * where we just display a single DataFrame without base/current comparison.
 */

import { Box, Flex, Icon, IconButton, Menu, Portal } from "@chakra-ui/react";
import _ from "lodash";
import { ColumnOrColumnGroup } from "react-data-grid";
import { PiDotsThreeVertical } from "react-icons/pi";
import { VscPin, VscPinned } from "react-icons/vsc";
import {
  DataFrameColumnGroupHeader,
  defaultRenderCell,
} from "@/components/ui/dataGrid";
import { columnPrecisionSelectOptions } from "@/components/valuediff/shared";
import {
  ColumnRenderMode,
  ColumnType,
  DataFrame,
  RowObjectType,
} from "@/lib/api/types";
import { validateToDataGridInputs } from "@/lib/dataGrid/shared";
import { dataFrameToRowObjects } from "@/utils/transforms";

// ============================================================================
// Types
// ============================================================================

export interface QueryDataGridOptions {
  primaryKeys?: string[];
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  pinnedColumns?: string[];
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  columnsRenderMode?: Record<string, ColumnRenderMode>;
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
}

// ============================================================================
// Column Header Component
// ============================================================================

function DataFrameColumnHeader({
  name,
  pinnedColumns = [],
  onPinnedColumnsChange = () => {
    return void 0;
  },
  columnType,
  onColumnsRenderModeChanged,
}: {
  name: string;
  columnType: ColumnType;
  onColumnRenderModeChanged?: (
    colNam: string,
    renderAs: ColumnRenderMode,
  ) => void;
} & QueryDataGridOptions) {
  let selectOptions: { value: string; onClick: () => void }[] = [];
  if (onColumnsRenderModeChanged) {
    selectOptions = columnPrecisionSelectOptions(
      name,
      onColumnsRenderModeChanged,
    );
  }

  const isPinned = pinnedColumns.includes(name);

  const handleUnpin = () => {
    const newPinnedColumns = pinnedColumns.filter((item) => item !== name);
    onPinnedColumnsChange(newPinnedColumns);
  };

  const handlePin = () => {
    const newPinnedColumns = [...pinnedColumns, name];
    onPinnedColumnsChange(newPinnedColumns);
  };

  return (
    <Flex className="grid-header" alignItems="center">
      <Box flex={1}>{name}</Box>

      <Icon
        className={isPinned ? "unpin-icon" : "pin-icon"}
        display={isPinned ? "block" : "none"}
        cursor="pointer"
        as={isPinned ? VscPinned : VscPin}
        onClick={isPinned ? handleUnpin : handlePin}
      />
      {columnType === "number" && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              aria-label="Options"
              variant="plain"
              className="!size-4 !min-w-4"
            >
              <PiDotsThreeVertical />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {selectOptions.map((o) => (
                  <Menu.Item key={o.value} value={o.value} onClick={o.onClick}>
                    {o.value}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}
    </Flex>
  );
}

// ============================================================================
// Main Grid Generation Function
// ============================================================================

export function toDataGrid(result: DataFrame, options: QueryDataGridOptions) {
  validateToDataGridInputs(result, options);
  const columns: (ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  })[] = [];
  const primaryKeys = options.primaryKeys ?? [];
  const pinnedColumns = options.pinnedColumns ?? [];
  const columnsRenderMode = options.columnsRenderMode ?? {};

  const columnMap: Record<string, { colType: ColumnType }> = {};
  result.columns.forEach((col) => {
    columnMap[col.name] = {
      colType: col.type,
    };
  });

  const toColumn = (
    key: string,
    name: string,
    columnType: ColumnType,
    columnRenderMode: ColumnRenderMode = "raw",
  ): ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  } => ({
    key: key,
    name: (
      <DataFrameColumnHeader name={name} {...options} columnType={columnType} />
    ),
    width: "auto",
    renderCell: defaultRenderCell,
    columnType,
    columnRenderMode,
  });

  const toColumnGroup = (
    key: string,
    name: string,
    columnType: ColumnType,
    columnRenderMode: ColumnRenderMode = "raw",
  ): ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  } => ({
    key: key,
    name: (
      <DataFrameColumnGroupHeader
        name={name}
        columnStatus=""
        columnType={columnType}
        {...options}
      />
    ),
    width: "auto",
    frozen: true,
    renderCell: defaultRenderCell,
    columnType,
    columnRenderMode,
  });

  if (primaryKeys.length > 0) {
    primaryKeys.forEach((name) => {
      const columnType = columnMap[name].colType;

      columns.push(
        toColumnGroup(name, name, columnType, columnsRenderMode[name]),
      );
    });
  } else {
    columns.push({
      key: "_index",
      name: "",
      width: 50,
      cellClass: "index-column",
    });
  }

  pinnedColumns.forEach((key) => {
    const columnType = columnMap[key].colType;
    const i = _.findIndex(result.columns, (col) => col.name === key);
    if (i < 0) {
      return;
    }

    columns.push(
      toColumn(key, result.columns[i].name, columnType, columnsRenderMode[key]),
    );
  });

  result.columns.forEach(({ name, key }) => {
    if (primaryKeys.includes(name)) {
      return;
    }

    if (pinnedColumns.includes(name)) {
      return;
    }
    const columnType = columnMap[name].colType;

    columns.push(toColumn(key, name, columnType, columnsRenderMode[name]));
  });

  return { columns, rows: dataFrameToRowObjects(result) };
}
