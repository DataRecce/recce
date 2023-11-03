import 'react-data-grid/lib/styles.css';
import React, { useState, useEffect } from 'react';
import DataGrid, { Column,ColumnOrColumnGroup } from 'react-data-grid';
import axios from 'axios';

const fetchData = async () => {
  try {
    const response = await axios.get('diff.json');
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
};

const transformDataToGridFormat = (data: any) => {
  const columns: ColumnOrColumnGroup<any, any>[] = [{key: 'id', name: 'date_week'}];

  data.columns.forEach(([columnName, side]:[string, string])  => {    
    if (side === 'base') {
      return;
    }

    columns.push({
      name: columnName,
      children: [
        {
          key: `${columnName}_base`,
          name: 'Base',
        },
        {
          key: `${columnName}_current`,
          name: 'Current',
        }
      ]
    });
    
  }, {});

  const rows = data.index.map((timestamp: string, idx: number) => {
    const rowData = data.data[idx];
    const row: Record<string, any> =  { id: timestamp };
    data.columns.forEach(([columnName, side]: [string, string], columnIdx: number) => {
      const key = `${columnName}_${side}`
      row[key] = rowData[columnIdx];
    });
    return row;
  });

  return { columns, rows };
};

const DiffView = () => {
  const [gridData, setGridData] = useState<{columns: any, rows: any}>({ columns: [], rows: [] });

  useEffect(() => {
    fetchData().then((data) => {
      if (data) {
        const transformedData = transformDataToGridFormat(data);
        setGridData(transformedData);
      }
    });
  }, []);

  return (
    <div>
      <h2>Diff.json Content:</h2>
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
