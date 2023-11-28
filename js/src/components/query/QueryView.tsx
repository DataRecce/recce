import "react-data-grid/lib/styles.css";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";
import axios, { AxiosError } from "axios";
import { DataFrame, queryDiff } from "@/components/query/query";
import { PUBLIC_API_URL } from "../../lib/const";
import { Box, Button, Flex, Textarea } from "@chakra-ui/react";
import SqlEditor from "./SqlEditor";

interface QueryViewDataGridProps {
  loading: boolean;
  error?: string;
  errorStep?: string;
  columns: any;
  rows: any;
}
const QueryViewDataGrid = ({
  loading,
  error,
  errorStep,
  columns,
  rows,
}: QueryViewDataGridProps) => {
  if (loading) {
    return <>Loading...</>;
  }

  if (error) {
    return (
      <Box p="16px">
        Error while querying {errorStep} environment: {error}
      </Box>
    );
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
  const [query, setQuery] = useState('-- Enter your SQL query here ---\nselect * from {{ ref("mymodel") }}');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [errorStep, setErrorStep] = useState<string>();
  // const [gridData, setGridData] = useState<{ columns: any; rows: any }>({
  //   columns: [],
  //   rows: [],
  // });

  const [base, setBase] = useState<DataFrame>();
  const [current, setCurrent] = useState<DataFrame>();
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);

  const executeQuery = useCallback(async () => {
    let step = "current";

    try {
      setLoading(true);
      const responseCurrent = await axios.post(`${PUBLIC_API_URL}/api/query`, {
        sql_template: query,
        base: false,
      });
      if (responseCurrent.status !== 200) {
        throw new Error("error");
      }

      step = "base";
      const responseBase = await axios.post(`${PUBLIC_API_URL}/api/query`, {
        sql_template: query,
        base: true,
      });
      if (responseBase.status !== 200) {
        throw new Error("error");
      }

      setBase(responseBase.data);
      setCurrent(responseCurrent.data);
      setPrimaryKeys([]);
      setError(undefined);
      setErrorStep(undefined);
    } catch (err: any) {
      if (err instanceof AxiosError) {
        const detail = err?.response?.data?.detail;
        if (detail) {
          setError(detail);
        } else {
          setError(err?.message);
        }
      } else {
        setError(err?.message);
      }
      setErrorStep(step);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const gridData = useMemo(() => {
    if (!base || !current) {
      return { rows: [], columns: [] };
    }

    return queryDiff(base, current, primaryKeys, (newPrinaryKeys) => {
      setPrimaryKeys(newPrinaryKeys);
    });
  }, [base, current, primaryKeys]);

  return (
    <Flex direction="column" height="calc(100vh - 42px)">
      <Flex justifyContent="right" padding="5px">
        <Button
          colorScheme="blue"
          onClick={executeQuery}
          disabled={loading}
          size="sm"
        >
          Run
        </Button>
      </Flex>
      <Box
        flex='1'
        border={'1px solid #CBD5E0'}
        height='200px'
        style={{ width: "100%" }}
        >
        <SqlEditor
          language="sql"
          theme="vs"
          value={query}
          onChange={(value) => setQuery(value)}
        />
      </Box>
      <Box backgroundColor="gray.100" height="50vh">
        <QueryViewDataGrid
          loading={loading}
          error={error}
          errorStep={errorStep}
          rows={gridData.rows}
          columns={gridData.columns}
        />
      </Box>
    </Flex>
  );
};

export default QueryView;
