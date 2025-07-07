import {
  Box,
  CloseButton,
  Grid,
  Heading,
  Tabs,
  Text,
  HStack,
  Button,
  Spacer,
  useDisclosure,
  Menu,
  Icon,
  Portal,
} from "@chakra-ui/react";

import { LineageGraphNode } from "./lineage";
import { SchemaView, SingleEnvSchemaView } from "../schema/SchemaView";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { useLocation } from "wouter";
import { ResourceTypeTag, RowCountDiffTag, RowCountTag } from "./NodeTag";
import { useCallback } from "react";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import useModelColumns from "@/lib/hooks/useModelColumns";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import { findByRunType } from "../run/registry";
import { DisableTooltipMessages } from "@/constants/tooltipMessage";
import { trackPreviewChange } from "@/lib/api/track";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { SandboxView } from "./SandboxView";
import { NodeSqlView } from "./NodeSqlView";
import { LearnHowLink, RecceNotification } from "../onboarding-guide/Notification";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { formatSelectColumns } from "@/lib/formatSelect";
import { Tooltip } from "@/components/ui/tooltip";
import { PiCaretDown } from "react-icons/pi";

interface NodeViewProps {
  node: LineageGraphNode;
  onCloseNode: () => void;
}

export function NodeView({ node, onCloseNode }: NodeViewProps) {
  const [, setLocation] = useLocation();
  const { setSqlQuery, setPrimaryKeys } = useRecceQueryContext();
  const withColumns =
    node.resourceType === "model" ||
    node.resourceType === "seed" ||
    node.resourceType === "source" ||
    node.resourceType === "snapshot";

  const { open: isSandboxOpen, onOpen: onSandboxOpen, onClose: onSandboxClose } = useDisclosure();
  const { open: isNotificationOpen, onClose: onNotificationClose } = useDisclosure({
    defaultOpen: true,
  });
  const { runAction } = useRecceActionContext();
  const { envInfo, isActionAvailable } = useLineageGraphContext();
  const { primaryKey } = useModelColumns(node.name);
  const refetchRowCount = () => {
    runAction("row_count", { node_names: [node.name] }, { showForm: false, showLast: false });
  };
  const refetchRowCountDiff = () => {
    runAction("row_count_diff", { node_names: [node.name] }, { showForm: false, showLast: false });
  };
  const { data: flag } = useRecceServerFlag();
  const isSingleEnvOnboarding = flag?.single_env_onboarding;

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
      return "This action is not supported yet.";
    }
    return "";
  };

  const isAddedOrRemoved = node.changeStatus === "added" || node.changeStatus === "removed";

  const baseColumns = Object.keys(node.data.base?.columns ?? {});
  const currentColumns = Object.keys(node.data.current?.columns ?? {});

  function ExploreChangeMenuButton() {
    const formattedColumns = formatSelectColumns(baseColumns, currentColumns);
    let query = `select * from {{ ref("${node.name}") }}`;
    if (formattedColumns.length) {
      query = `select \n  ${formattedColumns.join("\n  ")}\nfrom {{ ref("${node.name}") }}`;
    }
    const { featureToggles } = useRecceInstanceContext();
    if (
      node.resourceType === "model" ||
      node.resourceType === "seed" ||
      node.resourceType === "snapshot"
    ) {
      return (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button size="2xs" variant="outline" disabled={featureToggles.disableNodeActionDropdown}>
              Explore <PiCaretDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item
                  value="query"
                  fontSize="14px"
                  disabled={featureToggles.disableDatabaseQuery}>
                  onClick={() => {
                    if (envInfo?.adapterType === "dbt") {
                      setSqlQuery(query);
                    } else if (envInfo?.adapterType === "sqlmesh") {
                      setSqlQuery(`select * from ${node.name}`);
                    }
                    if (isActionAvailable("query_diff_with_primary_key")) {
                      // Only set primary key if the action is available
                      setPrimaryKeys(primaryKey !== undefined ? [primaryKey] : undefined);
                    }
                    setLocation("/query");
                  }}

                  <Icon as={findByRunType("query_diff")?.icon} /> Query
                </Menu.Item>
                <Menu.Item
                  value="sandbox"
                  fontSize="14px"
                  disabled={featureToggles.disableDatabaseQuery}
                  onClick={() => {
                    if (isActionAvailable("query_diff_with_primary_key")) {
                      // Only set primary key if the action is available
                      setPrimaryKeys(primaryKey !== undefined ? [primaryKey] : undefined);
                    }
                    onSandboxOpen();
                    trackPreviewChange({ action: "explore", node: node.name });
                  }}>
                  <Icon as={findByRunType("sandbox")?.icon} /> Sandbox (Experiment)
                </Menu.Item>
                <Menu.Separator />
                <Menu.ItemGroup m="0" p="0">
                  <Menu.ItemGroupLabel>Diff</Menu.ItemGroupLabel>
                  <Menu.Item
                    value="row-count-diff"
                    fontSize="14px"
                    disabled={featureToggles.disableDatabaseQuery}
                    onClick={() => {
                      refetchRowCountDiff();
                    }}>
                    <Icon as={findByRunType("row_count_diff")?.icon} /> Row Count Diff
                  </Menu.Item>
                  <Tooltip
                    disabled={disableReason(isAddedOrRemoved, "profile_diff") === ""}
                    content={disableReason(isAddedOrRemoved, "profile_diff")}
                    positioning={{ placement: "left" }}>
                    <Menu.Item
                      value="profile-diff"
                      fontSize="14px"
                      disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
                      onClick={() => {
                        runAction(
                          "profile_diff",
                          {
                            model: node.name,
                          },
                          { showForm: true, showLast: false },
                        );
                      }}>
                      <Icon as={findByRunType("profile_diff")?.icon} /> Profile Diff
                    </Menu.Item>
                  </Tooltip>
                  <Tooltip
                    disabled={disableReason(isAddedOrRemoved, "value_diff") === ""}
                    content={disableReason(isAddedOrRemoved, "value_diff")}
                    positioning={{ placement: "left" }}>
                    <Menu.Item
                      value="value-diff"
                      fontSize="14px"
                      disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
                      onClick={() => {
                        runAction(
                          "value_diff",
                          {
                            model: node.name,
                          },
                          { showForm: true, showLast: false },
                        );
                      }}>
                      <Icon as={findByRunType("value_diff")?.icon} /> Value Diff
                    </Menu.Item>
                  </Tooltip>
                  <Tooltip
                    disabled={disableReason(isAddedOrRemoved, "top_k_diff") === ""}
                    content={disableReason(isAddedOrRemoved, "top_k_diff")}
                    positioning={{ placement: "left" }}>
                    <Menu.Item
                      value="top-k-diff"
                      fontSize="14px"
                      disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
                      onClick={() => {
                        runAction(
                          "top_k_diff",
                          { model: node.name, column_name: "", k: 50 },
                          { showForm: true },
                        );
                      }}>
                      <Icon as={findByRunType("top_k_diff")?.icon} /> Top-K Diff
                    </Menu.Item>
                  </Tooltip>
                  <Tooltip
                    disabled={disableReason(isAddedOrRemoved, "histogram_diff") === ""}
                    content={disableReason(isAddedOrRemoved, "histogram_diff")}
                    positioning={{ placement: "left" }}>
                    <Menu.Item
                      value="histogram-diff"
                      fontSize="14px"
                      disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
                      onClick={() => {
                        runAction(
                          "histogram_diff",
                          {
                            model: node.name,
                            column_name: "",
                            column_type: "",
                          },
                          { showForm: true },
                        );
                      }}>
                      <Icon as={findByRunType("histogram_diff")?.icon} /> Histogram Diff
                    </Menu.Item>
                  </Tooltip>
                </Menu.ItemGroup>
                <Menu.Separator />
                <Menu.ItemGroup m="0" p="4px 12px">
                  <Menu.ItemGroupLabel>Add to Checklist</Menu.ItemGroupLabel>
                  <Menu.Item
                    value="schema-diff"
                    fontSize="14px"
                    onClick={() => {
                      void addSchemaCheck();
                    }}>
                    <Icon as={findByRunType("schema_diff")?.icon} /> Schema Diff
                  </Menu.Item>
                </Menu.ItemGroup>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      );
    } else {
      return <></>;
    }
  }

  function SingleEnvironmentMenuButton() {
    const formattedColumns = formatSelectColumns(baseColumns, currentColumns);
    let query = `select * from {{ ref("${node.name}") }}`;
    if (formattedColumns.length) {
      query = `select \n  ${formattedColumns.join("\n  ")}\nfrom {{ ref("${node.name}") }}`;
    }
    if (
      node.resourceType === "model" ||
      node.resourceType === "seed" ||
      node.resourceType === "snapshot"
    ) {
      return (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button size="xs" variant="outline">
              Explore <PiCaretDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item
                  value="label"
                  fontSize="14px"
                  onClick={() => {
                    if (envInfo?.adapterType === "dbt") {
                      setSqlQuery(query);
                    } else if (envInfo?.adapterType === "sqlmesh") {
                      setSqlQuery(`select * from ${node.name}`);
                    }
                    setLocation("/query");
                  }}>
                  <Icon as={findByRunType("query")?.icon} /> Query
                </Menu.Item>
                <Menu.Item
                  value="row-count"
                  fontSize="14px"
                  onClick={() => {
                    refetchRowCount();
                  }}>
                  <Icon as={findByRunType("row_count")?.icon} /> Row Count
                </Menu.Item>
                <Tooltip
                  content={disableReason(isAddedOrRemoved, "profile")}
                  positioning={{ placement: "left" }}>
                  <Menu.Item
                    value="profile"
                    fontSize="14px"
                    disabled={isAddedOrRemoved}
                    onClick={() => {
                      runAction(
                        "profile",
                        {
                          model: node.name,
                        },
                        { showForm: true, showLast: false },
                      );
                    }}>
                    <Icon as={findByRunType("profile")?.icon} /> Profile
                  </Menu.Item>
                </Tooltip>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      );
    } else {
      return <></>;
    }
  }

  return (
    <Grid height="100%" templateRows="auto auto 1fr">
      <HStack>
        <Box flex="0 1 20%" p="16px">
          <Heading size="sm" className="no-track-pii-safe">
            {node.name}
          </Heading>
        </Box>
        <Spacer />
        {isSingleEnvOnboarding ? <SingleEnvironmentMenuButton /> : <ExploreChangeMenuButton />}

        <Box flex="0 1 1%">
          <CloseButton size="2xs" onClick={onCloseNode} />
        </Box>
      </HStack>
      <Box color="gray" paddingLeft={"16px"}>
        <HStack gap={"8px"}>
          <ResourceTypeTag node={node} />
          {(node.resourceType === "model" ||
            node.resourceType === "snapshot" ||
            node.resourceType === "seed") &&
            (isSingleEnvOnboarding ? (
              <RowCountTag node={node} onRefresh={refetchRowCount} />
            ) : (
              <RowCountDiffTag node={node} onRefresh={refetchRowCountDiff} />
            ))}
        </HStack>
      </Box>
      {withColumns && (
        <Tabs.Root defaultValue="columns" overflow="auto">
          {isSingleEnvOnboarding && isNotificationOpen && (
            <Box p="12px">
              <RecceNotification onClose={onNotificationClose} align={"flex-start"}>
                <Text>
                  Enable the Recce Checklist and start adding checks for better data validation and
                  review.
                  <br />
                  <LearnHowLink />
                </Text>
              </RecceNotification>
            </Box>
          )}
          <Tabs.List>
            <Tabs.Trigger value="columns">Columns</Tabs.Trigger>
            <Tabs.Trigger value="code">Code</Tabs.Trigger>
          </Tabs.List>
          <Tabs.ContentGroup overflow="auto" height="calc(100% - 42px)">
            <Tabs.Content value="columns" p={0} overflowY="auto" height="100%">
              {isSingleEnvOnboarding ? (
                <SingleEnvSchemaView current={node.data.current} />
              ) : (
                <SchemaView base={node.data.base} current={node.data.current} />
              )}
            </Tabs.Content>
            <Tabs.Content value="code" height="100%" p={0}>
              <NodeSqlView node={node} />
            </Tabs.Content>
          </Tabs.ContentGroup>
        </Tabs.Root>
      )}
      <SandboxView isOpen={isSandboxOpen} onClose={onSandboxClose} current={node.data.current} />
    </Grid>
  );
}
