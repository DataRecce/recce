import "react-data-grid/lib/styles.css";
import DataGrid, { ColumnOrColumnGroup, textEditor } from "react-data-grid";
import {
  Alert,
  AlertIcon,
  Button,
  Center,
  Spinner,
  Stack,
  VStack,
} from "@chakra-ui/react";
import { CSSProperties, useMemo, useState } from "react";
import { DataFrame, DataFrameField, DataFrameRow } from "@/lib/api/types";
import { ProfileDiffResult } from "@/lib/api/profile";
import _ from "lodash";
import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";

interface ProfileDataGridProps {
  style?: CSSProperties;
  isFetching: boolean;
  result?: ProfileDiffResult;
  error?: Error | null; // error from submit
  onCancel?: () => void;
  enableScreenshot?: boolean;
}

function _getPrimaryKeyValue(row: DataFrameRow, primaryKey: string): string {
  const result: Record<string, any> = {};
  result[primaryKey] = row[primaryKey];
  return JSON.stringify(result);
}

function toDataDiffGrid(base?: DataFrame, current?: DataFrame) {
  // primary key: "column_name" is per dbt_profiler package design
  const primaryKey: string = "column_name";
  const empty: DataFrame = {
    schema: {
      fields: [],
      primaryKey: [],
    },
    data: [],
  };

  if (!base && current) {
    base = empty;
  } else if (!current && base) {
    current = empty;
  } else if (base && current) {
    // do nothing
  } else {
    return { rows: [], columns: [] };
  }

  const columns: ColumnOrColumnGroup<any, any>[] = [];
  const pkColumn: ColumnOrColumnGroup<any, any> = {
    key: primaryKey,
    name: primaryKey,
    frozen: true,
  };

  const columnMap: Record<
    string,
    { base?: DataFrameField; current?: DataFrameField }
  > = {};
  const rowMap: Record<any, { base?: DataFrameRow; current?: DataFrameRow }> =
    {};

  current.schema.fields.forEach((field) => {
    columnMap[field.name] = {};
    columnMap[field.name].current = field;
  });

  base.schema.fields.forEach((field) => {
    if (!columnMap[field.name]) {
      columnMap[field.name] = {};
    }
    columnMap[field.name].base = field;
  });

  Object.keys(columnMap).forEach((name) => {
    if (name === "index" || name === primaryKey || name === "profiled_at") {
      return;
    }

    const cellClass = (row: any) => {
      if (!_.isEqual(row[`base__${name}`], row[`current__${name}`])) {
        return "diff-cell";
      }

      return undefined;
    };

    columns.push({
      name: name,
      children: [
        {
          key: `base__${name}`,
          name: "Base",
          renderEditCell: textEditor,
          cellClass,
        },
        {
          key: `current__${name}`,
          name: "Current",
          renderEditCell: textEditor,
          cellClass,
        },
      ],
    });
  });

  // merge row
  current.data.forEach((row) => {
    const key = _getPrimaryKeyValue(row, primaryKey);
    rowMap[key] = {};
    rowMap[key].current = row;
  });

  base.data.forEach((row) => {
    const key = _getPrimaryKeyValue(row, primaryKey);
    if (!rowMap[key]) {
      rowMap[key] = {};
    }
    rowMap[key].base = row;
  });

  const rows = Object.entries(rowMap).map(([key, { base, current }]) => {
    const row = JSON.parse(key);

    if (base) {
      Object.keys(base).forEach((key) => {
        if (key === primaryKey) {
          return;
        }
        row[`base__${key}`] =
          typeof base[key] === "boolean" ? base[key].toString() : base[key];
      });
    }

    if (current) {
      Object.keys(current).forEach((key) => {
        if (key === primaryKey) {
          return;
        }

        row[`current__${key}`] =
          typeof current[key] === "boolean"
            ? current[key].toString()
            : current[key];
      });
    }

    return row;
  });

  return {
    columns: [pkColumn, ...columns],
    rows,
  };
}

export const ProfileDiffDataGrid = ({
  isFetching,
  result,
  error,
  onCancel,
  enableScreenshot,
}: ProfileDataGridProps) => {
  const [isAborting, setAborting] = useState(false);
  const gridData = useMemo(() => {
    if (isFetching) {
      return { rows: [], columns: [] };
    }

    return toDataDiffGrid(result?.base, result?.current);
  }, [result, isFetching]);

  const handleCancel = () => {
    setAborting(true);
    if (onCancel) {
      onCancel();
    }
  };

  if (isFetching) {
    return (
      <Center p="16px" height="100%">
        <VStack>
          <Spinner size="sm" mr="8px" />
          {isAborting ? <>Aborting...</> : <>Loading...</>}
          {!isAborting && onCancel && (
            <Button onClick={handleCancel} colorScheme="blue" size="sm">
              Cancel
            </Button>
          )}
        </VStack>
      </Center>
    );
  }

  if (result?.base_error || result?.current_error) {
    if (result?.base_error === result?.current_error) {
      return (
        <Alert status="error">
          <AlertIcon />
          Error: {result?.current_error}
        </Alert>
      );
    } else {
      const renderAlert = (env: string, message: string) => (
        <Alert status="error">
          <AlertIcon />
          {env} Environment Error: {message}
        </Alert>
      );

      return (
        <Stack spacing={3}>
          {result?.base_error && renderAlert("Base", result.base_error)}
          {result?.current_error &&
            renderAlert("Current", result.current_error)}
        </Stack>
      );
    }
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        Error: {error?.message}
      </Alert>
    );
  }

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  return (<>
    <ScreenshotDataGrid
      style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
      columns={gridData.columns}
      rows={gridData.rows}
      defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
      className="rdg-light"
      enableScreenshot={enableScreenshot}
    />
  </>);
};
