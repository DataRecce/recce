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
  ButtonGroup,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";

import { FaCode } from "react-icons/fa";
import { LineageGraphNode } from "./lineage";
import { SchemaView } from "../schema/SchemaView";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { SqlDiffView } from "../schema/SqlDiffView";
import { useLocation } from "wouter";
import { ResourceTypeTag, RowCountTag } from "./NodeTag";
import { useCallback } from "react";
import { ProfileDiffModal } from "./Profile";
import {
  createCheckByNodeSchema,
  createCheckByRowCounts,
} from "@/lib/api/checks";
import { ValueDiffModal } from "./ValueDiff";

interface NodeViewProps {
  node: LineageGraphNode;
  onCloseNode: () => void;
}

export function NodeView({ node, onCloseNode }: NodeViewProps) {
  const [, setLocation] = useLocation();
  const { setSqlQuery } = useRecceQueryContext();
  const withColumns =
    node.resourceType === "model" ||
    node.resourceType === "seed" ||
    node.resourceType === "source";
  const { isOpen, onOpen, onClose } = useDisclosure();

  const addSchemaCheck = useCallback(async () => {
    const nodeId = node.id;
    const check = await createCheckByNodeSchema(nodeId);
    setLocation(`/checks/${check.check_id}`);
  }, [node, setLocation]);

  const addRowCountCheck = useCallback(async () => {
    const nodeId = node.id;
    const check = await createCheckByRowCounts([nodeId]);
    setLocation(`/checks/${check.check_id}`);
  }, [node, setLocation]);

  return (
    <Grid height="100%" templateRows="auto auto 1fr">
      <HStack>
        <Box flex="0 1 20%" p="16px">
          <Heading size="sm">{node.name}</Heading>
        </Box>
        <Spacer />
        {node.changeStatus === "modified" && (
          <Box>
            <Button
              onClick={onOpen}
              leftIcon={<FaCode />}
              colorScheme="orange"
              variant="solid"
            >
              Diff
            </Button>
            <Modal isOpen={isOpen} onClose={onClose} size="6xl">
              <ModalOverlay />
              <ModalContent overflowY="auto" height="75%">
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
          </Box>
        )}
        <Box flex="0 1 1%" p="16px">
          <CloseButton onClick={onCloseNode} />
        </Box>
      </HStack>
      <Box color="gray" paddingLeft={"16px"}>
        <HStack spacing={"8px"}>
          <ResourceTypeTag node={node} />
          {node.resourceType === "model" && <RowCountTag node={node} />}
        </HStack>
      </Box>
      {withColumns && (
        <>
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
          <HStack p="16px">
            <Menu>
              <MenuButton as={Button} size="sm" colorScheme="blue">
                Add check
              </MenuButton>
              <MenuList>
                <MenuItem onClick={addSchemaCheck}>Schema Check</MenuItem>
                <MenuItem onClick={addRowCountCheck}>Row Count Check</MenuItem>
              </MenuList>
            </Menu>
            <Spacer />
            {node.resourceType === "model" && (
              <>
                {node.changeStatus !== "added" &&
                  node.changeStatus !== "removed" && (
                    <>
                      <ProfileDiffModal node={node} />
                      <ValueDiffModal node={node} />
                    </>
                  )}
                <Button
                  colorScheme="blue"
                  size="sm"
                  onClick={() => {
                    setSqlQuery(`select * from {{ ref("${node.name}") }}`);
                    setLocation("/query");
                  }}
                >
                  Query
                </Button>
              </>
            )}
          </HStack>
        </>
      )}
    </Grid>
  );
}
