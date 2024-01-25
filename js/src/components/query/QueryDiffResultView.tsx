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
} from "@chakra-ui/react";
import { CSSProperties, useMemo, useState } from "react";
import { toDataDiffGrid } from "./querydiff";

import "./styles.css";
import { Run } from "@/lib/api/types";
import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";

export interface QueryDiffResultViewOptions {
  changedOnly?: boolean;
  primaryKeys?: string[];
}
export interface QueryDiffResultViewProps
  extends RunResultViewProps<
    QueryDiffParams,
    QueryDiffResult,
    QueryDiffResultViewOptions
  > {}

export const QueryDiffResultView = ({
  run,

  viewOptions,
  onViewOptionsChanged,
}: QueryDiffResultViewProps) => {
  const primaryKeys = viewOptions?.primaryKeys || [];
  const changedOnly = viewOptions?.changedOnly || false;

  const [pinnedColumns, setPinnedColumns] = useState<string[]>([]);

  const handlePrimaryKeyChange = (primaryKeys: string[]) => {
    if (onViewOptionsChanged) {
      onViewOptionsChanged({
        ...viewOptions,
        primaryKeys,
      });
    }
  };

  const gridData = useMemo(() => {
    return toDataDiffGrid(run?.result?.base, run?.result?.current, {
      changedOnly,
      primaryKeys,
      onPrimaryKeyChange: handlePrimaryKeyChange,
      pinnedColumns,
      onPinnedColumnsChange: setPinnedColumns,
    });
  }, [
    run,
    primaryKeys,
    onViewOptionsChanged,
    pinnedColumns,
    setPinnedColumns,
    changedOnly,
  ]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  if (changedOnly && gridData.rows.length === 0) {
    return <Center height="100%">No change</Center>;
  }

  return (
    <ScreenshotDataGrid
      style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
      columns={gridData.columns}
      rows={gridData.rows}
      defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
      className="rdg-light"
      enableScreenshot={true}
    />
  );
};
