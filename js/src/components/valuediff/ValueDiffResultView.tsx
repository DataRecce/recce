/**
 * @file ValueDiffResultView.tsx
 * @description View component for displaying value diff summary results
 *
 * Shows a summary table of column-level match statistics from a value_diff run.
 * Each row represents a column with its match count and percentage.
 */

import { Box, Flex } from "@/components/ui/mui";
import React, { forwardRef, Ref } from "react";
import { DataGridHandle } from "react-data-grid";
import { isValueDiffRun } from "@/lib/api/types";
import { ValueDiffParams, ValueDiffResult } from "@/lib/api/valuediff";
import { createDataGrid } from "@/lib/dataGrid";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";

type ValueDiffResultViewProp = RunResultViewProps;

function _ValueDiffResultView(
  { run }: ValueDiffResultViewProp,
  ref: Ref<DataGridHandle>,
) {
  if (!isValueDiffRun(run)) {
    throw new Error("Run type must be value_diff");
  }

  const result = run.result as ValueDiffResult;
  const params = run.params as ValueDiffParams;

  const gridData = createDataGrid(run);

  if (!gridData) {
    return null;
  }

  const { columns, rows } = gridData;

  return (
    <Flex direction="column" gap="5px" pt="5px" height="100%">
      <Box px="16px">
        Model: {params.model}, {result.summary.total} total (
        {result.summary.total - result.summary.added - result.summary.removed}{" "}
        common, {result.summary.added} added, {result.summary.removed} removed)
      </Box>

      <ScreenshotDataGrid
        ref={ref}
        style={{
          blockSize: "auto",
          maxHeight: "100%",
          overflow: "auto",
          borderBlock: "1px solid lightgray",
        }}
        columns={columns}
        rows={rows}
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
        defaultColumnOptions={{ resizable: true }}
        className="rdg-light"
      />
    </Flex>
  );
}

export const ValueDiffResultView = forwardRef(_ValueDiffResultView);
