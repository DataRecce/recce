import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { type ReactElement, useCallback, useState } from "react";
import { IoClose } from "react-icons/io5";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import { DisableTooltipMessages } from "@/constants/tooltipMessage";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import {
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  trackExploreAction,
  trackPreviewChange,
} from "@/lib/api/track";
import { formatSelectColumns } from "@/lib/formatSelect";
import { useApiConfig } from "@/lib/hooks/ApiConfigContext";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { useAppLocation } from "@/lib/hooks/useAppRouter";
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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <>{children}</> : null;
}

export function NodeView({ node, onCloseNode }: NodeViewProps) {
  const withColumns =
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "source" ||
    node.data.resourceType === "snapshot";

  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const { runAction } = useRecceActionContext();
  const { isActionAvailable } = useLineageGraphContext();

  const refetchRowCount = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.ROW_COUNT,
      source: EXPLORE_SOURCE.SCHEMA_ROW_COUNT_BUTTON,
      node_count: 1,
    });
    runAction(
      "row_count",
      { node_names: [node.data.name] },
      { showForm: false, showLast: false },
    );
  };

  const refetchRowCountDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.ROW_COUNT_DIFF,
      source: EXPLORE_SOURCE.SCHEMA_ROW_COUNT_BUTTON,
      node_count: 1,
    });
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

  const isModelSeedOrSnapshot =
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "snapshot";

  return (
    <Box
      sx={{
        height: "100%",
        display: "grid",
        gridTemplateRows: "auto auto auto 1fr",
      }}
    >
      <Stack direction="row" alignItems="center">
        <Box sx={{ flex: "0 1 20%", p: 2 }}>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            className="no-track-pii-safe"
          >
            {node.data.name}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        {!isSingleEnvOnboarding && isModelSeedOrSnapshot && (
          <ExploreHeaderButtons
            node={node}
            onSandboxOpen={() => setIsSandboxOpen(true)}
          />
        )}
        <Box sx={{ flex: "0 1 1%" }}>
          <IconButton size="small" onClick={onCloseNode}>
            <IoClose />
          </IconButton>
        </Box>
      </Stack>

      <Box sx={{ color: "text.secondary", pl: 2 }}>
        <Stack direction="row" spacing={1}>
          <ResourceTypeTag node={node} />
          {isModelSeedOrSnapshot &&
            (isSingleEnvOnboarding ? (
              <RowCountTag node={node} onRefresh={refetchRowCount} />
            ) : (
              <RowCountDiffTag node={node} onRefresh={refetchRowCountDiff} />
            ))}
        </Stack>
      </Box>

      {isModelSeedOrSnapshot && (
        <Box sx={{ pl: 2, py: 1 }}>
          {isSingleEnvOnboarding ? (
            <SingleEnvActionButtons
              node={node}
              baseColumns={baseColumns}
              currentColumns={currentColumns}
              refetchRowCount={refetchRowCount}
              disableReason={disableReason}
            />
          ) : (
            <DiffActionButtons
              node={node}
              baseColumns={baseColumns}
              currentColumns={currentColumns}
              disableReason={disableReason}
              refetchRowCountDiff={refetchRowCountDiff}
            />
          )}
        </Box>
      )}

      {withColumns && (
        <Box
          sx={{ overflow: "auto", display: "flex", flexDirection: "column" }}
        >
          {isSingleEnvOnboarding && isNotificationOpen && (
            <Box sx={{ p: 1.5 }}>
              <RecceNotification
                onClose={() => setIsNotificationOpen(false)}
                align="flex-start"
              >
                <Typography variant="body2">
                  Enable the Recce Checklist and start adding checks for better
                  data validation and review.
                  <br />
                  <LearnHowLink />
                </Typography>
              </RecceNotification>
            </Box>
          )}
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="Columns" />
            <Tab label="Code" />
          </Tabs>
          <Box sx={{ overflow: "auto", height: "calc(100% - 48px)" }}>
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ overflowY: "auto", height: "100%" }}>
                {isSingleEnvOnboarding ? (
                  <SingleEnvSchemaView current={node.data.data.current} />
                ) : (
                  <SchemaView
                    base={node.data.data.base}
                    current={node.data.data.current}
                  />
                )}
              </Box>
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ height: "100%" }}>
                <NodeSqlView node={node} />
              </Box>
            </TabPanel>
          </Box>
        </Box>
      )}

      <SandboxView
        isOpen={isSandboxOpen}
        onClose={() => setIsSandboxOpen(false)}
        current={node.data.data.current}
      />
    </Box>
  );
}

interface SingleEnvActionButtonsProps {
  node: LineageGraphNode;
  baseColumns: string[];
  currentColumns: string[];
  refetchRowCount: () => void;
  disableReason: (isAddedOrRemoved: boolean, runType: string) => string;
}

