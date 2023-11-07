import "react-data-grid/lib/styles.css";
import React, { useState, useEffect, useCallback } from "react";
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";
import axios from "axios";
import { queryDiff } from "@/querydiff";
import { PUBLIC_API_URL } from "@/const";
import { Box, Button, Flex, Textarea } from "@chakra-ui/react";

const healthCheck = async () => {
  try {
    const response = await axios.get(`${PUBLIC_API_URL}/api/health`);
    return response.data;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
};

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
  const [gridData, setGridData] = useState<{ columns: any; rows: any }>({
    columns: [],
    rows: [],
  });

  const executeQuery = useCallback(async () => {
    try {
      setLoading(true);
      const current = await axios.post(`${PUBLIC_API_URL}/api/query`, {
        sql_template: query,
      });
      if (current.status !== 200) {
        throw new Error("error");
      }

      const base = await axios.post(`${PUBLIC_API_URL}/api/query`, {
        sql_template: query,
        base: true,
      });
      if (base.status !== 200) {
        throw new Error("error");
      }

      const transformedData = queryDiff(current.data, base.data);
      setGridData(transformedData);
    } catch (err: any) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    healthCheck();
  }, []);

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
