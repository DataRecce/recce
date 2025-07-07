import "react-data-grid/lib/styles.css";
import { ColumnOrColumnGroup } from "react-data-grid";
import { QueryParams, QueryResult, QueryViewOptions } from "@/lib/api/adhocQuery";
import {
  Box,
  Button,
  Center,
  Flex,
  Icon,
  IconButton,
  Menu,
  Portal,
  Spacer,
} from "@chakra-ui/react";
import React, { forwardRef, useMemo } from "react";
import { ColumnRenderMode, ColumnType, DataFrame, RowObjectType, Run } from "@/lib/api/types";
import { EmptyRowsRenderer, ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { DataFrameColumnGroupHeader, defaultRenderCell } from "./querydiff";
import { VscKebabVertical, VscPin, VscPinned } from "react-icons/vsc";
import { RunResultViewProps } from "../run/types";
import _ from "lodash";
import { columnPrecisionSelectOptions } from "@/components/valuediff/shared";
import { PiWarning } from "react-icons/pi";

interface QueryResultViewProp
  extends RunResultViewProps<QueryParams, QueryResult, QueryViewOptions> {
  onAddToChecklist?: (run: Run<QueryParams, QueryResult>) => void;
}

interface QueryDataGridOptions {
  primaryKeys?: string[];
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  pinnedColumns?: string[];
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  columnsRenderMode?: Record<string, ColumnRenderMode>;
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
}

function DataFrameColumnHeader({
  name,
  pinnedColumns = [],
  onPinnedColumnsChange = () => {},
  columnType,
  onColumnsRenderModeChanged,
}: {
  name: string;
  columnType: ColumnType;
  onColumnRenderModeChanged?: (colNam: string, renderAs: ColumnRenderMode) => void;
} & QueryDataGridOptions) {
  let selectOptions: { value: string; onClick: () => void }[] = [];
  if (onColumnsRenderModeChanged) {
    selectOptions = columnPrecisionSelectOptions(name, onColumnsRenderModeChanged);
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
            <IconButton aria-label="Options" variant="plain" className="!size-4 !min-w-4">
              <VscKebabVertical />
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

export function toDataGrid(result: DataFrame, options: QueryDataGridOptions) {
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
    key: number,
    name: string,
    columnType: ColumnType,
    columnRenderMode: ColumnRenderMode = "raw",
  ): ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  } => ({
    key: String(key),
    name: <DataFrameColumnHeader name={name} {...options} columnType={columnType} />,
    width: "auto",
    renderCell: defaultRenderCell,
    columnType,
    columnRenderMode,
  });
  const toColumnGroup = (
    key: number,
    name: string,
    columnType: ColumnType,
    columnRenderMode: ColumnRenderMode = "raw",
  ): ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  } => ({
    key: String(key),
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
      const i = _.findIndex(result.columns, (col) => col.name === name);
      const columnType = columnMap[name].colType;

      columns.push(toColumnGroup(i, name, columnType, columnsRenderMode[name]));
    });
  } else {
    columns.push({
      key: "_index",
      name: "",
      width: 50,
      cellClass: "index-column",
    });
  }

  pinnedColumns.forEach((name) => {
    const columnType = columnMap[name].colType;
    const i = _.findIndex(result.columns, (col) => col.name === name);
    if (i < 0) {
      return;
    }

    columns.push(toColumn(i, name, columnType, columnsRenderMode[name]));
  });

  result.columns.forEach(({ name }, index) => {
    if (primaryKeys.includes(name)) {
      return;
    }

    if (pinnedColumns.includes(name)) {
      return;
    }
    const columnType = columnMap[name].colType;

    columns.push(toColumn(index, name, columnType, columnsRenderMode[name]));
  });

  result.data.forEach((row, index) => {
    const row_data = row as any;
    row_data._index = index + 1;
  });

  return { columns, rows: result.data };
}

const PrivateQueryResultView = (
  { run, viewOptions, onViewOptionsChanged, onAddToChecklist }: QueryResultViewProp,
  ref: any,
) => {
  const pinnedColumns = useMemo(() => viewOptions?.pinned_columns ?? [], [viewOptions]);
  const columnsRenderMode = useMemo(() => viewOptions?.columnsRenderMode ?? {}, [viewOptions]);

  const dataframe = run.result;
  const gridData = useMemo(() => {
    const onColumnsRenderModeChanged = (cols: Record<string, ColumnRenderMode>) => {
      const newRenderModes = {
        ...(viewOptions?.columnsRenderMode ?? {}),
        ...cols,
      };
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          columnsRenderMode: newRenderModes,
        });
      }
    };

    if (!dataframe) {
      return { rows: [], columns: [] };
    }

    const handlePinnedColumnsChanged = (pinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: pinnedColumns,
        });
      }
    };

    return toDataGrid(dataframe, {
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      columnsRenderMode,
      onColumnsRenderModeChanged,
    });
  }, [dataframe, pinnedColumns, viewOptions, onViewOptionsChanged, columnsRenderMode]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  const limit = dataframe ? (dataframe.limit ?? 0) : 0;
  const warning =
    limit > 0 && dataframe?.more
      ? `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`
      : null;
  const showTopBar = onAddToChecklist ?? warning;

  return (
    <Flex direction="column" backgroundColor="rgb(249, 249, 249)" height="100%">
      {showTopBar && (
        <Flex
          borderBottom="1px solid lightgray"
          alignItems="center"
          gap="5px"
          px="10px"
          bg={warning ? "orange.100" : "inherit"}>
          {warning && (
            <>
              <PiWarning color="orange.600" className="self-center" /> <Box>{warning}</Box>
            </>
          )}

          <Spacer minHeight="32px" />
          {onAddToChecklist && (
            <Button
              marginBlock="5px"
              size="xs"
              colorPalette="cyan"
              onClick={() => {
                onAddToChecklist(run);
              }}>
              Add to Checklist
            </Button>
          )}
        </Flex>
      )}
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
        defaultColumnOptions={{
          resizable: true,
          maxWidth: 800,
          minWidth: 35,
        }}
        className="rdg-light"
      />
    </Flex>
  );
};

export const QueryResultView = forwardRef(PrivateQueryResultView);
