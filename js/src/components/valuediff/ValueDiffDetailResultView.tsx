import "react-data-grid/lib/styles.css";

import {
  Box,
  Center,
  Checkbox,
  Flex,
  IconButton,
  Spacer,
  Tooltip,
} from "@chakra-ui/react";
import { useMemo } from "react";

import "../query/styles.css";
import { Run } from "@/lib/api/types";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";
import { AddIcon, WarningIcon } from "@chakra-ui/icons";
import { toValueDiffGrid } from "./valuediff";
import {
  ValueDiffDetailParams,
  ValueDiffDetailResult,
  ValueDiffDetailViewOptions,
} from "@/lib/api/valuediff";

export interface ValueDiffDetailResultViewProps
  extends RunResultViewProps<
    ValueDiffDetailParams,
    ValueDiffDetailResult,
    ValueDiffDetailViewOptions
  > {
  onAddToChecklist?: (
    run: Run<ValueDiffDetailParams, ValueDiffDetailResult>
  ) => void;
}

export const ValueDiffDetailResultView = ({
  run,
  onAddToChecklist,
  viewOptions,
  onViewOptionsChanged,
}: ValueDiffDetailResultViewProps) => {
  const changedOnly = useMemo(
    () => viewOptions?.changed_only || false,
    [viewOptions]
  );
  const pinnedColumns = useMemo(
    () => viewOptions?.pinned_columns || [],
    [viewOptions]
  );

  const gridData = useMemo(() => {
    const handlePinnedColumnsChanged = (pinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: pinnedColumns,
        });
      }
    };

    if (!run.result) {
      return { columns: [], rows: [] };
    }

    const primaryKeys = run?.params?.primary_key
      ? [run?.params?.primary_key]
      : [];

    return toValueDiffGrid(run?.result, primaryKeys, {
      changedOnly,
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
    });
  }, [run, viewOptions, changedOnly, pinnedColumns, onViewOptionsChanged]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  if (changedOnly && gridData.rows.length === 0) {
    return <Center height="100%">No change</Center>;
  }

  const toggleChangedOnly = () => {
    const changedOnly = !viewOptions?.changed_only;
    if (onViewOptionsChanged) {
      onViewOptionsChanged({ ...viewOptions, changed_only: changedOnly });
    }
  };

  const limit = run.result?.limit || 0;
  const warning =
    limit > 0 && run?.result?.more
      ? `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`
      : null;

  return (
    <Flex
      direction="column"
      backgroundColor="rgb(249, 249, 249)"
      height={"100%"}
    >
      <Flex
        borderBottom="1px solid lightgray"
        justifyContent="flex-end"
        gap="5px"
        alignItems="center"
        px="10px"
        bg={warning ? "orange.100" : "inherit"}
      >
        {warning && (
          <>
            <WarningIcon color="orange.600" /> <Box>{warning}</Box>
          </>
        )}

        <Spacer minHeight="32px" />
        <Checkbox
          isChecked={viewOptions?.changed_only}
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
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
        defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
        className="rdg-light"
        enableScreenshot={true}
      />
    </Flex>
  );
};
