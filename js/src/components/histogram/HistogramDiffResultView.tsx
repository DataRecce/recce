import { createResultView } from "@datarecce/ui/components/result/createResultView";
import type { ResultViewData } from "@datarecce/ui/components/result/types";
import Box from "@mui/material/Box";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { type HistogramDiffParams } from "@/lib/api/profile";
import { isHistogramDiffRun, type Run } from "@/lib/api/types";
import { HistogramChart } from "../charts/HistogramChart";
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

    return {
      content: (
        <Box sx={{ display: "flex", flexDirection: "row" }}>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ width: "80%", height: "35vh", m: 4 }}>
            <HistogramChart
              data={{
                title: `Model ${params.model}.${params.column_name}`,
                type: run.params?.column_type ?? "",
                datasets: [base, current],
                min: min,
                max: max,
                samples: base.total,
                binEdges: binEdges,
              }}
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
