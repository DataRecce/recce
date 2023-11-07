import "react-data-grid/lib/styles.css";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";
import axios, { AxiosError } from "axios";
import { DataFrame, queryDiff } from "@/querydiff";
import { PUBLIC_API_URL } from "@/const";
import { Box, Button, Flex, Textarea } from "@chakra-ui/react";

interface DiffViewDataGridProps {
  loading: boolean;
  error?: string;
  errorStep?: string;
  columns: any;
  rows: any;
}
const DiffViewDataGrid = ({
  loading,
  error,
  errorStep,
  columns,
  rows,
}: DiffViewDataGridProps) => {
  if (loading) {
    return <>Loading...</>;
  }

  if (error) {
    return (
      <>
        Error while querying {errorStep} environment: {error}
      </>
    );
  }

  if (columns.length === 0) {
    return <>No data</>;
  }

  return (
    <DataGrid
      style={{ height: "100%" }}
      columns={columns}
      rows={rows}
      defaultColumnOptions={{ resizable: true }}
    />
  );
};

const DiffView = () => {
  const [query, setQuery] = useState(
    'select * from {{ ref("mymodel") }} limit 1000'
  );

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
    <Flex direction="column" height="100vh">
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
      <Textarea
        flex="1"
        height="200px"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            executeQuery();
            e.preventDefault();
          }
        }}
        placeholder="Enter your SQL query here"
        rows={20}
        style={{ width: "100%" }}
      />
      <Box backgroundColor="gray.100" height="50vh">
        <DiffViewDataGrid
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

export default DiffView;
