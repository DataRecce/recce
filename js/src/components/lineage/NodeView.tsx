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
} from "@chakra-ui/react";
import { LineageGraphNode } from "./lineage";
import { SchemaView } from "../schema/SchemaView";

interface NodeViewProps {
  node: LineageGraphNode;
  onClose: () => void;
}

export function NodeView({ node, onClose }: NodeViewProps) {
  const withColumns =
    node.resourceType === "model" ||
    node.resourceType === "seed" ||
    node.resourceType === "source";

  return (
    <Grid height="100%" templateRows="auto 1fr">
      <HStack>
        <Box flex="0 0 88%" p="16px">
          <Heading size="sm">{node.name}</Heading>
          <Box color="gray">{node.resourceType}</Box>
        </Box>
        <Box flex="0 0 10%" p="16px">
          <CloseButton onClick={onClose}/>
        </Box>
      </HStack>

      {withColumns && (
        <Tabs overflow="auto" as={Flex}>
          <TabList>
            <Tab>Columns</Tab>
          </TabList>
          <TabPanels overflow="auto" height="calc(100% - 42px)">
            <TabPanel p={0} overflowY="auto" height="100%">
              <SchemaView base={node.data.base} current={node.data.current} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </Grid>
  );
}
