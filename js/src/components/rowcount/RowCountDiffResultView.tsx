import { isRowCountDiffRun, isRowCountRun } from "@datarecce/ui/api";
import { type DataGridHandle } from "@datarecce/ui/components/data/ScreenshotDataGrid";
import { createResultView } from "@datarecce/ui/components/result/createResultView";
import { type ResultViewData } from "@datarecce/ui/components/result/types";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
// Import Run from OSS types for proper discriminated union support with Extract<>
import type { Run } from "@/lib/api/types";
import { createDataGrid } from "@/lib/dataGrid/dataGridFactory";
import type { RunResultViewProps } from "../run/types";

// ============================================================================
// Type Definitions
// ============================================================================

type RowCountDiffRun = Extract<Run, { type: "row_count_diff" }>;
type RowCountRun = Extract<Run, { type: "row_count" }>;

// ============================================================================
// Type Guards (wrapper to accept unknown)
// ============================================================================

function isRowCountDiffRunGuard(run: unknown): run is RowCountDiffRun {
  return isRowCountDiffRun(run as Run);
}

function isRowCountRunGuard(run: unknown): run is RowCountRun {
  return isRowCountRun(run as Run);
}

// ============================================================================
// Transform Function (shared logic)
// ============================================================================

function transformRowCountData(run: Run): ResultViewData | null {
  const gridData = createDataGrid(run);
  if (!gridData) {
    return null;
  }
  return {
    columns: gridData.columns,
    rows: gridData.rows,
    isEmpty: gridData.rows.length === 0,
  };
}

// ============================================================================
// Factory-Created Components
// ============================================================================

export const RowCountDiffResultView = createResultView<
  RowCountDiffRun,
  unknown,
  DataGridHandle
>({
  displayName: "RowCountDiffResultView",
  typeGuard: isRowCountDiffRunGuard,
  expectedRunType: "row_count_diff",
  screenshotWrapper: "grid",
  transformData: transformRowCountData,
  emptyState: "No nodes matched",
}) as ForwardRefExoticComponent<
  RunResultViewProps & RefAttributes<DataGridHandle>
>;

export const RowCountResultView = createResultView<
  RowCountRun,
  unknown,
  DataGridHandle
>({
  displayName: "RowCountResultView",
  typeGuard: isRowCountRunGuard,
  expectedRunType: "row_count",
  screenshotWrapper: "grid",
  transformData: transformRowCountData,
  emptyState: "No nodes matched",
}) as ForwardRefExoticComponent<
  RunResultViewProps & RefAttributes<DataGridHandle>
>;
