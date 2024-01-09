import "react-data-grid/lib/styles.css";
import DataGrid from "react-data-grid";
import { QueryDiffParams, QueryDiffResult } from "@/lib/api/adhocQuery";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  Spinner,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { toDataDiffGrid } from "./querydiff";

import "./styles.css";
import { Run } from "@/lib/api/types";
import { highlightBoxShadow, useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";
import { CopyIcon } from "@chakra-ui/icons";

interface QueryDiffDataGridProps {
  style?: CSSProperties;
  isFetching?: boolean;
  run?: Run<QueryDiffParams, QueryDiffResult>;
  error?: Error | null; // error from submit
  primaryKeys: string[];
  setPrimaryKeys?: (primaryKeys: string[]) => void;
  onCancel?: () => void;
  enableScreenShot?: boolean;
}

export const QueryDiffDataGrid = ({
  isFetching,
  run,
  error,
  primaryKeys,
  setPrimaryKeys,
  onCancel,
  enableScreenShot=false
}: QueryDiffDataGridProps) => {
  const { ref, CopyToClipboardButton } = useCopyToClipboardButton();
  const [isAborting, setAborting] = useState(false);
  const gridData = useMemo(() => {
    if (isFetching) {
      return { rows: [], columns: [] };
    }

    return toDataDiffGrid(
      run?.result?.base,
      run?.result?.current,
      primaryKeys,
      setPrimaryKeys
    );
  }, [run, isFetching, primaryKeys, setPrimaryKeys]);

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
    <>
      <DataGrid
        ref={ref}
        style={{
          blockSize: "100%",
          overflow: "auto",
        }}
        columns={gridData.columns}
        rows={gridData.rows}
        defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
        className="rdg-light"
      />
      {enableScreenShot &&<CopyToClipboardButton imageType="png"/>}
    </>
  );
};
