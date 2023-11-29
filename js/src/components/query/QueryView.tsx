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
import { useRunQuery } from "@/lib/api/runQuery";

interface QueryViewDataGridProps {
  loading: boolean;
  baseError?: Error | null;
  currentError?: Error | null;
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

  const getErrorMessage = (err: Error) => {
    if (err instanceof AxiosError) {
      const detail = err?.response?.data?.detail;
      if (detail) {
        return detail;
      } else {
        return err?.message;
      }
    } else {
      return err?.message;
    }
  };

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
        Error: {getErrorMessage(currentError)}
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
          {baseError && `Error[Base]: ${getErrorMessage(baseError)}`}
          {currentError && `Error[Current]: ${getErrorMessage(currentError)}`}
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
  const [sqlTemplate, setSqlTemplate] = useState(
    'select * from {{ ref("mymodel") }}'
  );

  const {
    data: base,
    refetch: queryBase,
    ...baseQueryResult
  } = useRunQuery({ sql_template: sqlTemplate, base: true });
  const {
    data: current,
    refetch: queryCurrent,
    ...currentQueryResult
  } = useRunQuery({ sql_template: sqlTemplate, base: false });
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);

  const executeQuery = useCallback(() => {
    setPrimaryKeys([]);
    queryBase();
    queryCurrent();
  }, [queryBase, queryCurrent]);

  const isFetching =
    baseQueryResult.isFetching || currentQueryResult.isFetching;
  const gridData = useMemo(() => {
    if (isFetching) {
      return { rows: [], columns: [] };
    }

    return toDataGrid(base, current, primaryKeys, (newPrinaryKeys) => {
      setPrimaryKeys(newPrinaryKeys);
    });
  }, [base, current, isFetching, primaryKeys]);

  return (
    <Flex direction="column" height="calc(100vh - 42px)">
      <Flex justifyContent="right" padding="5px">
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
          value={sqlTemplate}
          onChange={(value) => setSqlTemplate(value)}
          onRun={() => executeQuery()}
        />
      </Box>
      <Box backgroundColor="gray.100" height="50vh">
        <QueryViewDataGrid
          loading={isFetching}
          baseError={baseQueryResult.error}
          currentError={currentQueryResult.error}
          rows={gridData.rows}
          columns={gridData.columns}
        />
      </Box>
    </Flex>
  );
};

export default QueryView;
