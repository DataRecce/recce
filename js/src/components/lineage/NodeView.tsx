import {
  Box,
  Button,
  CloseButton,
  Grid,
  Heading,
  HStack,
  Icon,
  Menu,
  Portal,
  Spacer,
  Tabs,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useCallback } from "react";
import { PiCaretDown } from "react-icons/pi";
import { useLocation } from "wouter";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import { Tooltip } from "@/components/ui/tooltip";
import { DisableTooltipMessages } from "@/constants/tooltipMessage";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import { trackPreviewChange } from "@/lib/api/track";
import { formatSelectColumns } from "@/lib/formatSelect";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import useModelColumns from "@/lib/hooks/useModelColumns";
import {
  LearnHowLink,
  RecceNotification,
} from "../onboarding-guide/Notification";
import { findByRunType } from "../run/registry";
import { SchemaView, SingleEnvSchemaView } from "../schema/SchemaView";
import { LineageGraphNode } from "./lineage";
import { NodeSqlView } from "./NodeSqlView";
import { ResourceTypeTag, RowCountDiffTag, RowCountTag } from "./NodeTag";
import { SandboxView } from "./SandboxView";

interface NodeViewProps {
  node: LineageGraphNode;
  onCloseNode: () => void;
}

export function NodeView({ node, onCloseNode }: NodeViewProps) {
  const withColumns =
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "source" ||
    node.data.resourceType === "snapshot";

  const {
    open: isSandboxOpen,
    onOpen: onSandboxOpen,
    onClose: onSandboxClose,
  } = useDisclosure();
  const { open: isNotificationOpen, onClose: onNotificationClose } =
    useDisclosure({
      defaultOpen: true,
    });
  const { runAction } = useRecceActionContext();
  const { isActionAvailable } = useLineageGraphContext();

  const refetchRowCount = () => {
    runAction(
      "row_count",
      { node_names: [node.data.name] },
      { showForm: false, showLast: false },
    );
  };
  const refetchRowCountDiff = () => {
    runAction(
      "row_count_diff",
      { node_names: [node.data.name] },
      { showForm: false, showLast: false },
    );
  };
  const { singleEnv: isSingleEnvOnboarding } = useRecceInstanceContext();

  const disableReason = (isAddedOrRemoved: boolean, runType: string) => {
    if (isAddedOrRemoved) {
      return DisableTooltipMessages.add_or_remove;
    }
    if (!isActionAvailable(runType)) {
      return "This action is not supported yet.";
    }
    return "";
  };

  const baseColumns = Object.keys(node.data.data.base?.columns ?? {});
  const currentColumns = Object.keys(node.data.data.current?.columns ?? {});

  return (
    <Grid height="100%" templateRows="auto auto 1fr">
      <HStack>
        <Box flex="0 1 20%" p="16px">
          <Heading size="sm" className="no-track-pii-safe">
            {node.data.name}
          </Heading>
        </Box>
        <Spacer />
        {isSingleEnvOnboarding ? (
          <SingleEnvironmentMenuButton
            node={node}
            baseColumns={baseColumns}
            currentColumns={currentColumns}
            refetchRowCount={refetchRowCount}
            disableReason={disableReason}
          />
        ) : (
          <ExploreChangeMenuButton
            node={node}
            baseColumns={baseColumns}
            currentColumns={currentColumns}
            disableReason={disableReason}
            refetchRowCountDiff={refetchRowCountDiff}
            onSandboxOpen={onSandboxOpen}
          />
        )}

        <Box flex="0 1 1%">
          <CloseButton size="2xs" onClick={onCloseNode} />
        </Box>
      </HStack>
      <Box color="gray" paddingLeft={"16px"}>
        <HStack gap={"8px"}>
          <ResourceTypeTag node={node} />
          {(node.data.resourceType === "model" ||
            node.data.resourceType === "snapshot" ||
            node.data.resourceType === "seed") &&
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
              <RecceNotification
                onClose={onNotificationClose}
                align={"flex-start"}
              >
                <Text>
                  Enable the Recce Checklist and start adding checks for better
                  data validation and review.
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
                <SingleEnvSchemaView current={node.data.data.current} />
              ) : (
                <SchemaView
                  base={node.data.data.base}
                  current={node.data.data.current}
                />
              )}
            </Tabs.Content>
            <Tabs.Content value="code" height="100%" p={0}>
              <NodeSqlView node={node} />
            </Tabs.Content>
          </Tabs.ContentGroup>
        </Tabs.Root>
      )}
      <SandboxView
        isOpen={isSandboxOpen}
        onClose={onSandboxClose}
        current={node.data.data.current}
      />
    </Grid>
  );
}

