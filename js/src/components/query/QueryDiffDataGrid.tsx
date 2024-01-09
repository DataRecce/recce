import "react-data-grid/lib/styles.css";
import DataGrid from "react-data-grid";
import { QueryDiffParams, QueryDiffResult } from "@/lib/api/adhocQuery";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  Flex,
  Spinner,
  VStack,
} from "@chakra-ui/react";
import { CSSProperties, useMemo, useState } from "react";
import { toDataDiffGrid } from "./querydiff";

import "./styles.css";
import { Run } from "@/lib/api/types";

interface QueryDiffDataGridProps {
  style?: CSSProperties;
  isFetching?: boolean;
  run?: Run<QueryDiffParams, QueryDiffResult>;
  error?: Error | null; // error from submit
  changedOnly?: boolean;
  primaryKeys: string[];
  setPrimaryKeys?: (primaryKeys: string[]) => void;
  onCancel?: () => void;
}

export const QueryDiffDataGrid = ({
  isFetching,
  run,
  error,
  changedOnly,
  primaryKeys,
  setPrimaryKeys,
  onCancel,
}: QueryDiffDataGridProps) => {
  const [isAborting, setAborting] = useState(false);
  const gridData = useMemo(() => {
    if (isFetching) {
      return { rows: [], columns: [] };
    }

    return toDataDiffGrid(run?.result?.base, run?.result?.current, {
      changedOnly,
      primaryKeys,
      onPrimaryKeyChange: setPrimaryKeys,
    });
  }, [run, isFetching, primaryKeys, setPrimaryKeys, changedOnly]);

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
          <Box>
            <Spinner size="sm" mr="8px" />

            {isAborting ? <>Aborting...</> : <>Loading...</>}
          </Box>
          {!isAborting && onCancel && (
            <Button onClick={handleCancel} colorScheme="blue" size="sm">
              Cancel
            </Button>
          )}
        </VStack>
      </Center>
    );
  }

  const errorMessage =
    (error as any)?.response?.data?.detail ||
    error?.message ||
    run?.error ||
    run?.result?.current_error ||
    run?.result?.base_error;
  if (errorMessage) {
    return (
      <Alert status="error">
        <AlertIcon />
        Error: {errorMessage}
      </Alert>
    );
  }

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  return (
    <DataGrid
      style={{ flex: 1 }}
      columns={gridData.columns}
      rows={gridData.rows}
      defaultColumnOptions={{ resizable: true, maxWidth: 800, width: 100 }}
      className="rdg-light"
    />
  );
};
