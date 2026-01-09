import {
  type HistogramDiffParams,
  isHistogramDiffRun,
} from "@datarecce/ui/api";
import { createResultView } from "@datarecce/ui/components/result/createResultView";
import type { ResultViewData } from "@datarecce/ui/components/result/types";
import {
  HistogramChart,
  type HistogramDataType,
} from "@datarecce/ui/primitives";
import Box from "@mui/material/Box";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
// Import Run from OSS types for proper discriminated union support with Extract<>
import type { Run } from "@/lib/api/types";
import type { RunResultViewProps } from "../run/types";

// ============================================================================
// Type Definitions
// ============================================================================

type HistogramDiffRun = Extract<Run, { type: "histogram_diff" }>;

// ============================================================================
// Type Guard (wrapper to accept unknown)
// ============================================================================

function isHistogramDiffRunGuard(run: unknown): run is HistogramDiffRun {
  return isHistogramDiffRun(run as Run);
}

// ============================================================================
// Factory-Created Component
// ============================================================================

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
  RunResultViewProps & RefAttributes<HTMLDivElement>
>;