interface SingleEnvironmentMenuButtonProps {
  node: LineageGraphNode;
  baseColumns: string[];
  currentColumns: string[];
  refetchRowCount: () => void;
  disableReason: (isAddedOrRemoved: boolean, runType: string) => string;
}

function SingleEnvironmentMenuButton({
  node,
  baseColumns,
  currentColumns,
  refetchRowCount,
  disableReason,
}: SingleEnvironmentMenuButtonProps) {
  const [, setLocation] = useLocation();
  const { setSqlQuery } = useRecceQueryContext();
  const { runAction } = useRecceActionContext();
  const { envInfo } = useLineageGraphContext();
  const isAddedOrRemoved =
    node.data.changeStatus === "added" || node.data.changeStatus === "removed";

  const formattedColumns = formatSelectColumns(baseColumns, currentColumns);
  let query = `select * from {{ ref("${node.data.name}") }}`;
  if (formattedColumns.length) {
    query = `select \n  ${formattedColumns.join("\n  ")}\nfrom {{ ref("${node.data.name}") }}`;
  }
  if (
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "snapshot"
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
                    setSqlQuery(`select * from ${node.data.name}`);
                  }
                  setLocation("/query");
                }}
              >
                <Icon as={findByRunType("query").icon} /> Query
              </Menu.Item>
              <Menu.Item
                value="row-count"
                fontSize="14px"
                onClick={() => {
                  refetchRowCount();
                }}
              >
                <Icon as={findByRunType("row_count").icon} /> Row Count
              </Menu.Item>
              <Tooltip
                content={disableReason(isAddedOrRemoved, "profile")}
                positioning={{ placement: "left" }}
              >
                <Menu.Item
                  value="profile"
                  fontSize="14px"
                  disabled={isAddedOrRemoved}
                  onClick={() => {
                    runAction(
                      "profile",
                      {
                        model: node.data.name,
                      },
                      { showForm: true, showLast: false },
                    );
                  }}
                >
                  <Icon as={findByRunType("profile").icon} /> Profile
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

interface ExploreChangeMenuButtonProps {
  node: LineageGraphNode;
  baseColumns: string[];
  currentColumns: string[];
  disableReason: (isAddedOrRemoved: boolean, runType: string) => string;
  onSandboxOpen: () => void;
  refetchRowCountDiff: () => void;
}

