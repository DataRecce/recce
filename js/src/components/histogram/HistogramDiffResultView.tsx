import { HistogramDiffParams, HistogramDiffResult } from "@/lib/api/profile";
import { RunResultViewProps } from "../run/types";
import { HStack, Box, Flex, Spacer } from "@chakra-ui/react";
import { HistogramChart } from "../charts/HistogramChart";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";
import { forwardRef, Ref } from "react";
import { isHistogramDiffRun } from "@/lib/api/types";

type HistogramDiffResultViewProp = RunResultViewProps;

function _HistogramDiffResultView({ run }: HistogramDiffResultViewProp, ref: Ref<HTMLDivElement>) {
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
    <Flex direction="column" height="100%">
      <ScreenshotBox ref={ref} height="100%">
        <HStack>
          <Spacer />
          <Box w="80%" h="35vh" m="4">
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
          <Spacer />
        </HStack>
      </ScreenshotBox>
    </Flex>
  );
}

export const HistogramDiffResultView = forwardRef(_HistogramDiffResultView);
