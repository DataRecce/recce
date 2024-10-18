import { HistogramDiffParams, HistogramDiffResult } from "@/lib/api/profile";
import { RunResultViewProps } from "../run/types";
import {
  HStack,
  Box,
  Flex,
  Spacer,
  Heading,
  forwardRef,
} from "@chakra-ui/react";
import { HistogramChart } from "../charts/HistogramChart";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";

interface HistogramDiffResultViewProp
  extends RunResultViewProps<HistogramDiffParams, HistogramDiffResult> {}

function _HistogramDiffResultView(
  { run }: HistogramDiffResultViewProp,
  ref: any
) {
  const params = run.params as HistogramDiffParams;
  const base = run.result?.base;
  const current = run.result?.current;
  const min = run.result?.min;
  const max = run.result?.max;
  const binEdges = run.result?.bin_edges as [];

  if (!base || !current) {
    return <div>Loading...</div>;
  }

  return (
    <Flex direction="column" height="500px">
      <ScreenshotBox ref={ref} height="100%">
        <Heading as="h1" size="md" paddingTop="4" textAlign="center">
          Model {params.model}.{params.column_name}
        </Heading>
        <HStack>
          <Spacer />
          <Box w="80%" h="300px" m="4">
            {/* <Heading as='h3' size="sm" m="2" color='gray'>Base</Heading> */}
            <HistogramChart
              data={{
                type: run.params?.column_type || "",
                datasets: [current, base],
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