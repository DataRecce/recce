/**
 * @file ValueDiffResultView.tsx
 * @description View component for displaying value diff summary results
 *
 * Shows a summary table of column-level match statistics from a value_diff run.
 * Each row represents a column with its match count and percentage.
 */

import type { Run } from "@datarecce/ui/api";
import {
  isValueDiffRun,
  type ValueDiffParams,
  type ValueDiffResult,
} from "@datarecce/ui/api";
import { type DataGridHandle } from "@datarecce/ui/components/data/ScreenshotDataGrid";
import { createResultView } from "@datarecce/ui/components/result/createResultView";
import { type ResultViewData } from "@datarecce/ui/components/result/types";
import Box from "@mui/material/Box";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { createDataGrid } from "@/lib/dataGrid";
import type { RunResultViewProps } from "../run/types";

// ============================================================================
// Type Definitions
// ============================================================================

type ValueDiffRun = Extract<Run, { type: "value_diff" }>;

// ============================================================================
// Type Guard (wrapper to accept unknown)
// ============================================================================

function isValueDiffRunGuard(run: unknown): run is ValueDiffRun {
  return isValueDiffRun(run as Run);
}

// ============================================================================
// Header Component
// ============================================================================

interface SummaryHeaderProps {
  params: ValueDiffParams;
  summary: ValueDiffResult["summary"];
}

function SummaryHeader({ params, summary }: SummaryHeaderProps) {
  const common = summary.total - summary.added - summary.removed;

  return (
    <Box sx={{ px: "16px", pt: "5px", pb: "5px" }}>
      Model: {params.model}, {summary.total} total ({common} common,{" "}
      {summary.added} added, {summary.removed} removed)
    </Box>
  );
}

// ============================================================================
// Transform Function
// ============================================================================

function transformValueDiffData(run: ValueDiffRun): ResultViewData | null {
  const gridData = createDataGrid(run);

  if (!gridData) {
    // Return renderNull: true to make factory return null (matches original behavior)
    return { renderNull: true };
  }

  const result = run.result as ValueDiffResult;
  const params = run.params as ValueDiffParams;

  return {
    columns: gridData.columns,
    rows: gridData.rows,
    isEmpty: false,
    header: <SummaryHeader params={params} summary={result.summary} />,
  };
}

// ============================================================================
// Factory-Created Component
// ============================================================================

export const ValueDiffResultView = createResultView<
  ValueDiffRun,
  unknown,
  DataGridHandle
>({
  displayName: "ValueDiffResultView",
  typeGuard: isValueDiffRunGuard,
  expectedRunType: "value_diff",
  screenshotWrapper: "grid",
  transformData: transformValueDiffData,
}) as ForwardRefExoticComponent<
  RunResultViewProps & RefAttributes<DataGridHandle>
>;