function SingleEnvActionButtons({
  node,
  baseColumns,
  currentColumns,
  refetchRowCount,
  disableReason,
}: SingleEnvActionButtonsProps) {
  const [, setLocation] = useAppLocation();
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

  const QueryIcon = findByRunType("query").icon;
  const RowCountIcon = findByRunType("row_count").icon;
  const ProfileIcon = findByRunType("profile").icon;

  const handleQueryClick = () => {
    if (envInfo?.adapterType === "dbt") {
      setSqlQuery(query);
    } else if (envInfo?.adapterType === "sqlmesh") {
      setSqlQuery(`select * from ${node.data.name}`);
    }
    setLocation("/query");
  };

  const handleRowCountClick = () => {
    refetchRowCount();
  };

  const handleProfileClick = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.PROFILE,
      source: EXPLORE_SOURCE.NODE_SIDEBAR_SINGLE_ENV,
      node_count: 1,
    });
    runAction(
      "profile",
      { model: node.data.name },
      { showForm: true, showLast: false },
    );
  };

  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
      <Button
        size="xsmall"
        variant="outlined"
        color="neutral"
        startIcon={<QueryIcon fontSize="small" />}
        onClick={handleQueryClick}
        sx={{ textTransform: "none" }}
      >
        Query
      </Button>
      <Button
        size="xsmall"
        variant="outlined"
        color="neutral"
        startIcon={<RowCountIcon fontSize="small" />}
        onClick={handleRowCountClick}
        sx={{ textTransform: "none" }}
      >
        Row Count
      </Button>
      <MuiTooltip
        title={disableReason(isAddedOrRemoved, "profile")}
        placement="top"
      >
        <span>
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<ProfileIcon fontSize="small" />}
            onClick={handleProfileClick}
            disabled={isAddedOrRemoved}
            sx={{ textTransform: "none" }}
          >
            Profile
          </Button>
        </span>
      </MuiTooltip>
    </Stack>
  );
}

interface ExploreHeaderButtonsProps {
  node: LineageGraphNode;
  onSandboxOpen: () => void;
}

function ExploreHeaderButtons({
  node,
  onSandboxOpen,
}: ExploreHeaderButtonsProps) {
  const [, setLocation] = useAppLocation();
  const { featureToggles } = useRecceInstanceContext();
  const { isActionAvailable } = useLineageGraphContext();
  const { setPrimaryKeys } = useRecceQueryContext();
  const { primaryKey } = useModelColumns(node.data.name);
  const { apiClient } = useApiConfig();

  const metadataOnly = featureToggles.mode === "metadata only";

  const addSchemaCheck = useCallback(async () => {
    const nodeId = node.id;
    const check = await createSchemaDiffCheck({ node_id: nodeId }, apiClient);
    setLocation(`/checks/?id=${check.check_id}`);
  }, [node, setLocation, apiClient]);

  const SchemaDiffIcon = findByRunType("schema_diff").icon;
  const SandboxIcon = findByRunType("sandbox").icon;

  const handleAddSchemaCheck = () => {
    void addSchemaCheck();
  };

  const handleSandboxOpen = () => {
    if (isActionAvailable("query_diff_with_primary_key")) {
      setPrimaryKeys(primaryKey !== undefined ? [primaryKey] : undefined);
    }
    onSandboxOpen();
    trackPreviewChange({
      action: "explore",
      node: node.data.name,
    });
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{ mr: 1 }}
      flexWrap="wrap"
      gap={1}
    >
      <Button
        size="xsmall"
        variant="outlined"
        color="neutral"
        startIcon={<SchemaDiffIcon fontSize="small" />}
        onClick={handleAddSchemaCheck}
        sx={{ textTransform: "none" }}
      >
        Add schema diff to checklist
      </Button>
      <SetupConnectionPopover display={metadataOnly}>
        <Button
          size="xsmall"
          variant="outlined"
          color="neutral"
          startIcon={<SandboxIcon fontSize="small" />}
          onClick={handleSandboxOpen}
          disabled={featureToggles.disableDatabaseQuery}
          sx={{ textTransform: "none" }}
        >
          Sandbox
        </Button>
      </SetupConnectionPopover>
    </Stack>
  );
}

interface DiffActionButtonsProps {
  node: LineageGraphNode;
  baseColumns: string[];
  currentColumns: string[];
  disableReason: (isAddedOrRemoved: boolean, runType: string) => string;
  refetchRowCountDiff: () => void;
}

