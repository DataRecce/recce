import "react-data-grid/lib/styles.css";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";
import axios from "axios";
import { DataFrame, queryDiff } from "@/querydiff";
import { PUBLIC_API_URL } from "@/const";
import { Box, Button, Flex, Textarea } from "@chakra-ui/react";

interface DiffViewDataGridProps {
  loading: boolean;
  error?: string;
  columns: any;
  rows: any;
}
const DiffViewDataGrid = ({
  loading,
  error,
  columns,
  rows,
}: DiffViewDataGridProps) => {
  if (loading) {
    return <>Loading...</>;
  }

  if (error) {
    return <>Error: {error}</>;
  }

  if (columns.length === 0) {
    return <>No data</>;
  }

  return (
    <DataGrid
      style={{ height: "100%" }}
      columns={columns}
      rows={rows}
      className="fill-grid"
      defaultColumnOptions={{ resizable: true }}
    />
  );
};

const DiffView = () => {
  const [query, setQuery] = useState(
    'select * from {{ ref("kpi") }} order by 1 desc limit 20'
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  // const [gridData, setGridData] = useState<{ columns: any; rows: any }>({
  //   columns: [],
  //   rows: [],
  // });

  const [base, setBase] = useState<DataFrame>();
  const [current, setCurrent] = useState<DataFrame>();
  const [primaryKeys, setPrimaryKeys] = useState<String[]>([]);

  const executeQuery = useCallback(async () => {
    try {
      setLoading(true);
      const responseCurrent = await axios.post(`${PUBLIC_API_URL}/api/query`, {
        sql_template: query,
        base: false,
      });
      if (responseCurrent.status !== 200) {
        throw new Error("error");
      }

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
    } catch (err: any) {
      setError(err?.message);
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
          rows={gridData.rows}
          columns={gridData.columns}
        />
      </Box>
    </Flex>
  );
};

export default DiffView;
