import { TopKDiffParams, TopKDiffResult } from "@/lib/api/profile";
import { RunResultViewProps } from "../run/types";
import { Box, Flex, HStack, Heading, Spacer, Text, VStack , Divider, Link } from "@chakra-ui/react";
import { TopKSummaryBarChart, TopKSummaryList } from "../charts/TopKSummaryList";
import { useState } from "react";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";

interface TopKDiffResultViewProp extends RunResultViewProps<TopKDiffParams, TopKDiffResult> {}

export function TopKDiffResultView({ run }: TopKDiffResultViewProp) {
  const [isDisplayTopTen, setIsDisplayTopTen] = useState<boolean>(true);
  // TODO: Implement TopKDiffResultView
  const result = run.result as TopKDiffResult;
  const params = run.params as TopKDiffParams;

  const baseTopK = result.base;
  const currentTopK = result.current;

  return (
    <Flex direction='column' height={'100%'}>
      <ScreenshotBox>
        <HStack>
          <Spacer />
          <Box>
            <Heading as='h1' size="md" m="4">Base</Heading>
            <Divider />
            <TopKSummaryList
              topk={baseTopK}
              valids={baseTopK.valids || 0}
              isDisplayTopTen={isDisplayTopTen} />
          </Box>
          <Box>
            <Heading as='h1' size="md" m="4">Current</Heading>
            <Divider />
            <TopKSummaryList
              topk={currentTopK}
              valids={currentTopK.valids || 0}
              isDisplayTopTen={isDisplayTopTen} />
          </Box>
          <Spacer />
        </HStack>
      </ScreenshotBox>
      <Spacer />
      {(baseTopK.values.length > 10 || currentTopK.values.length > 10) && (
        <Flex p={5} justify={'start'}>
          <Link
            onClick={() => setIsDisplayTopTen((prevState) => !prevState)}
            textColor={'blue.500'}
          >
            {isDisplayTopTen ? 'View More Items' : 'View Only Top-10'}
          </Link>
        </Flex>
      )}
    </Flex>
  );
}
