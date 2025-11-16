import { Flex, Heading, HStack, Link, Spacer } from "@chakra-ui/react";
import { forwardRef, Ref, useState } from "react";
import { TopKDiffParams, TopKDiffResult } from "@/lib/api/profile";
import { TopKSummaryBarChart } from "../charts/TopKSummaryList";
import { RunResultViewProps } from "../run/types";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";

type TopKDiffResultViewProp = RunResultViewProps;

const PrivateTopKDiffResultView = (
  { run }: TopKDiffResultViewProp,
  ref: Ref<HTMLDivElement>,
) => {
  const [isDisplayTopTen, setIsDisplayTopTen] = useState<boolean>(true);
  // TODO: Implement TopKDiffResultView
  const result = run.result as TopKDiffResult;
  const params = run.params as TopKDiffParams;

  const baseTopK = result.base;
  const currentTopK = result.current;

  return (
    <Flex direction="column" height={"100%"}>
      <ScreenshotBox ref={ref} blockSize={"auto"}>
        <Heading
          as="h1"
          size="md"
          paddingTop={4}
          textAlign="center"
          color="gray.600"
        >
          Model {params.model}.{params.column_name}
        </Heading>
        <HStack>
          <Spacer />
          <TopKSummaryBarChart
            topKDiff={result}
            valids={currentTopK.valids || 0}
            isDisplayTopTen={isDisplayTopTen}
          />
          <Spacer />
        </HStack>
      </ScreenshotBox>
      <Spacer />
      {(baseTopK.values.length > 10 || currentTopK.values.length > 10) && (
        <Flex p={5} justify={"start"}>
          <Link
            onClick={() => {
              setIsDisplayTopTen((prevState) => !prevState);
            }}
            colorPalette="blue"
          >
            {isDisplayTopTen ? "View More Items" : "View Only Top-10"}
          </Link>
        </Flex>
      )}
    </Flex>
  );
};

export const TopKDiffResultView = forwardRef(PrivateTopKDiffResultView);
