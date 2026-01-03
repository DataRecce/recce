import { ScreenshotBox } from "@datarecce/ui/primitives";
import Box from "@mui/material/Box";
import { forwardRef, Ref } from "react";
import { HistogramDiffParams } from "@/lib/api/profile";
import { isHistogramDiffRun } from "@/lib/api/types";
import { useIsDark } from "@/lib/hooks/useIsDark";
import { HistogramChart } from "../charts/HistogramChart";
import { RunResultViewProps } from "../run/types";

type HistogramDiffResultViewProp = RunResultViewProps;

function _HistogramDiffResultView(
  { run }: HistogramDiffResultViewProp,
  ref: Ref<HTMLDivElement>,
) {
  const isDark = useIsDark();

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
      <ScreenshotBox
        ref={ref}
        height="100%"
        backgroundColor={isDark ? "#1f2937" : "white"}
      >
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
