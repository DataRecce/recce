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
import { createCheckByNodeSchema, createCheckByRun } from "@/lib/api/checks";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";

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
  const {
    isOpen: isCodeDiffOpen,
    onOpen: onCodeDiffOpen,
    onClose: onCodeDiffClose,
  } = useDisclosure();
  const { runAction } = useRecceActionContext();

  const addSchemaCheck = useCallback(async () => {
    const nodeId = node.id;
    const check = await createCheckByNodeSchema(nodeId);
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
              onClick={onCodeDiffOpen}
              leftIcon={<FaCode />}
              colorScheme="orange"
              variant="solid"
            >
              Diff
            </Button>
            <Modal isOpen={isCodeDiffOpen} onClose={onCodeDiffClose} size="6xl">
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
          {node.resourceType === "model" && (
            <RowCountTag node={node} isInteractive />
          )}
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
              </MenuList>
            </Menu>
            <Spacer />

            {node.resourceType === "model" && (
              <>
                {node.changeStatus !== "added" &&
                  node.changeStatus !== "removed" && (
                    <>
                      <Menu>
                        <MenuButton as={Button} size="sm" colorScheme="blue">
                          Advanced Diffs
                        </MenuButton>
                        <MenuList>
                          <MenuItem
                            onClick={() => {
                              runAction(
                                "profile_diff",
                                {
                                  model: node.name,
                                },
                                { showForm: false, showLast: true }
                              );
                            }}
                          >
                            Profile Diff
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              runAction(
                                "value_diff",
                                {
                                  model: node.name,
                                },
                                { showForm: true, showLast: true }
                              );
                            }}
                          >
                            Value Diff
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              runAction(
                                "top_k_diff",
                                { model: node.name, column_name: "", k: 50 },
                                { showForm: true }
                              );
                            }}
                          >
                            Top-K Diff
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              runAction(
                                "histogram_diff",
                                {
                                  model: node.name,
                                  column_name: "",
                                  column_type: "",
                                },
                                { showForm: true }
                              );
                            }}
                          >
                            Histogram Diff
                          </MenuItem>
                        </MenuList>
                      </Menu>
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
