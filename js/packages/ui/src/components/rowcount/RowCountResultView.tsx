"use client";

/**
 * @file RowCountResultView.tsx
 * @description Framework-agnostic Row Count result view components for @datarecce/ui
 *
 * These components use the createResultView factory pattern and can be used by both
 * Recce OSS and Recce Cloud. They accept generic Run types and use type guards
 * for validation.
 *
 * The components display row count data in a grid format:
 * - RowCountResultView: Single environment row counts (name, count)
 * - RowCountDiffResultView: Diff between environments (name, base, current, delta)
 */

import Box from "@mui/material/Box";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  isRowCountDiffRun,
  isRowCountRun,
  type RowCountDiffResult,
  type RowCountResult,
  type Run,
} from "../../api";
import { getSemanticColorTheme } from "../../theme";
import { toRowCountDataGrid, toRowCountDiffDataGrid } from "../../utils";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";
import { createResultView } from "../result/createResultView";
import type {
  CreatedResultViewProps,
  ResultViewData,
  ResultViewTransformOptions,
} from "../result/types";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Run type with row_count result
 */
export type RowCountRun = Run & {
  type: "row_count";
  result?: RowCountResult;
};

/**
 * Run type with row_count_diff result
 */
export type RowCountDiffRun = Run & {
  type: "row_count_diff";
  result?: RowCountDiffResult;
};

/**
 * Props for RowCountResultView components
 */
export interface RowCountResultViewProps
  extends CreatedResultViewProps<unknown> {
  run: RowCountRun | RowCountDiffRun | unknown;
}

// ============================================================================
// Type Guards (wrapper to accept unknown)
// ============================================================================

function isRowCountRunGuard(run: unknown): run is RowCountRun {
  return isRowCountRun(run as Run);
}

function isRowCountDiffRunGuard(run: unknown): run is RowCountDiffRun {
  return isRowCountDiffRun(run as Run);
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform RowCountRun data to grid format
 */
function transformRowCountData(run: RowCountRun): ResultViewData | null {
  if (!run.result) {
    return null;
  }

  const gridData = toRowCountDataGrid(run.result);

  return {
    columns: gridData.columns,
    rows: gridData.rows,
    isEmpty: gridData.rows.length === 0,
  };
}

/**
 * Transform RowCountDiffRun data to grid format
 */
function transformRowCountDiffData(
  run: RowCountDiffRun,
  { isDark }: ResultViewTransformOptions<unknown>,
): ResultViewData | null {
  if (!run.result) {
    return null;
  }

  const gridData = toRowCountDiffDataGrid(run.result);

  return {
    columns: gridData.columns,
    rows: gridData.rows,
    isEmpty: gridData.rows.length === 0,
    footer: <RowCountDiffLegend isDark={isDark} />,
  };
}

export function RowCountDiffLegend({ isDark }: { isDark: boolean }) {
  const direction = getSemanticColorTheme(isDark).direction;
  const items = [
    {
      symbol: "↑",
      label: "Increase",
      direction: "increase",
    },
    {
      symbol: "↓",
      label: "Decrease",
      direction: "decrease",
    },
    {
      symbol: "=",
      label: "No change",
      direction: "equal",
    },
  ];

  return (
    <Box
      component="ul"
      aria-label="Row count change legend"
      data-color-axis="neutral-direction"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        m: 0,
        px: 2,
        py: 1,
        borderTop: 1,
        borderColor: "divider",
        listStyle: "none",
        bgcolor: direction.background,
        color: direction.foreground,
        fontSize: "0.8125rem",
      }}
    >
      {items.map((item) => (
        <Box
          component="li"
          key={item.label}
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
        >
          <Box
            component="span"
            aria-hidden="true"
            data-direction={item.direction}
            sx={{
              width: 14,
              height: 14,
              borderRadius: 0.5,
              bgcolor: direction.background,
              border: `1px solid ${direction.border}`,
            }}
          />
          {`${item.symbol} ${item.label}`}
        </Box>
      ))}
    </Box>
  );
}

// ============================================================================
// Factory-Created Components
// ============================================================================

/**
 * Result view for single environment row counts
 *
 * Displays a grid with model names and their row counts.
 *
 * @example
 * ```tsx
 * <RowCountResultView run={rowCountRun} ref={gridRef} />
 * ```
 */
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
  RowCountResultViewProps & RefAttributes<DataGridHandle>
>;

/**
 * Result view for comparing row counts between base and current environments
 *
 * Displays a grid with model names, base counts, current counts, and delta.
 * The Delta cell uses neutral direction styling with arrows and signed values
 * as the non-color cues.
 *
 * @example
 * ```tsx
 * <RowCountDiffResultView run={rowCountDiffRun} ref={gridRef} />
 * ```
 */
export const RowCountDiffResultView = createResultView<
  RowCountDiffRun,
  unknown,
  DataGridHandle
>({
  displayName: "RowCountDiffResultView",
  typeGuard: isRowCountDiffRunGuard,
  expectedRunType: "row_count_diff",
  screenshotWrapper: "grid",
  transformData: transformRowCountDiffData,
  emptyState: "No nodes matched",
}) as ForwardRefExoticComponent<
  RowCountResultViewProps & RefAttributes<DataGridHandle>
>;
