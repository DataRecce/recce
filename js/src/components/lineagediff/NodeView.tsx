import {
  Box,
  Flex,
  Grid,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  VStack,
} from "@chakra-ui/react";
import { LineageGraphNode, NodeData } from "./lineagediff";
import { SchemaView } from "../schemadiff/SchemaView";

interface NodeViewProps {
  node: LineageGraphNode;
}

export function NodeView({ node }: NodeViewProps) {
  const withColumns =
    node.resourceType === "model" ||
    node.resourceType === "seed" ||
    node.resourceType === "source";

  return (
    <Grid height="100%" templateRows="auto 1fr">
      <Box flex="0 0" p="16px">
        <Heading size="sm">{node.name}</Heading>
        <Box color="gray">{node.resourceType}</Box>
      </Box>

      {withColumns && (
        <Tabs overflow="auto" as={Flex}>
          <TabList>
            <Tab>Columns</Tab>
          </TabList>
          <TabPanels overflow="auto" height="calc(100% - 42px)">
            <TabPanel p={0} overflowY="auto" height="100%">
              <SchemaView
                base={node.data.base?.columns}
                current={node.data.current?.columns}
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </Grid>
  );
}
