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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineageGraphNode } from "./lineage";
import { SchemaView } from "../schema/SchemaView";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";

interface NodeViewProps {
  node: LineageGraphNode;
  onClose: () => void;
}

export function NodeView({ node, onClose }: NodeViewProps) {
  const router = useRouter();
  const { setSqlQuery } = useRecceQueryContext();
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
      {node.resourceType === "model" && (
      <HStack p="16px">
        <Spacer />
          <Button colorScheme="blue" size="sm" onClick={() => {
            setSqlQuery(`select * from {{ ref("${node.name}") }}`);
            router.push('/#query');
          }}>
            Query
          </Button>
      </HStack>
      )}
    </Grid>
  );
}
