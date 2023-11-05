import "react-data-grid/lib/styles.css";
import React, { useState, useEffect, useCallback } from "react";
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";
import axios from "axios";

const healthCheck = async () => {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/health`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
};

const transformDataToGridFormat = (data: any) => {
  const columns: ColumnOrColumnGroup<any, any>[] = [
    { key: "id", name: "date_week" },
  ];

  data.columns.forEach(([columnName, side]: [string, string]) => {
    if (side === "base") {
      return;
    }

    columns.push({
      name: columnName,
      children: [
        {
          key: `${columnName}_base`,
          name: "Base",
        },
        {
          key: `${columnName}_current`,
          name: "Current",
        },
      ],
    });
  }, {});

  const rows = data.index.map((timestamp: string, idx: number) => {
    const rowData = data.data[idx];
    const row: Record<string, any> = { id: timestamp };
    data.columns.forEach(
      ([columnName, side]: [string, string], columnIdx: number) => {
        const key = `${columnName}_${side}`;
        row[key] = rowData[columnIdx];
      }
    );
    return row;
  });

  return { columns, rows };
};

const DiffView = () => {
  const [query, setQuery] = useState('select * from {{ ref("kpi") }} order by 1 desc limit 20');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gridData, setGridData] = useState<{ columns: any; rows: any }>({
    columns: [],
    rows: [],
  });

  const executeQuery = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/querydiff`,
        {
          sql_template: query
        }
      );

      if (response.status !== 200) {
        throw new Error("error");
      }

      const data = response.data;
      if (data) {
        const transformedData = transformDataToGridFormat(data);
        setGridData(transformedData);
      }
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
    <div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter your SQL query here"
        rows={60}
        cols={50}
        style={{width: '100%'}}
      />
      <br />
      <button onClick={executeQuery} disabled={loading}>
        Execute Query
      </button>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}

      <DataGrid
        columns={gridData.columns}
        rows={gridData.rows}
        className="fill-grid"
        defaultColumnOptions={{ resizable: true }}
      />
    </div>
  );
};

export default DiffView;
