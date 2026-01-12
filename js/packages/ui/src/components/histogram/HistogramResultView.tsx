"use client";

/**
 * @file HistogramResultView.tsx
 * @description Framework-agnostic Histogram result view components for @datarecce/ui
 *
 * These components use the createResultView factory pattern and can be used by both
 * Recce OSS and Recce Cloud. They accept generic Run types and use type guards
 * for validation.
 *
 * The components display histogram diff data as a chart:
 * - HistogramDiffResultView: Diff between base and current histogram distributions
 */

import Box from "@mui/material/Box";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  type HistogramDiffParams,
  type HistogramDiffResult,
  isHistogramDiffRun,
  type Run,
} from "../../api";
import { HistogramChart, type HistogramDataType } from "../../primitives";
import { createResultView } from "../result/createResultView";
import type { CreatedResultViewProps, ResultViewData } from "../result/types";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Run type with histogram_diff result
 */
export type HistogramDiffRun = Run & {
  type: "histogram_diff";
  params?: HistogramDiffParams;
  result?: HistogramDiffResult;
};

/**
 * Props for HistogramDiffResultView component
 */
export interface HistogramResultViewProps
  extends CreatedResultViewProps<unknown> {
  run: HistogramDiffRun | unknown;
}

// ============================================================================
// Type Guard (wrapper to accept unknown)
// ============================================================================

function isHistogramDiffRunGuard(run: unknown): run is HistogramDiffRun {
  return isHistogramDiffRun(run as Run);
}

// ============================================================================
// Factory-Created Component
// ============================================================================

/**
 * Result view for histogram diff comparison between base and current environments
 *
 * Displays a chart comparing histogram distributions between base and current.
 * The chart title shows the model and column name.
 *
 * @example
 * ```tsx
 * <HistogramDiffResultView run={histogramDiffRun} ref={boxRef} />
 * ```
 */
export const HistogramDiffResultView = createResultView<
  HistogramDiffRun,
  unknown,
  HTMLDivElement
>({
  displayName: "HistogramDiffResultView",
  typeGuard: isHistogramDiffRunGuard,
  expectedRunType: "histogram_diff",
  screenshotWrapper: "box",
  conditionalEmptyState: (run) => {
    const base = run.result?.base;
    const current = run.result?.current;
    if (!base || !current) {
      return <div>Loading...</div>;
    }
    return null;
  },
  transformData: (run): ResultViewData | null => {
    const params = run.params as HistogramDiffParams;
    const base = run.result?.base;
    const current = run.result?.current;
    const min = run.result?.min;
    const max = run.result?.max;
    const binEdges = run.result?.bin_edges ?? [];

    // This shouldn't happen due to conditionalEmptyState, but type safety
    if (!base || !current) {
      return { isEmpty: true };
    }

    // Map column_type to HistogramDataType
    const columnType = (run.params?.column_type ?? "numeric") as string;
    const dataType: HistogramDataType =
      columnType === "datetime"
        ? "datetime"
        : columnType === "string"
          ? "string"
          : "numeric";

    return {
      content: (
        <Box sx={{ display: "flex", flexDirection: "row" }}>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ width: "80%", height: "35vh", m: 4 }}>
            <HistogramChart
              title={`Model ${params.model}.${params.column_name}`}
              dataType={dataType}
              baseData={{ counts: base.counts }}
              currentData={{ counts: current.counts }}
              min={min}
              max={max}
              samples={base.total}
              binEdges={binEdges}
            />
          </Box>
          <Box sx={{ flex: 1 }} />
        </Box>
      ),
    };
  },
}) as ForwardRefExoticComponent<
  HistogramResultViewProps & RefAttributes<HTMLDivElement>
>;
