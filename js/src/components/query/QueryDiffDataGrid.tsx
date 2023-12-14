import "react-data-grid/lib/styles.css";
import DataGrid from "react-data-grid";
import { QueryDiffResult } from "@/lib/api/adhocQuery";
import { Alert, AlertIcon, Center, Flex, Spinner } from "@chakra-ui/react";
import { CSSProperties, useMemo } from "react";
import { toDataGrid } from "./query";

interface QueryDiffDataGridProps {
  style?: CSSProperties;
  isFetching: boolean;
  result?: QueryDiffResult;
  primaryKeys: string[];
  setPrimaryKeys: (primaryKeys: string[]) => void;
}

export const QueryDiffDataGrid = ({
  style,
  isFetching,
  result,
  primaryKeys,
  setPrimaryKeys,
}: QueryDiffDataGridProps) => {
  const gridData = useMemo(() => {
    if (isFetching) {
      return { rows: [], columns: [] };
    }

    return toDataGrid(
      result?.base,
      result?.current,
      primaryKeys,
      setPrimaryKeys
    );
  }, [result?.base, result?.current, isFetching, primaryKeys, setPrimaryKeys]);

  const { base_error: baseError, current_error: currentError } = result || {};

  const isPartialSuccess =
    (baseError && !currentError) || (!baseError && currentError);

  if (isFetching) {
    return (
      <Center p="16px" height="100%">
        <Spinner size="sm" mr="8px" />
        Loading...
      </Center>
    );
  }

  if (baseError && currentError) {
    // return <Box p="16px">Error: {getErrorMessage(currentError)}</Box>;
    return (
      <Alert status="error">
        <AlertIcon />
        Error: {currentError}
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

  // return (
  //   <Flex direction="column" height="100%">
  //     {isPartialSuccess && (
  //       <Alert status="error">
  //         <AlertIcon />
  //         {baseError && `Error[Base]: ${baseError}`}
  //         {currentError && `Error[Current]: ${currentError}`}
  //       </Alert>
  //     )}
  //     <DataGrid
  //       style={style}
  //       columns={gridData.columns}
  //       rows={gridData.rows}
  //       defaultColumnOptions={{ resizable: true, maxWidth: 800, width: 100 }}
  //       className="rdg-light"
  //     />
  //   </Flex>
  // );
};
