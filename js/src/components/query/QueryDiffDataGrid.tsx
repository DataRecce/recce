import "react-data-grid/lib/styles.css";
import DataGrid from "react-data-grid";
import { QueryDiffResult } from "@/lib/api/adhocQuery";
import { Alert, AlertIcon, Center, Flex, Spinner } from "@chakra-ui/react";
import { CSSProperties, useMemo } from "react";
import { toDataDiffGrid } from "./querydiff";

import "./styles.css";

interface QueryDiffDataGridProps {
  style?: CSSProperties;
  isFetching: boolean;
  result?: QueryDiffResult;
  error?: Error | null; // error from submit
  primaryKeys: string[];
  setPrimaryKeys?: (primaryKeys: string[]) => void;
  onCancel?: () => void;
}

export const QueryDiffDataGrid = ({
  isFetching,
  result,
  error,
  primaryKeys,
  setPrimaryKeys,
}: QueryDiffDataGridProps) => {
  const gridData = useMemo(() => {
    if (isFetching) {
      return { rows: [], columns: [] };
    }

    return toDataDiffGrid(
      result?.base,
      result?.current,
      primaryKeys,
      setPrimaryKeys
    );
  }, [result, isFetching, primaryKeys, setPrimaryKeys]);

  const { base_error: baseError, current_error: currentError } = result || {};

  if (isFetching) {
    return (
      <Center p="16px" height="100%">
        <Spinner size="sm" mr="8px" />
        Loading...
      </Center>
    );
  }

  if (error || (baseError && currentError)) {
    // return <Box p="16px">Error: {getErrorMessage(currentError)}</Box>;
    return (
      <Alert status="error">
        <AlertIcon />
        Error:{" "}
        {(error as any)?.response?.data?.detail ||
          error?.message ||
          currentError}
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
