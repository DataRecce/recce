import "react-data-grid/lib/styles.css";
import DataGrid, { Column } from "react-data-grid";
import { QueryResult } from "@/lib/api/adhocQuery";
import { Alert, AlertIcon, Center, Flex, Spinner } from "@chakra-ui/react";
import { CSSProperties, useMemo } from "react";
import { toDataDiffGrid } from "./querydiff";
import { DataFrame } from "@/lib/api/types";

interface QueryDataGridProps {
  style?: CSSProperties;
  isFetching: boolean;
  result?: QueryResult;
  error?: Error | null; // error from submit
}

function toDataGrid(result: DataFrame) {
  const columns: Column<any, any>[] = result.schema.fields.map((field) => {
    return {
      key: field.name,
      name: field.name === "index" ? "" : field.name,
      width: field.name === "index" ? 10 : "auto",
    };
  });

  return { columns, rows: result.data };
}

export const QueryDataGrid = ({
  isFetching,
  result,
  error,
}: QueryDataGridProps) => {
  const dataframe = result?.result;
  const gridData = useMemo(() => {
    if (isFetching || !dataframe) {
      return { rows: [], columns: [] };
    }

    return toDataGrid(dataframe);
  }, [isFetching, dataframe]);

  if (isFetching) {
    return (
      <Center p="16px" height="100%">
        <Spinner size="sm" mr="8px" />
        Loading...
      </Center>
    );
  }

  if (error || result?.error) {
    // return <Box p="16px">Error: {getErrorMessage(currentError)}</Box>;
    return (
      <Alert status="error">
        <AlertIcon />
        Error: {error?.message || result?.error}
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
