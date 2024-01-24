import "react-data-grid/lib/styles.css";
import DataGrid, { Column } from "react-data-grid";
import { QueryParams, QueryResult } from "@/lib/api/adhocQuery";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  Flex,
  Icon,
  Spinner,
  VStack,
} from "@chakra-ui/react";
import { CSSProperties, useMemo, useState } from "react";
import { DataFrame, Run } from "@/lib/api/types";
import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { defaultRenderCell } from "./querydiff";
import { VscPin, VscPinned } from "react-icons/vsc";

interface QueryDataGridProps {
  style?: CSSProperties;
  isFetching?: boolean;
  run?: Run<QueryParams, QueryResult>;
  error?: Error | null; // error from submit
  onCancel?: () => void;
  enableScreenshot?: boolean;
}

interface QueryDataGridOptions {
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
        visibility={isPinned ? "visible" : "hidden"}
        cursor="pointer"
        as={isPinned ? VscPinned : VscPin}
        onClick={isPinned ? handleUnpin : handlePin}
      />
    </Flex>
  );
}

function toDataGrid(result: DataFrame, options: QueryDataGridOptions) {
  const columns: Column<any, any>[] = [];
  const pinnedColumns = options.pinnedColumns || [];
  const fields = result.schema.fields;
  const toColumn = (name: string) => ({
    key: name,
    name: <DataFrameColumnHeader name={name} {...options} />,
    width: "auto",
    renderCell: defaultRenderCell,
  });

  columns.push({
    key: "index",
    name: "",
    width: 10,
    cellClass: "index-column",
  });

  pinnedColumns.forEach((name) => {
    columns.push(toColumn(name));
  });

  fields
    .filter((field) => field.name !== "index")
    .filter((field) => !pinnedColumns.includes(field.name))
    .forEach(({ name }) => {
      columns.push(toColumn(name));
    });

  return { columns, rows: result.data };
}

export const QueryDataGrid = ({
  isFetching,
  run,
  error,
  onCancel,
  enableScreenshot,
}: QueryDataGridProps) => {
  const [isAborting, setAborting] = useState(false);
  const [pinnedColumns, setPinnedColumns] = useState<string[]>([]);
  const dataframe = run?.result?.result;
  const gridData = useMemo(() => {
    if (isFetching || !dataframe) {
      return { rows: [], columns: [] };
    }

    return toDataGrid(dataframe, {
      pinnedColumns,
      onPinnedColumnsChange: setPinnedColumns,
    });
  }, [isFetching, dataframe, pinnedColumns, setPinnedColumns]);

  const handleCancel = () => {
    setAborting(true);
    if (onCancel) {
      onCancel();
    }
  };

  if (isFetching) {
    return (
      <Center p="16px" height="100%">
        <VStack>
          <Box>
            <Spinner size="sm" mr="8px" />

            {isAborting ? <>Aborting...</> : <>Loading...</>}
          </Box>
          {!isAborting && onCancel && (
            <Button onClick={handleCancel} colorScheme="blue" size="sm">
              Cancel
            </Button>
          )}
        </VStack>
      </Center>
    );
  }

  const errorMessage =
    (error as any)?.response?.data?.detail || run?.error || run?.result?.error;

  if (errorMessage) {
    // return <Box p="16px">Error: {getErrorMessage(currentError)}</Box>;
    return (
      <Alert status="error">
        <AlertIcon />
        Error: {errorMessage}
      </Alert>
    );
  }

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  return (
    <>
      <ScreenshotDataGrid
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
        className="rdg-light"
        enableScreenshot={enableScreenshot}
      />
    </>
  );
};
