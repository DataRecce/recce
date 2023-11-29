import "react-data-grid/lib/styles.css";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";
import axios, { AxiosError } from "axios";
import { DataFrame, toDataGrid } from "@/components/query/query";
import { PUBLIC_API_URL } from "../../lib/const";
import { Box, Button, Flex, Textarea } from "@chakra-ui/react";
import SqlEditor from "./SqlEditor";
import { useRunQuery } from "@/lib/api/runQuery";

interface QueryViewDataGridProps {
  loading: boolean;
  baseError?: string;
  currentError?: string;
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
  if (loading) {
    return <>Loading...</>;
  }

  if (baseError && currentError) {
    return <Box p="16px">Error: {currentError}</Box>;
  }

  if (columns.length === 0) {
    return <Box p="16px">No data</Box>;
  }

  return (
    <DataGrid
      style={{ height: "100%" }}
      columns={columns}
      rows={rows}
      defaultColumnOptions={{ resizable: true, maxWidth: 800, width: 100 }}
      className="rdg-light"
    />
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
    baseQueryResult.isFetching && currentQueryResult.isFetching;
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
          disabled={isFetching}
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
          baseError={baseQueryResult.error?.message}
          currentError={currentQueryResult.error?.message}
          rows={gridData.rows}
          columns={gridData.columns}
        />
      </Box>
    </Flex>
  );
};

export default QueryView;
