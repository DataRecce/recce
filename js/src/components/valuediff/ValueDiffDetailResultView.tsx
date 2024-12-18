import "react-data-grid/lib/styles.css";

import { Center, Flex, forwardRef } from "@chakra-ui/react";
import { useMemo } from "react";

import "../query/styles.css";
import { Run } from "@/lib/api/types";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";
import { toValueDiffGrid } from "./valuediff";
import {
  ValueDiffDetailParams,
  ValueDiffDetailResult,
  ValueDiffDetailViewOptions,
} from "@/lib/api/valuediff";
import { RunToolbar } from "../run/RunToolbar";

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

const PrivateValueDiffDetailResultView = (
  {
    run,
    onAddToChecklist,
    viewOptions,
    onViewOptionsChanged,
  }: ValueDiffDetailResultViewProps,
  ref: any
) => {
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

    if (!run.result || !run?.params?.primary_key) {
      return { columns: [], rows: [] };
    }

    // primaryKey can be array or string, map to array
    const primaryKey = run.params.primary_key;
    const primaryKeys = Array.isArray(primaryKey) ? primaryKey : [primaryKey];

    return toValueDiffGrid(run?.result, primaryKeys, {
      changedOnly,
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
    });
  }, [run, viewOptions, changedOnly, pinnedColumns, onViewOptionsChanged]);

  const limit = run.result?.limit || 0;
  const warning =
    limit > 0 && run?.result?.more
      ? `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`
      : null;

  const warnings: string[] = [];
  if (warning) {
    warnings.push(warning);
  }

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  if (changedOnly && gridData.rows.length === 0) {
    return (
      <Flex
        direction="column"
        backgroundColor="rgb(249, 249, 249)"
        height={"100%"}
      >
        <RunToolbar
          run={run}
          viewOptions={viewOptions}
          onAddToChecklist={onAddToChecklist}
          onViewOptionsChanged={onViewOptionsChanged}
          warnings={warnings}
        />
        <Center height="100%">No change</Center>;
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      backgroundColor="rgb(249, 249, 249)"
      height={"100%"}
    >
      <RunToolbar
        run={run}
        viewOptions={viewOptions}
        onAddToChecklist={onAddToChecklist}
        onViewOptionsChanged={onViewOptionsChanged}
        warnings={warnings}
      />
      <ScreenshotDataGrid
        ref={ref}
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

export const ValueDiffDetailResultView = forwardRef(
  PrivateValueDiffDetailResultView
);
