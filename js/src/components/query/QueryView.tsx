import "react-data-grid/lib/styles.css";
import React, { useState, useCallback, useMemo } from "react";
import DataGrid from "react-data-grid";
import { AxiosError } from "axios";
import { toDataGrid } from "@/components/query/query";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  Flex,
  Spinner,
  Textarea,
} from "@chakra-ui/react";
import SqlEditor from "./SqlEditor";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { useSubmitRun } from "@/lib/api/runs";

interface QueryViewDataGridProps {
  loading: boolean;
  baseError?: string | null;
  currentError?: string | null;
  columns: any;
  rows: any;
}
const QueryViewDataGrid = ({
  loading,
  baseError,
  currentError,
  columns,
  rows,
}: QueryViewDataGridProps) => {
  const isPartialSuccess =
    (baseError && !currentError) || (!baseError && currentError);

  if (loading) {
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

  if (columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  return (
    <Flex direction="column" height="100%" overflow="auto">
      {isPartialSuccess && (
        <Alert status="error">
          <AlertIcon />
          {baseError && `Error[Base]: ${baseError}`}
          {currentError && `Error[Current]: ${currentError}`}
        </Alert>
      )}
      <DataGrid
        style={{ height: "100%" }}
        columns={columns}
        rows={rows}
        defaultColumnOptions={{ resizable: true, maxWidth: 800, width: 100 }}
        className="rdg-light"
      />
    </Flex>
  );
};

const QueryView = () => {
  const { sqlQuery, setSqlQuery } = useRecceQueryContext();
  const cacheKey = ["adhoc_query"];

  const {
    data,
    refetch: runQuery,
    isFetching,
    ...baseQueryResult
  } = useSubmitRun(
    {
      type: "query_diff",
      params: { sql_template: sqlQuery },
    },
    cacheKey
  );
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);

  const executeQuery = useCallback(() => {
    setPrimaryKeys([]);
    runQuery();
  }, [runQuery]);

  const gridData = useMemo(() => {
    if (isFetching) {
      return { rows: [], columns: [] };
    }

    return toDataGrid(
      data?.result?.base,
      data?.result?.current,
      primaryKeys,
      (newPrimaryKeys) => {
        setPrimaryKeys(newPrimaryKeys);
      }
    );
  }, [data?.result?.base, data?.result?.current, isFetching, primaryKeys]);

  return (
    <Flex direction="column" height="calc(100vh - 42px)">
      <Flex justifyContent="right" padding="5px" gap="5px">
        <Button
          colorScheme="blue"
          onClick={() => {}}
          isDisabled={isFetching || !data?.run_id}
          size="sm"
        >
          Add to Checklist
        </Button>
        <Button
          colorScheme="blue"
          onClick={executeQuery}
          isDisabled={isFetching}
          size="sm"
        >
          Run
        </Button>
      </Flex>
      <Box flex="1" border={"1px solid #CBD5E0"} height="200px" width="100%">
        <SqlEditor
          language="sql"
          theme="vs"
          value={sqlQuery}
          onChange={(value) => setSqlQuery(value)}
          onRun={() => executeQuery()}
        />
      </Box>
      <Box backgroundColor="gray.100" height="50vh">
        <QueryViewDataGrid
          loading={isFetching}
          baseError={data?.result?.base_error}
          currentError={data?.result?.current_error}
          rows={gridData.rows}
          columns={gridData.columns}
        />
      </Box>
    </Flex>
  );
};

export default QueryView;