function DiffActionButtons({
  node,
  baseColumns,
  currentColumns,
  disableReason,
  refetchRowCountDiff,
}: DiffActionButtonsProps) {
  const [, setLocation] = useAppLocation();
  const { runAction } = useRecceActionContext();
  const { setSqlQuery, setPrimaryKeys } = useRecceQueryContext();
  const { envInfo, isActionAvailable } = useLineageGraphContext();
  const { featureToggles } = useRecceInstanceContext();
  const { primaryKey } = useModelColumns(node.data.name);

  const metadataOnly = featureToggles.mode === "metadata only";
  const isAddedOrRemoved =
    node.data.changeStatus === "added" || node.data.changeStatus === "removed";

  const formattedColumns = formatSelectColumns(baseColumns, currentColumns);
  let query = `select * from {{ ref("${node.data.name}") }}`;
  if (formattedColumns.length) {
    query = `select \n  ${formattedColumns.join("\n  ")}\nfrom {{ ref("${node.data.name}") }}`;
  }

  const QueryDiffIcon = findByRunType("query_diff").icon;
  const RowCountDiffIcon = findByRunType("row_count_diff").icon;
  const ProfileDiffIcon = findByRunType("profile_diff").icon;
  const ValueDiffIcon = findByRunType("value_diff").icon;
  const TopKDiffIcon = findByRunType("top_k_diff").icon;
  const HistogramDiffIcon = findByRunType("histogram_diff").icon;

  const wrapButton = (
    button: ReactElement<{
      ref?: React.Ref<HTMLElement>;
      [key: string]: unknown;
    }>,
    runType: string,
  ) => {
    if (metadataOnly) {
      return (
        <SetupConnectionPopover display={true}>{button}</SetupConnectionPopover>
      );
    }

    const tooltipContent = disableReason(isAddedOrRemoved, runType);
    return (
      <MuiTooltip title={tooltipContent} placement="top">
        <span>{button}</span>
      </MuiTooltip>
    );
  };

  const handleRowCountClick = () => {
    refetchRowCountDiff();
  };

  const handleProfileClick = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.PROFILE_DIFF,
      source: EXPLORE_SOURCE.NODE_SIDEBAR_MULTI_ENV,
      node_count: 1,
    });
    runAction(
      "profile_diff",
      { model: node.data.name },
      { showForm: true, showLast: false },
    );
  };

  const handleValueClick = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.VALUE_DIFF,
      source: EXPLORE_SOURCE.NODE_SIDEBAR_MULTI_ENV,
      node_count: 1,
    });
    runAction(
      "value_diff",
      { model: node.data.name },
      { showForm: true, showLast: false },
    );
  };

  const handleTopKClick = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.TOP_K_DIFF,
      source: EXPLORE_SOURCE.NODE_SIDEBAR_MULTI_ENV,
      node_count: 1,
    });
    runAction(
      "top_k_diff",
      { model: node.data.name, column_name: "", k: 50 },
      { showForm: true },
    );
  };

  const handleHistogramClick = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.HISTOGRAM_DIFF,
      source: EXPLORE_SOURCE.NODE_SIDEBAR_MULTI_ENV,
      node_count: 1,
    });
    runAction(
      "histogram_diff",
      { model: node.data.name, column_name: "", column_type: "" },
      { showForm: true },
    );
  };

  const handleQueryClick = () => {
    if (envInfo?.adapterType === "dbt") {
      setSqlQuery(query);
    } else if (envInfo?.adapterType === "sqlmesh") {
      setSqlQuery(`select * from ${node.data.name}`);
    }
    if (isActionAvailable("query_diff_with_primary_key")) {
      setPrimaryKeys(primaryKey !== undefined ? [primaryKey] : undefined);
    }
    setLocation("/query");
  };

  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={2}>
      <Typography variant="caption" fontWeight="bold">
        Diff
      </Typography>
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
        width="93%"
      >
        <SetupConnectionPopover display={metadataOnly}>
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<RowCountDiffIcon fontSize="small" />}
            onClick={handleRowCountClick}
            disabled={featureToggles.disableDatabaseQuery}
            sx={{ textTransform: "none" }}
          >
            Row Count
          </Button>
        </SetupConnectionPopover>
        {wrapButton(
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<ProfileDiffIcon fontSize="small" />}
            onClick={handleProfileClick}
            disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
            sx={{ textTransform: "none" }}
          >
            Profile
          </Button>,
          "profile_diff",
        )}
        {wrapButton(
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<ValueDiffIcon fontSize="small" />}
            onClick={handleValueClick}
            disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
            sx={{ textTransform: "none" }}
          >
            Value
          </Button>,
          "value_diff",
        )}
        {wrapButton(
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<TopKDiffIcon fontSize="small" />}
            onClick={handleTopKClick}
            disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
            sx={{ textTransform: "none" }}
          >
            Top-K
          </Button>,
          "top_k_diff",
        )}
        {wrapButton(
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<HistogramDiffIcon fontSize="small" />}
            onClick={handleHistogramClick}
            disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
            sx={{ textTransform: "none" }}
          >
            Histogram
          </Button>,
          "histogram_diff",
        )}
        <SetupConnectionPopover display={metadataOnly}>
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<QueryDiffIcon fontSize="small" />}
            onClick={handleQueryClick}
            disabled={featureToggles.disableDatabaseQuery}
            sx={{ textTransform: "none" }}
          >
            Query
          </Button>
        </SetupConnectionPopover>
      </Stack>
    </Stack>
  );
}
