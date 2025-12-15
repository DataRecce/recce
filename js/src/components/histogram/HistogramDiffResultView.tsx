import Box from "@mui/material/Box";
import { forwardRef, Ref } from "react";
import { HistogramDiffParams } from "@/lib/api/profile";
import { isHistogramDiffRun } from "@/lib/api/types";
import { HistogramChart } from "../charts/HistogramChart";
import { RunResultViewProps } from "../run/types";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";

type HistogramDiffResultViewProp = RunResultViewProps;

function _HistogramDiffResultView(
  { run }: HistogramDiffResultViewProp,
  ref: Ref<HTMLDivElement>,
) {
  if (!isHistogramDiffRun(run)) {
    throw new Error("Run type must be histogram_diff");
  }

  const params = run.params as HistogramDiffParams;
  const base = run.result?.base;
  const current = run.result?.current;
  const min = run.result?.min;
  const max = run.result?.max;
  const binEdges = run.result?.bin_edges ?? [];

  if (!base || !current) {
    return <div>Loading...</div>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenshotBox ref={ref} height="100%">
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
      </ScreenshotBox>
    </Box>
  );
}

export const HistogramDiffResultView = forwardRef(_HistogramDiffResultView);
