import { HistogramDiffParams, HistogramDiffResult } from "@/lib/api/profile";
import { RunResultViewProps } from "../run/types";
import { HStack, Box, Flex , Spacer } from "@chakra-ui/react";
import { HistogramChart } from "../charts/HistogramChart";


interface HistogramDiffResultViewProp extends RunResultViewProps<HistogramDiffParams, HistogramDiffResult> {}

export function HistogramDiffResultView({ run }: HistogramDiffResultViewProp) {
  const base = run.result?.base;
  const current = run.result?.current;
  const min = run.result?.min;
  const max = run.result?.max;

  if (!base || !current) {
    return <div>Loading...</div>;
  }

  return (
    <Flex direction='column' height={'100%'}>
      <HStack>
        <Spacer />
        <Box w="40%" h="300px" m={4}>
          <h2>Base</h2>
          <HistogramChart data={{
            type: run.params?.column_type || '',
            histogram: base,
            min: min,
            max: max,
            samples: base.total,
          }} />
        </Box>
        <Box w="40%" h="300px" m={4}>
          <h2>Current</h2>
          <HistogramChart data={{
            type: run.params?.column_type || '',
            histogram: current,
            min: min,
            max: max,
            samples: current.total,
          }} />
        </Box>
        <Spacer />
      </HStack>
    </Flex>
  );
}
