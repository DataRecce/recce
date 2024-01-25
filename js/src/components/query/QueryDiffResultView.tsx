import "react-data-grid/lib/styles.css";
import DataGrid from "react-data-grid";
import { QueryDiffParams, QueryDiffResult } from "@/lib/api/adhocQuery";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  Checkbox,
  Flex,
  IconButton,
  Spinner,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { CSSProperties, useMemo, useState } from "react";
import { toDataDiffGrid } from "./querydiff";

import "./styles.css";
import { Run } from "@/lib/api/types";
import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";
import { AddIcon } from "@chakra-ui/icons";

export interface QueryDiffResultViewOptions {
  changedOnly?: boolean;
  primaryKeys?: string[];
  pinnedColumns?: string[];
}
export interface QueryDiffResultViewProps
  extends RunResultViewProps<
    QueryDiffParams,
    QueryDiffResult,
    QueryDiffResultViewOptions
  > {
  onAddToChecklist?: (run: Run<QueryDiffParams, QueryDiffResult>) => void;
}

export const QueryDiffResultView = ({
  run,
  onAddToChecklist,
  viewOptions,
  onViewOptionsChanged,
}: QueryDiffResultViewProps) => {
  const primaryKeys = useMemo(
    () => viewOptions?.primaryKeys || [],
    [viewOptions]
  );
  const changedOnly = useMemo(
    () => viewOptions?.changedOnly || false,
    [viewOptions]
  );
  const pinnedColumns = useMemo(
    () => viewOptions?.pinnedColumns || [],
    [viewOptions]
  );

  const gridData = useMemo(() => {
    const handlePrimaryKeyChanged = (primaryKeys: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          primaryKeys,
        });
      }
    };

    const handlePinnedColumnsChanged = (pinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinnedColumns,
        });
      }
    };

    return toDataDiffGrid(run?.result?.base, run?.result?.current, {
      changedOnly,
      primaryKeys,
      onPrimaryKeyChange: handlePrimaryKeyChanged,
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
    });
  }, [
    run,
    viewOptions,
    changedOnly,
    primaryKeys,
    pinnedColumns,
    onViewOptionsChanged,
  ]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  if (changedOnly && gridData.rows.length === 0) {
    return <Center height="100%">No change</Center>;
  }

  const toggleChangedOnly = () => {
    const changedOnly = !viewOptions?.changedOnly;
    if (onViewOptionsChanged) {
      onViewOptionsChanged({ ...viewOptions, changedOnly });
    }
  };

  return (
    <Flex direction="column" backgroundColor="rgb(249, 249, 249)">
      <Flex
        borderBottom="1px solid lightgray"
        justifyContent="flex-end"
        gap="5px"
        height="32px"
      >
        <Checkbox
          isChecked={viewOptions?.changedOnly}
          onChange={toggleChangedOnly}
        >
          Changed only
        </Checkbox>

        {onAddToChecklist && (
          <Tooltip label="Add to Checklist">
            <IconButton
              variant="unstyled"
              size="sm"
              aria-label="Add"
              icon={<AddIcon />}
              onClick={() => onAddToChecklist(run)}
            />
          </Tooltip>
        )}
      </Flex>

      <ScreenshotDataGrid
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
        className="rdg-light"
        enableScreenshot={true}
      />
    </Flex>
  );
};
