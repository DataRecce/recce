import { TopKDiffParams, TopKDiffResult } from "@/lib/api/profile";
import { RunResultViewProps } from "../run/types";
import {
  Flex,
  HStack,
  Heading,
  Spacer,
  Link,
  forwardRef,
} from "@chakra-ui/react";
import { TopKSummaryBarChart } from "../charts/TopKSummaryList";
import { useState } from "react";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";

interface TopKDiffResultViewProp
  extends RunResultViewProps<TopKDiffParams, TopKDiffResult> {}

const _TopKDiffResultView = ({ run }: TopKDiffResultViewProp, ref: any) => {
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
            onClick={() => setIsDisplayTopTen((prevState) => !prevState)}
            textColor={"blue.500"}
          >
            {isDisplayTopTen ? "View More Items" : "View Only Top-10"}
          </Link>
        </Flex>
      )}
    </Flex>
  );
};

export const TopKDiffResultView = forwardRef(_TopKDiffResultView);
