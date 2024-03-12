import {
  Box,
  CloseButton,
  Flex,
  Grid,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  HStack,
  Button,
  Spacer,
} from "@chakra-ui/react";

import { LineageGraphNode } from "./lineage";
import { ResourceTypeTag } from "./NodeTag";
import { RunView } from "../run/RunView";
import { ValueDiffResultView } from "../valuediff/ValueDiffResultView";
import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { createCheckByRun } from "@/lib/api/checks";
import { RowCountDiffResultView } from "../rowcount/RowCountDiffResultView";

interface NodeRunViewProps {
  node: LineageGraphNode;
  onCloseNode: () => void;
}

export function NodeRunView({ node, onCloseNode }: NodeRunViewProps) {
  const run = node.action?.run;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [viewOptions, setViewOptions] = useState();

  const handleAddToChecklist = useCallback(async () => {
    if (!run?.run_id) {
      return;
    }

    const check = await createCheckByRun(run.run_id, viewOptions);

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [run?.run_id, setLocation, queryClient, viewOptions]);

  const RunResultView: any =
    node.action?.run?.type === "value_diff"
      ? ValueDiffResultView
      : node.action?.run?.type === "row_count_diff"
      ? RowCountDiffResultView
      : null;

  return (
    <Grid height="100%" templateRows="auto auto 1fr">
      <HStack>
        <Box flex="0 1 20%" p="16px">
          <Heading size="sm">{node.name}</Heading>
        </Box>
        <Spacer />
        <Box flex="0 1 1%" p="16px">
          <CloseButton onClick={onCloseNode} />
        </Box>
      </HStack>
      <Box color="gray" paddingLeft={"16px"}>
        <HStack spacing={"8px"}>
          <ResourceTypeTag node={node} />
        </HStack>
      </Box>

      <Tabs overflow="auto" as={Flex}>
        <TabList>
          <Tab>Run</Tab>
        </TabList>
        <TabPanels overflow="auto" height="calc(100% - 42px)">
          <TabPanel p={0} overflowY="auto" height="100%">
            {RunResultView ? (
              <RunView
                run={node.action?.run}
                viewOptions={viewOptions}
                onViewOptionsChanged={setViewOptions}
                RunResultView={RunResultView}
              />
            ) : (
              <Box p="20px 10px">No run result</Box>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
      <HStack p="16px">
        <Spacer />

        <Button
          size="sm"
          colorScheme="blue"
          isDisabled={!node.action?.run?.result}
          onClick={handleAddToChecklist}
        >
          Add to checklist
        </Button>
      </HStack>
    </Grid>
  );
}
