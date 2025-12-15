import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  type MouseEvent,
  type ReactElement,
  useCallback,
  useState,
} from "react";
import { IoClose } from "react-icons/io5";
import { PiCaretDown } from "react-icons/pi";
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

  return (
    <Box
      sx={{
        height: "100%",
        display: "grid",
        gridTemplateRows: "auto auto 1fr",
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
          {(node.data.resourceType === "model" ||
            node.data.resourceType === "snapshot" ||
            node.data.resourceType === "seed") &&
            (isSingleEnvOnboarding ? (
              <RowCountTag node={node} onRefresh={refetchRowCount} />
            ) : (
              <RowCountDiffTag node={node} onRefresh={refetchRowCountDiff} />
            ))}
        </Stack>
      </Box>

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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

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

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  if (
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "snapshot"
  ) {
    const QueryIcon = findByRunType("query").icon;
    const RowCountIcon = findByRunType("row_count").icon;
    const ProfileIcon = findByRunType("profile").icon;

    return (
      <>
        <Button
          size="small"
          variant="outlined"
          onClick={handleClick}
          endIcon={<PiCaretDown />}
          sx={{ textTransform: "none" }}
        >
          Explore
        </Button>
        <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
          <MenuItem
            onClick={() => {
              if (envInfo?.adapterType === "dbt") {
                setSqlQuery(query);
              } else if (envInfo?.adapterType === "sqlmesh") {
                setSqlQuery(`select * from ${node.data.name}`);
              }
              setLocation("/query");
              handleClose();
            }}
          >
            <ListItemIcon>
              <QueryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Query</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              refetchRowCount();
              handleClose();
            }}
          >
            <ListItemIcon>
              <RowCountIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Row Count</ListItemText>
          </MenuItem>
          <MuiTooltip
            title={disableReason(isAddedOrRemoved, "profile")}
            placement="left"
          >
            <span>
              <MenuItem
                disabled={isAddedOrRemoved}
                onClick={() => {
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
                  handleClose();
                }}
              >
                <ListItemIcon>
                  <ProfileIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Profile</ListItemText>
              </MenuItem>
            </span>
          </MuiTooltip>
        </Menu>
      </>
    );
  }
  return null;
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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const [, setLocation] = useAppLocation();
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
    setLocation(`/checks/?id=${check.check_id}`);
  }, [node, setLocation]);

  const formattedColumns = formatSelectColumns(baseColumns, currentColumns);
  let query = `select * from {{ ref("${node.data.name}") }}`;
  if (formattedColumns.length) {
    query = `select \n  ${formattedColumns.join("\n  ")}\nfrom {{ ref("${node.data.name}") }}`;
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const wrapMenuItem = (
    menuItem: ReactElement<{
      ref?: React.Ref<HTMLElement>;
      [key: string]: unknown;
    }>,
    runType: string,
  ) => {
    if (metadataOnly) {
      return (
        <SetupConnectionPopover display={true}>
          {menuItem}
        </SetupConnectionPopover>
      );
    }

    const tooltipContent = disableReason(isAddedOrRemoved, runType);
    return (
      <MuiTooltip title={tooltipContent} placement="left">
        <span>{menuItem}</span>
      </MuiTooltip>
    );
  };

  if (
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "snapshot"
  ) {
    // Get icons
    const QueryDiffIcon = findByRunType("query_diff").icon;
    const SandboxIcon = findByRunType("sandbox").icon;
    const RowCountDiffIcon = findByRunType("row_count_diff").icon;
    const ProfileDiffIcon = findByRunType("profile_diff").icon;
    const ValueDiffIcon = findByRunType("value_diff").icon;
    const TopKDiffIcon = findByRunType("top_k_diff").icon;
    const HistogramDiffIcon = findByRunType("histogram_diff").icon;
    const SchemaDiffIcon = findByRunType("schema_diff").icon;

    return (
      <>
        <Button
          size="xsmall"
          variant="outlined"
          color="neutral"
          onClick={handleClick}
          disabled={featureToggles.disableNodeActionDropdown}
          endIcon={<PiCaretDown />}
          sx={{ textTransform: "none", fontSize: "0.75rem" }}
        >
          Explore
        </Button>
        <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
          <SetupConnectionPopover display={metadataOnly}>
            <MenuItem
              disabled={featureToggles.disableDatabaseQuery}
              onClick={() => {
                if (envInfo?.adapterType === "dbt") {
                  setSqlQuery(query);
                } else if (envInfo?.adapterType === "sqlmesh") {
                  setSqlQuery(`select * from ${node.data.name}`);
                }
                if (isActionAvailable("query_diff_with_primary_key")) {
                  setPrimaryKeys(
                    primaryKey !== undefined ? [primaryKey] : undefined,
                  );
                }
                setLocation("/query");
                handleClose();
              }}
            >
              <ListItemIcon>
                <QueryDiffIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Query</ListItemText>
            </MenuItem>
          </SetupConnectionPopover>

          <SetupConnectionPopover display={metadataOnly}>
            <MenuItem
              disabled={featureToggles.disableDatabaseQuery}
              onClick={() => {
                if (isActionAvailable("query_diff_with_primary_key")) {
                  setPrimaryKeys(
                    primaryKey !== undefined ? [primaryKey] : undefined,
                  );
                }
                onSandboxOpen();
                trackPreviewChange({
                  action: "explore",
                  node: node.data.name,
                });
                handleClose();
              }}
            >
              <ListItemIcon>
                <SandboxIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Sandbox (Experiment)</ListItemText>
            </MenuItem>
          </SetupConnectionPopover>

          <Divider />

          <ListSubheader sx={{ lineHeight: "32px", bgcolor: "transparent" }}>
            Diff
          </ListSubheader>

          <SetupConnectionPopover display={metadataOnly}>
            <MenuItem
              disabled={featureToggles.disableDatabaseQuery}
              onClick={() => {
                refetchRowCountDiff();
                handleClose();
              }}
            >
              <ListItemIcon>
                <RowCountDiffIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Row Count Diff</ListItemText>
            </MenuItem>
          </SetupConnectionPopover>

          {wrapMenuItem(
            <MenuItem
              disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
              onClick={() => {
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
                handleClose();
              }}
            >
              <ListItemIcon>
                <ProfileDiffIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Profile Diff</ListItemText>
            </MenuItem>,
            "profile_diff",
          )}

          {wrapMenuItem(
            <MenuItem
              disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
              onClick={() => {
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
                handleClose();
              }}
            >
              <ListItemIcon>
                <ValueDiffIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Value Diff</ListItemText>
            </MenuItem>,
            "value_diff",
          )}

          {wrapMenuItem(
            <MenuItem
              disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
              onClick={() => {
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
                handleClose();
              }}
            >
              <ListItemIcon>
                <TopKDiffIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Top-K Diff</ListItemText>
            </MenuItem>,
            "top_k_diff",
          )}

          {wrapMenuItem(
            <MenuItem
              disabled={isAddedOrRemoved || featureToggles.disableDatabaseQuery}
              onClick={() => {
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
                handleClose();
              }}
            >
              <ListItemIcon>
                <HistogramDiffIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Histogram Diff</ListItemText>
            </MenuItem>,
            "histogram_diff",
          )}

          <Divider />

          <ListSubheader sx={{ lineHeight: "32px", bgcolor: "transparent" }}>
            Add to Checklist
          </ListSubheader>

          <MenuItem
            onClick={() => {
              void addSchemaCheck();
              handleClose();
            }}
          >
            <ListItemIcon>
              <SchemaDiffIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Schema Diff</ListItemText>
          </MenuItem>
        </Menu>
      </>
    );
  }
  return null;
}
