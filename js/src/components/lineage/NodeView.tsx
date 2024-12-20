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
  MenuDivider,
  Icon,
  MenuGroup,
  Tooltip,
} from "@chakra-ui/react";

import { FaCode } from "react-icons/fa";
import { LineageGraphNode } from "./lineage";
import { SchemaView } from "../schema/SchemaView";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { SqlDiffView } from "../schema/SqlDiffView";
import { useLocation } from "wouter";
import { ResourceTypeTag, RowCountTag } from "./NodeTag";
import { useCallback } from "react";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import useModelColumns from "@/lib/hooks/useModelColumns";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import { findByRunType } from "../run/registry";
import { is } from "date-fns/locale";
import { run } from "node:test";
import { DisableTooltipMessages } from "@/constants/tooltipMessage";
import { PreviewChangeView } from "./PreviewChangeView";

interface NodeViewProps {
  node: LineageGraphNode;
  onCloseNode: () => void;
}

const EmptyIcon = () => <Box as="span" w="12px" />;

export function NodeView({ node, onCloseNode }: NodeViewProps) {
  const [, setLocation] = useLocation();
  const { setSqlQuery, setPrimaryKeys } = useRecceQueryContext();
  const withColumns =
    node.resourceType === "model" ||
    node.resourceType === "seed" ||
    node.resourceType === "source" ||
    node.resourceType === "snapshot";
  const {
    isOpen: isCodeDiffOpen,
    onOpen: onCodeDiffOpen,
    onClose: onCodeDiffClose,
  } = useDisclosure();
  const {
    isOpen: isPreviewChangeOpen,
    onOpen: onPreviewChangeOpen,
    onClose: onPreviewChangeClose,
  } = useDisclosure();
  const { runAction } = useRecceActionContext();
  const { envInfo, isActionAvailable } = useLineageGraphContext();
  const { primaryKey } = useModelColumns(node.name);
  const refetchRowCount = () => {
    runAction(
      "row_count_diff",
      { node_names: [node.name] },
      { showForm: false, showLast: false }
    );
  };

  const addSchemaCheck = useCallback(async () => {
    const nodeId = node.id;
    const check = await createSchemaDiffCheck({ node_id: nodeId });
    setLocation(`/checks/${check.check_id}`);
  }, [node, setLocation]);

  const disableReason = (isAddedOrRemoved: boolean, runType: string) => {
    if (isAddedOrRemoved) {
      return DisableTooltipMessages.add_or_remove;
    }
    if (!isActionAvailable(runType)) {
      if (runType === "value_diff") {
        return DisableTooltipMessages.audit_helper;
      } else if (runType === "profile_diff") {
        return DisableTooltipMessages.dbt_profiler;
      } else {
        return "This action is not supported yet.";
      }
    }
    return "";
  };

  const isAddedOrRemoved =
    node.changeStatus === "added" || node.changeStatus === "removed";

  return (
    <Grid height="100%" templateRows="auto auto 1fr">
      <HStack>
        <Box flex="0 1 20%" p="16px">
          <Heading size="sm">{node.name}</Heading>
        </Box>
        <Spacer />
        {(node.resourceType === "model" ||
          node.resourceType === "seed" ||
          node.resourceType === "snapshot") && (
          <Menu>
            <MenuButton as={Button} size="sm" colorScheme="blue">
              Explore Change
            </MenuButton>
            <MenuList>
              <MenuItem
                icon={<Icon as={findByRunType("query_diff")?.icon} />}
                fontSize="14px"
                onClick={() => {
                  if (envInfo?.adapterType === "dbt") {
                    setSqlQuery(`select * from {{ ref("${node.name}") }}`);
                  } else if (envInfo?.adapterType === "sqlmesh") {
                    setSqlQuery(`select * from ${node.name}`);
                  }
                  if (isActionAvailable("query_diff_with_primary_key")) {
                    // Only set primary key if the action is available
                    setPrimaryKeys(
                      primaryKey !== undefined ? [primaryKey] : undefined
                    );
                  }
                  setLocation("/query");
                }}
              >
                Query
              </MenuItem>
              <MenuItem
                fontSize="14px"
                icon={<Icon as={findByRunType("preview_change")?.icon} />}
                onClick={onPreviewChangeOpen}
              >
                Preview Change (Experiment)
              </MenuItem>
              <MenuDivider />
              <MenuGroup title="Diff" m="0" p="4px 12px">
                {(node.resourceType === "model" ||
                  node.resourceType === "snapshot") && (
                  <MenuItem
                    onClick={onCodeDiffOpen}
                    icon={<FaCode />}
                    fontSize="14px"
                  >
                    Code Diff
                  </MenuItem>
                )}
                <MenuItem
                  icon={<Icon as={findByRunType("row_count_diff")?.icon} />}
                  fontSize="14px"
                  onClick={() => refetchRowCount()}
                >
                  Row Count Diff
                </MenuItem>
                <Tooltip
                  label={disableReason(isAddedOrRemoved, "profile_diff")}
                  placement="left"
                >
                  <MenuItem
                    icon={<Icon as={findByRunType("profile_diff")?.icon} />}
                    fontSize="14px"
                    isDisabled={
                      isAddedOrRemoved || !isActionAvailable("profile_diff")
                    }
                    onClick={() => {
                      runAction(
                        "profile_diff",
                        {
                          model: node.name,
                        },
                        { showForm: false, showLast: false }
                      );
                    }}
                  >
                    Profile Diff
                  </MenuItem>
                </Tooltip>
                <Tooltip
                  label={disableReason(isAddedOrRemoved, "value_diff")}
                  placement="left"
                >
                  <MenuItem
                    icon={<Icon as={findByRunType("value_diff")?.icon} />}
                    fontSize="14px"
                    isDisabled={
                      isAddedOrRemoved || !isActionAvailable("value_diff")
                    }
                    onClick={() => {
                      runAction(
                        "value_diff",
                        {
                          model: node.name,
                        },
                        { showForm: true, showLast: false }
                      );
                    }}
                  >
                    Value Diff
                  </MenuItem>
                </Tooltip>
                <Tooltip
                  label={disableReason(isAddedOrRemoved, "top_k_diff")}
                  placement="left"
                >
                  <MenuItem
                    icon={<Icon as={findByRunType("top_k_diff")?.icon} />}
                    fontSize="14px"
                    isDisabled={isAddedOrRemoved}
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
                </Tooltip>
                <Tooltip
                  label={disableReason(isAddedOrRemoved, "histogram_diff")}
                  placement="left"
                >
                  <MenuItem
                    icon={<Icon as={findByRunType("histogram_diff")?.icon} />}
                    fontSize="14px"
                    isDisabled={isAddedOrRemoved}
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
                </Tooltip>
              </MenuGroup>
              <MenuDivider />
              <MenuGroup title="Add to Checklist" m="0" p="4px 12px">
                <MenuItem
                  icon={<Icon as={findByRunType("schema_diff")?.icon} />}
                  fontSize="14px"
                  onClick={addSchemaCheck}
                >
                  Schema Diff
                </MenuItem>
              </MenuGroup>
            </MenuList>
          </Menu>
        )}
        {/* )} */}
        <Box flex="0 1 1%">
          <CloseButton onClick={onCloseNode} />
        </Box>
      </HStack>
      <Box color="gray" paddingLeft={"16px"}>
        <HStack spacing={"8px"}>
          <ResourceTypeTag node={node} />
          {(node.resourceType === "model" ||
            node.resourceType === "snapshot" ||
            node.resourceType === "seed") && (
            <RowCountTag node={node} onRefresh={refetchRowCount} />
          )}
        </HStack>
      </Box>
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
      <Modal isOpen={isCodeDiffOpen} onClose={onCodeDiffClose} size="6xl">
        <ModalOverlay />
        <ModalContent overflowY="auto" height="75%">
          <ModalHeader>Model Raw Code Diff</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <SqlDiffView base={node.data.base} current={node.data.current} />
          </ModalBody>
        </ModalContent>
      </Modal>
      <PreviewChangeView
        isOpen={isPreviewChangeOpen}
        onClose={onPreviewChangeClose}
        current={node.data.current}
      />
    </Grid>
  );
}