function ExploreChangeMenuButton({
  node,
  baseColumns,
  currentColumns,
  disableReason,
  onSandboxOpen,
  refetchRowCountDiff,
}: ExploreChangeMenuButtonProps) {
  const [, setLocation] = useLocation();
  const { runAction } = useRecceActionContext();
  const { setSqlQuery, setPrimaryKeys } = useRecceQueryContext();
  const { envInfo, isActionAvailable } = useLineageGraphContext();
  const { featureToggles } = useRecceInstanceContext();
  const { primaryKey } = useModelColumns(node.data.name);

  const metadataOnly = featureToggles.mode === "metadata only";
  const isAddedOrRemoved =
    node.data.changeStatus === "added" || node.data.changeStatus === "removed";

  const addSchemaCheck = useCallback(async () => {
    const nodeId = node.id;
    const check = await createSchemaDiffCheck({ node_id: nodeId });
    setLocation(`/checks/${check.check_id}`);
  }, [node, setLocation]);

  const formattedColumns = formatSelectColumns(baseColumns, currentColumns);
  let query = `select * from {{ ref("${node.data.name}") }}`;
  if (formattedColumns.length) {
    query = `select \n  ${formattedColumns.join("\n  ")}\nfrom {{ ref("${node.data.name}") }}`;
  }

  const wrapMenuItem = (
    children: React.ReactElement<{
      ref?: React.Ref<HTMLElement>;
      [key: string]: unknown;
    }>,
    runType: string,
  ) => {
    if (metadataOnly) {
      return (
        <SetupConnectionPopover display={true}>
          {children}
        </SetupConnectionPopover>
      );
    }

    const tooltipContent = disableReason(isAddedOrRemoved, runType);
    return (
      <Tooltip
        disabled={tooltipContent === ""}
        content={tooltipContent}
        positioning={{ placement: "left" }}
      >
        {children}
      </Tooltip>
    );
  };

  if (
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "snapshot"
  ) {
    return (
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button
            size="2xs"
            variant="outline"
            disabled={featureToggles.disableNodeActionDropdown}
          >
            Explore <PiCaretDown />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              <SetupConnectionPopover display={metadataOnly}>
                <Menu.Item
                  value="query"
                  fontSize="14px"
                  disabled={featureToggles.disableDatabaseQuery}
                  onClick={() => {
                    if (envInfo?.adapterType === "dbt") {
                      setSqlQuery(query);
                    } else if (envInfo?.adapterType === "sqlmesh") {
                      setSqlQuery(`select * from ${node.data.name}`);
                    }
                    if (isActionAvailable("query_diff_with_primary_key")) {
                      // Only set primary key if the action is available
                      setPrimaryKeys(
                        primaryKey !== undefined ? [primaryKey] : undefined,
                      );
                    }
                    setLocation("/query");
                  }}
                >
                  <Icon as={findByRunType("query_diff").icon} /> Query
                </Menu.Item>
              </SetupConnectionPopover>
              <SetupConnectionPopover display={metadataOnly}>
                <Menu.Item
                  value="sandbox"
                  fontSize="14px"
                  disabled={featureToggles.disableDatabaseQuery}
                  onClick={() => {
                    if (isActionAvailable("query_diff_with_primary_key")) {
                      // Only set primary key if the action is available
                      setPrimaryKeys(
                        primaryKey !== undefined ? [primaryKey] : undefined,
                      );
                    }
                    onSandboxOpen();
                    trackPreviewChange({
                      action: "explore",
                      node: node.data.name,
                    });
                  }}
                >
                  <Icon as={findByRunType("sandbox").icon} /> Sandbox
                  (Experiment)
                </Menu.Item>
              </SetupConnectionPopover>
              <Menu.Separator />
              <Menu.ItemGroup m="0" p="0">
                <Menu.ItemGroupLabel>Diff</Menu.ItemGroupLabel>
                <SetupConnectionPopover display={metadataOnly}>
                  <Menu.Item
                    value="row-count-diff"
                    fontSize="14px"
                    disabled={featureToggles.disableDatabaseQuery}
                    onClick={() => {
                      refetchRowCountDiff();
                    }}
                  >
                    <Icon as={findByRunType("row_count_diff").icon} /> Row Count
                    Diff
                  </Menu.Item>
                </SetupConnectionPopover>
                {wrapMenuItem(
                  <Menu.Item
                    value="profile-diff"
                    fontSize="14px"
                    disabled={
                      isAddedOrRemoved || featureToggles.disableDatabaseQuery
                    }
                    onClick={() => {
                      runAction(
                        "profile_diff",
                        {
                          model: node.data.name,
                        },
                        { showForm: true, showLast: false },
                      );
                    }}
                  >
                    <Icon as={findByRunType("profile_diff").icon} /> Profile
                    Diff
                  </Menu.Item>,
                  "profile_diff",
                )}
                {wrapMenuItem(
                  <Menu.Item
                    value="value-diff"
                    fontSize="14px"
                    disabled={
                      isAddedOrRemoved || featureToggles.disableDatabaseQuery
                    }
                    onClick={() => {
                      runAction(
                        "value_diff",
                        {
                          model: node.data.name,
                        },
                        { showForm: true, showLast: false },
                      );
                    }}
                  >
                    <Icon as={findByRunType("value_diff").icon} /> Value Diff
                  </Menu.Item>,
                  "value_diff",
                )}
                {wrapMenuItem(
                  <Menu.Item
                    value="top-k-diff"
                    fontSize="14px"
                    disabled={
                      isAddedOrRemoved || featureToggles.disableDatabaseQuery
                    }
                    onClick={() => {
                      runAction(
                        "top_k_diff",
                        { model: node.data.name, column_name: "", k: 50 },
                        { showForm: true },
                      );
                    }}
                  >
                    <Icon as={findByRunType("top_k_diff").icon} /> Top-K Diff
                  </Menu.Item>,
                  "top_k_diff",
                )}
                {wrapMenuItem(
                  <Menu.Item
                    value="histogram-diff"
                    fontSize="14px"
                    disabled={
                      isAddedOrRemoved || featureToggles.disableDatabaseQuery
                    }
                    onClick={() => {
                      runAction(
                        "histogram_diff",
                        {
                          model: node.data.name,
                          column_name: "",
                          column_type: "",
                        },
                        { showForm: true },
                      );
                    }}
                  >
                    <Icon as={findByRunType("histogram_diff").icon} /> Histogram
                    Diff
                  </Menu.Item>,
                  "histogram_diff",
                )}
              </Menu.ItemGroup>
              <Menu.Separator />
              <Menu.ItemGroup m="0" p="4px 12px">
                <Menu.ItemGroupLabel>Add to Checklist</Menu.ItemGroupLabel>
                <Menu.Item
                  value="schema-diff"
                  fontSize="14px"
                  onClick={() => {
                    void addSchemaCheck();
                  }}
                >
                  <Icon as={findByRunType("schema_diff").icon} /> Schema Diff
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
