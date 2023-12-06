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
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineageGraphNode } from "./lineage";
import { SchemaView } from "../schema/SchemaView";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { SqlDiffView } from "../schema/SqlDiffView";

interface NodeViewProps {
  node: LineageGraphNode;
  onCloseNode: () => void;
}

export function NodeView({ node, onCloseNode }: NodeViewProps) {
  const router = useRouter();
  const { setSqlQuery } = useRecceQueryContext();
  const withColumns =
    node.resourceType === "model" ||
    node.resourceType === "seed" ||
    node.resourceType === "source";
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Grid height="100%" templateRows="auto 1fr">
      <HStack>
        <Box flex="0 0 60%" p="16px">
          <Heading size="sm">{node.name}</Heading>
          <Box color="gray">{node.resourceType}</Box>
        </Box>
        {node.changeStatus === "modified" && (
          <>
            <Button onClick={onOpen}>Code Diff</Button>
            <Modal isOpen={isOpen} onClose={onClose} size="6xl">
              <ModalOverlay />
              <ModalContent>
                <ModalHeader>Model Raw Code Diff</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  <SqlDiffView
                    base={node.data.base}
                    current={node.data.current}
                  />
                </ModalBody>
              </ModalContent>
            </Modal>
          </>
        )}
        <Box flex="0 0 5%" p="16px">
          <CloseButton onClick={onCloseNode} />
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
          <Button
            colorScheme="blue"
            size="sm"
            onClick={() => {
              setSqlQuery(`select * from {{ ref("${node.name}") }}`);
              router.push("/#query");
            }}
          >
            Query
          </Button>
        </HStack>
      )}
    </Grid>
  );
}
