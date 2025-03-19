import "react-data-grid/lib/styles.css";
import { Column } from "react-data-grid";
import { QueryParams, QueryResult, QueryViewOptions } from "@/lib/api/adhocQuery";
import { Box, Button, Center, Flex, forwardRef, Icon, Spacer } from "@chakra-ui/react";
import { useMemo } from "react";
import { DataFrame, Run } from "@/lib/api/types";
import { EmptyRowsRenderer, ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { DataFrameColumnGroupHeader, defaultRenderCell } from "./querydiff";
import { VscPin, VscPinned } from "react-icons/vsc";
import { RunResultViewProps } from "../run/types";
import { WarningIcon } from "@chakra-ui/icons";
import _ from "lodash";

interface QueryResultViewProp
  extends RunResultViewProps<QueryParams, QueryResult, QueryViewOptions> {
  onAddToChecklist?: (run: Run<QueryParams, QueryResult>) => void;
}

interface QueryDataGridOptions {
  primaryKeys?: string[];
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  pinnedColumns?: string[];
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
}

function DataFrameColumnHeader({
  name,
  pinnedColumns = [],
  onPinnedColumnsChange = () => {},
}: { name: string } & QueryDataGridOptions) {
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
    </Flex>
  );
}

export function toDataGrid(result: DataFrame, options: QueryDataGridOptions) {
  const columns: Column<any, any>[] = [];
  const primaryKeys = options.primaryKeys || [];
  const pinnedColumns = options.pinnedColumns || [];
  const toColumn = (key: number, name: string) => ({
    key: String(key),
    name: <DataFrameColumnHeader name={name} {...options} />,
    width: "auto",
    renderCell: defaultRenderCell,
  });
  const toColumnGroup = (key: number, name: string) => ({
    key: String(key),
    name: <DataFrameColumnGroupHeader name={name} columnStatus="" {...options} />,
    width: "auto",
    frozen: true,
    renderCell: defaultRenderCell,
  });

  if (primaryKeys.length > 0) {
    primaryKeys.forEach((name) => {
      const i = _.findIndex(result.columns, (col) => col.name === name);
      columns.push(toColumnGroup(i, name));
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
    const i = _.findIndex(result.columns, (col) => col.name === name);
    if (i < 0) {
      return;
    }

    columns.push(toColumn(i, name));
  });

  result.columns.forEach((col, index) => {
    if (primaryKeys.includes(col.name)) {
      return;
    }

    if (pinnedColumns.includes(col.name)) {
      return;
    }

    columns.push(toColumn(index, col.name));
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
  const pinnedColumns = useMemo(() => viewOptions?.pinned_columns || [], [viewOptions]);

  const dataframe = run.result as DataFrame;
  const gridData = useMemo(() => {
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
    });
  }, [dataframe, pinnedColumns, viewOptions, onViewOptionsChanged]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  const limit = dataframe.limit || 0;
  const warning =
    limit > 0 && dataframe.more
      ? `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`
      : null;
  const showTopBar = onAddToChecklist || warning;

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
              <WarningIcon color="orange.600" alignSelf="center" /> <Box>{warning}</Box>
            </>
          )}

          <Spacer minHeight="32px" />
          {onAddToChecklist && (
            <Button
              marginBlock="5px"
              size="sm"
              colorScheme="blue"
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
        enableScreenshot={true}
      />
    </Flex>
  );
};

export const QueryResultView = forwardRef(PrivateQueryResultView);
