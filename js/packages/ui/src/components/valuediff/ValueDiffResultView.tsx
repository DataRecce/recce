"use client";

/**
 * @file ValueDiffResultView.tsx
 * @description Framework-agnostic Value Diff summary result view for @datarecce/ui
 *
 * Displays column-level match statistics from a value_diff run in a data grid format.
 * Each row represents a column with its match count and percentage.
 *
 * Uses the createResultView factory pattern and can be used by both Recce OSS and Recce Cloud.
 */

import Box from "@mui/material/Box";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  isValueDiffRun,
  type Run,
  type ValueDiffParams,
  type ValueDiffResult,
} from "../../api";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";
import { createResultView } from "../result/createResultView";
import type { CreatedResultViewProps, ResultViewData } from "../result/types";
import { toValueDataGrid } from "../ui/dataGrid";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Run type with value_diff result
 */
export type ValueDiffRun = Run & {
  type: "value_diff";
  result?: ValueDiffResult;
  params?: ValueDiffParams;
};

/**
 * Props for ValueDiffResultView component
 */
export interface ValueDiffResultViewProps
  extends CreatedResultViewProps<unknown> {
  run: ValueDiffRun | unknown;
}

// ============================================================================
// Type Guard
// ============================================================================

/**
 * Type guard wrapper that accepts unknown and delegates to typed guard.
 */
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
  if (!run.result || !run.params) {
    return { renderNull: true };
  }

  const gridData = toValueDataGrid(run.result, { params: run.params });

  if (!gridData) {
    return { renderNull: true };
  }

  return {
    columns: gridData.columns,
    rows: gridData.rows,
    isEmpty: false,
    header: <SummaryHeader params={run.params} summary={run.result.summary} />,
  };
}

// ============================================================================
// Factory-Created Component
// ============================================================================

/**
 * ValueDiffResultView component - displays value diff summary in a data grid.
 *
 * Features:
 * - Displays column-level match statistics
 * - Summary header with model name and row counts (total, common, added, removed)
 * - Highlights columns with match percentage < 100%
 *
 * @example
 * ```tsx
 * <ValueDiffResultView run={valueDiffRun} />
 * ```
 */
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
  ValueDiffResultViewProps & RefAttributes<DataGridHandle>
>;
