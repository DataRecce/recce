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
  Spinner,
  VStack,
} from "@chakra-ui/react";
import { CSSProperties, useMemo, useState } from "react";
import { DataFrame, Run } from "@/lib/api/types";

interface QueryDataGridProps {
  style?: CSSProperties;
  isFetching?: boolean;
  run?: Run<QueryParams, QueryResult>;
  error?: Error | null; // error from submit
  onCancel?: () => void;
}

function toDataGrid(result: DataFrame) {
  const columns: Column<any, any>[] = result.schema.fields.map((field) => {
    return {
      key: field.name,
      name: field.name === "index" ? "" : field.name,
      width: field.name === "index" ? 10 : "auto",
      cellClass: field.name === "index" ? "index-column" : undefined,
    };
  });

  return { columns, rows: result.data };
}

export const QueryDataGrid = ({
  isFetching,
  run,
  error,
  onCancel,
}: QueryDataGridProps) => {
  const [isAborting, setAborting] = useState(false);
  const dataframe = run?.result?.result;
  const gridData = useMemo(() => {
    if (isFetching || !dataframe) {
      return { rows: [], columns: [] };
    }

    return toDataGrid(dataframe);
  }, [isFetching, dataframe]);

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
    <DataGrid
      style={{ blockSize: "100%" }}
      columns={gridData.columns}
      rows={gridData.rows}
      defaultColumnOptions={{ resizable: true, maxWidth: 800, width: 100 }}
      className="rdg-light"
    />
  );
};
