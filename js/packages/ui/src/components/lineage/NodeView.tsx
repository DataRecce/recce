"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  type ComponentType,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";
import { IoClose } from "react-icons/io5";

import type { NodeData } from "../../api/info";
import { DisableTooltipMessages } from "../../constants";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Node data structure for NodeView.
 * Represents the data needed to display node details.
 */
export interface NodeViewNodeData {
  id: string;
  data: {
    name: string;
    resourceType?: string;
    changeStatus?: string;
    schema?: string;
    materialized?: string;
    change?: {
      category: string;
      columns?: Record<string, "added" | "removed" | "modified">;
    };
  };
}

/**
 * Run type icon configuration for dependency injection.
 * Maps run type names to their icon components.
 */
export interface RunTypeIconMap {
  query?: ComponentType<{ fontSize?: string }>;
  row_count?: ComponentType<{ fontSize?: string }>;
  row_count_diff?: ComponentType<{ fontSize?: string }>;
  profile?: ComponentType<{ fontSize?: string }>;
  profile_diff?: ComponentType<{ fontSize?: string }>;
  query_diff?: ComponentType<{ fontSize?: string }>;
  value_diff?: ComponentType<{ fontSize?: string }>;
  top_k_diff?: ComponentType<{ fontSize?: string }>;
  histogram_diff?: ComponentType<{ fontSize?: string }>;
  schema_diff?: ComponentType<{ fontSize?: string }>;
  sandbox?: ComponentType<{ fontSize?: string }>;
}

/**
 * Props for the SchemaView component (diff mode).
 */
export interface SchemaViewProps {
  base?: NodeData;
  current?: NodeData;
  columnChanges?: Record<string, "added" | "removed" | "modified"> | null;
  onViewCode?: () => void;
}

/**
 * Props for the SingleEnvSchemaView component.
 */
export interface SingleEnvSchemaViewProps {
  current?: NodeData;
}

/**
 * Props for the NotificationComponent.
 */
export interface NotificationComponentProps {
  onClose: () => void;
  children?: ReactNode;
}

/**
 * Props for the ConnectionPopoverWrapper.
 */
export interface ConnectionPopoverWrapperProps {
  display: boolean;
  children: ReactNode;
}

/**
 * Props for the SandboxDialog component.
 */
export interface SandboxDialogProps {
  isOpen: boolean;
  onClose: () => void;
  current?: NodeData;
}

/**
 * Callbacks for action button clicks.
 * Used for dependency injection of action handlers.
 */
export interface NodeViewActionCallbacks {
  /** Called when Query button is clicked */
  onQueryClick?: () => void;
  /** Called when Row Count button is clicked */
  onRowCountClick?: () => void;
  /** Called when Row Count Diff button is clicked */
  onRowCountDiffClick?: () => void;
  /** Called when Profile button is clicked */
  onProfileClick?: () => void;
  /** Called when Profile Diff button is clicked */
  onProfileDiffClick?: () => void;
  /** Called when Query Diff button is clicked */
  onQueryDiffClick?: () => void;
  /** Called when Value Diff button is clicked */
  onValueDiffClick?: () => void;
  /** Called when Top-K Diff button is clicked */
  onTopKDiffClick?: () => void;
  /** Called when Histogram Diff button is clicked */
  onHistogramDiffClick?: () => void;
  /** Called when Add Schema Diff button is clicked */
  onAddSchemaDiffClick?: () => void;
  /** Called when Sandbox button is clicked */
  onSandboxClick?: () => void;
}

/**
 * Props for NodeView component.
 *
 * Uses dependency injection for:
 * - Schema view components (for different consumers)
 * - SQL view component (NodeSqlView)
 * - Action button icons
 * - Notification components
 * - Connection popover wrapper
 */
export interface NodeViewProps<
  TNode extends NodeViewNodeData = NodeViewNodeData,
> {
  /** The node to display */
  node: TNode;
  /** Callback when close button is clicked */
  onCloseNode: () => void;
  /** Whether in single environment mode */
  isSingleEnv: boolean;
  /** Feature toggles for conditional UI */
  featureToggles?: {
    mode?: string | null;
    disableDatabaseQuery?: boolean;
  };
  /** On-demand model detail (columns, raw_code) fetched by the wrapper */
  modelDetail?: {
    base?: NodeData;
    current?: NodeData;
  };
  // =========================================================================
  // DEPENDENCY INJECTION: Components
  // =========================================================================

  /** Schema view component for diff mode */
  SchemaView?: ComponentType<SchemaViewProps>;
  /** Schema view component for single env mode */
  SingleEnvSchemaView?: ComponentType<SingleEnvSchemaViewProps>;
  /** Node SQL view component */
  NodeSqlView?: ComponentType<{ node: TNode }>;
  /** Row count diff tag component */
  RowCountDiffTag?: ComponentType<{ node: TNode; onRefresh?: () => void }>;
  /** Row count tag component (single env) */
  RowCountTag?: ComponentType<{ node: TNode; onRefresh?: () => void }>;
  /** Resource type tag component */
  ResourceTypeTag?: ComponentType<{ node: TNode }>;
  /** Notification component for single env mode */
  NotificationComponent?: ComponentType<NotificationComponentProps>;
  /** Wrapper component for buttons that need connection popover */
  ConnectionPopoverWrapper?: ComponentType<ConnectionPopoverWrapperProps>;
  /** Sandbox dialog component */
  SandboxDialog?: ComponentType<SandboxDialogProps>;

  // =========================================================================
  // DEPENDENCY INJECTION: Icons
  // =========================================================================

  /** Map of run type names to icon components */
  runTypeIcons?: RunTypeIconMap;

  // =========================================================================
  // DEPENDENCY INJECTION: Callbacks
  // =========================================================================

  /** Action callbacks for button clicks */
  actionCallbacks?: NodeViewActionCallbacks;
  /** Check if an action is available */
  isActionAvailable?: (runType: string) => boolean;
}

// =============================================================================
// INTERNAL COMPONENTS
// =============================================================================

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <>{children}</> : null;
}

// =============================================================================
// DEFAULT IMPLEMENTATIONS
// =============================================================================

/** Default icon placeholder when no icon is provided */
const DefaultIcon = () => <span />;

/** Default connection wrapper that just renders children */
const DefaultConnectionWrapper: ComponentType<
  ConnectionPopoverWrapperProps
> = ({ children }) => <>{children}</>;

/** Default check for action availability - always available */
const defaultIsActionAvailable = () => true;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Gets the disable reason for an action button.
 */
function getDisableReason(
  isAddedOrRemoved: boolean,
  runType: string,
  isActionAvailable: (runType: string) => boolean,
): string {
  if (isAddedOrRemoved) {
    return DisableTooltipMessages.add_or_remove;
  }
  if (!isActionAvailable(runType)) {
    return "This action is not supported yet.";
  }
  return "";
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface SingleEnvActionButtonsProps {
  node: NodeViewNodeData;
  actionCallbacks?: NodeViewActionCallbacks;
  runTypeIcons?: RunTypeIconMap;
  isActionAvailable: (runType: string) => boolean;
}

function SingleEnvActionButtons({
  node,
  actionCallbacks,
  runTypeIcons,
  isActionAvailable,
}: SingleEnvActionButtonsProps) {
  const isAddedOrRemoved =
    node.data.changeStatus === "added" || node.data.changeStatus === "removed";

  const QueryIcon = runTypeIcons?.query ?? DefaultIcon;
  const RowCountIcon = runTypeIcons?.row_count ?? DefaultIcon;
  const ProfileIcon = runTypeIcons?.profile ?? DefaultIcon;

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1,
      }}
    >
      <Button
        size="xsmall"
        variant="outlined"
        color="neutral"
        startIcon={<QueryIcon fontSize="small" />}
        onClick={actionCallbacks?.onQueryClick}
        sx={{ textTransform: "none" }}
      >
        Query
      </Button>
      <Button
        size="xsmall"
        variant="outlined"
        color="neutral"
        startIcon={<RowCountIcon fontSize="small" />}
        onClick={actionCallbacks?.onRowCountClick}
        sx={{ textTransform: "none" }}
      >
        Row Count
      </Button>
      <MuiTooltip
        title={getDisableReason(isAddedOrRemoved, "profile", isActionAvailable)}
        placement="top"
      >
        <span>
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<ProfileIcon fontSize="small" />}
            onClick={actionCallbacks?.onProfileClick}
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
  node: NodeViewNodeData;
  actionCallbacks?: NodeViewActionCallbacks;
  runTypeIcons?: RunTypeIconMap;
  featureToggles?: NodeViewProps["featureToggles"];
  ConnectionPopoverWrapper: ComponentType<{
    display: boolean;
    children: ReactNode;
  }>;
}

function ExploreHeaderButtons({
  actionCallbacks,
  runTypeIcons,
  featureToggles,
  ConnectionPopoverWrapper,
}: ExploreHeaderButtonsProps) {
  const metadataOnly = featureToggles?.mode === "metadata only";

  const SchemaDiffIcon = runTypeIcons?.schema_diff ?? DefaultIcon;
  const SandboxIcon = runTypeIcons?.sandbox ?? DefaultIcon;

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1,
        mr: 1,
      }}
    >
      <Button
        size="xsmall"
        variant="outlined"
        color="neutral"
        startIcon={<SchemaDiffIcon fontSize="small" />}
        onClick={actionCallbacks?.onAddSchemaDiffClick}
        sx={{ textTransform: "none" }}
      >
        Add schema diff to checklist
      </Button>
      <ConnectionPopoverWrapper display={metadataOnly}>
        <Button
          size="xsmall"
          variant="outlined"
          color="neutral"
          startIcon={<SandboxIcon fontSize="small" />}
          onClick={actionCallbacks?.onSandboxClick}
          disabled={featureToggles?.disableDatabaseQuery}
          sx={{ textTransform: "none" }}
        >
          Sandbox
        </Button>
      </ConnectionPopoverWrapper>
    </Stack>
  );
}

interface DiffActionButtonsProps {
  node: NodeViewNodeData;
  actionCallbacks?: NodeViewActionCallbacks;
  runTypeIcons?: RunTypeIconMap;
  featureToggles?: NodeViewProps["featureToggles"];
  isActionAvailable: (runType: string) => boolean;
  ConnectionPopoverWrapper: ComponentType<{
    display: boolean;
    children: ReactNode;
  }>;
}

function DiffActionButtons({
  node,
  actionCallbacks,
  runTypeIcons,
  featureToggles,
  isActionAvailable,
  ConnectionPopoverWrapper,
}: DiffActionButtonsProps) {
  const metadataOnly = featureToggles?.mode === "metadata only";
  const isAddedOrRemoved =
    node.data.changeStatus === "added" || node.data.changeStatus === "removed";

  const QueryDiffIcon = runTypeIcons?.query_diff ?? DefaultIcon;
  const RowCountDiffIcon = runTypeIcons?.row_count_diff ?? DefaultIcon;
  const ProfileDiffIcon = runTypeIcons?.profile_diff ?? DefaultIcon;
  const ValueDiffIcon = runTypeIcons?.value_diff ?? DefaultIcon;
  const TopKDiffIcon = runTypeIcons?.top_k_diff ?? DefaultIcon;
  const HistogramDiffIcon = runTypeIcons?.histogram_diff ?? DefaultIcon;

  const wrapButton = (
    button: ReactElement<{
      ref?: React.Ref<HTMLElement>;
      [key: string]: unknown;
    }>,
    runType: string,
  ) => {
    if (metadataOnly) {
      return (
        <ConnectionPopoverWrapper display={true}>
          {button}
        </ConnectionPopoverWrapper>
      );
    }

    const tooltipContent = getDisableReason(
      isAddedOrRemoved,
      runType,
      isActionAvailable,
    );
    return (
      <MuiTooltip title={tooltipContent} placement="top">
        <span>{button}</span>
      </MuiTooltip>
    );
  };

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: "bold",
        }}
      >
        Diff
      </Typography>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          width: "93%",
        }}
      >
        <ConnectionPopoverWrapper display={metadataOnly}>
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<RowCountDiffIcon fontSize="small" />}
            onClick={actionCallbacks?.onRowCountDiffClick}
            disabled={featureToggles?.disableDatabaseQuery}
            sx={{ textTransform: "none" }}
          >
            Row Count
          </Button>
        </ConnectionPopoverWrapper>
        {wrapButton(
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<ProfileDiffIcon fontSize="small" />}
            onClick={actionCallbacks?.onProfileDiffClick}
            disabled={isAddedOrRemoved || featureToggles?.disableDatabaseQuery}
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
            onClick={actionCallbacks?.onValueDiffClick}
            disabled={isAddedOrRemoved || featureToggles?.disableDatabaseQuery}
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
            onClick={actionCallbacks?.onTopKDiffClick}
            disabled={isAddedOrRemoved || featureToggles?.disableDatabaseQuery}
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
            onClick={actionCallbacks?.onHistogramDiffClick}
            disabled={isAddedOrRemoved || featureToggles?.disableDatabaseQuery}
            sx={{ textTransform: "none" }}
          >
            Histogram
          </Button>,
          "histogram_diff",
        )}
        <ConnectionPopoverWrapper display={metadataOnly}>
          <Button
            size="xsmall"
            variant="outlined"
            color="neutral"
            startIcon={<QueryDiffIcon fontSize="small" />}
            onClick={actionCallbacks?.onQueryDiffClick}
            disabled={featureToggles?.disableDatabaseQuery}
            sx={{ textTransform: "none" }}
          >
            Query
          </Button>
        </ConnectionPopoverWrapper>
      </Stack>
    </Stack>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * NodeView Component
 *
 * Displays detailed information about a lineage node including:
 * - Node name and metadata
 * - Action buttons for various operations (Query, Profile, Diff, etc.)
 * - Tabs for Columns and Code views
 *
 * Uses dependency injection for:
 * - Schema view components (different for OSS vs Cloud)
 * - Action button handlers
 * - Icon components from run registry
 * - Connection popover for database setup prompts
 *
 * @example
 * ```tsx
 * import { NodeView } from '@datarecce/ui/advanced';
 *
 * <NodeView
 *   node={selectedNode}
 *   onCloseNode={() => setSelectedNode(null)}
 *   isSingleEnv={false}
 *   SchemaView={MySchemaView}
 *   NodeSqlView={MyNodeSqlView}
 *   actionCallbacks={{
 *     onQueryClick: handleQuery,
 *     onProfileDiffClick: handleProfileDiff,
 *   }}
 * />
 * ```
 */
export function NodeView<TNode extends NodeViewNodeData>({
  node,
  onCloseNode,
  isSingleEnv,
  featureToggles,
  modelDetail,
  // Injected components
  SchemaView,
  SingleEnvSchemaView,
  NodeSqlView,
  RowCountDiffTag,
  RowCountTag,
  ResourceTypeTag,
  NotificationComponent,
  ConnectionPopoverWrapper = DefaultConnectionWrapper,
  SandboxDialog,
  // Injected icons
  runTypeIcons,
  // Injected callbacks
  actionCallbacks,
  isActionAvailable = defaultIsActionAvailable,
}: NodeViewProps<TNode>) {
  const withColumns =
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "source" ||
    node.data.resourceType === "snapshot";

  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const { base, current } = modelDetail ?? {};
  const hasSchemaChanges =
    !isSingleEnv &&
    node.data.change?.columns != null &&
    Object.keys(node.data.change.columns).length > 0;
  // DRC-3263: uses server-computed changeStatus instead of comparing raw_code
  // strings. This is intentionally broader — state:modified includes config and
  // description changes, not just code. Verified equivalent on jaffle-shop-expand
  // (1060 nodes). If a project has config-only changes, the dot may appear even
  // though raw_code is identical — acceptable since the node IS modified.
  const hasCodeChanges = !isSingleEnv && node.data.changeStatus === "modified";

  const isModelSeedOrSnapshot =
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "snapshot";

  // Extended callbacks that include sandbox open
  const extendedCallbacks: NodeViewActionCallbacks = {
    ...actionCallbacks,
    onSandboxClick: () => {
      actionCallbacks?.onSandboxClick?.();
      setIsSandboxOpen(true);
    },
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header row: name + close button */}
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
        }}
      >
        <Box sx={{ flex: "0 1 20%", p: 2 }}>
          <Typography
            variant="subtitle1"
            className="no-track-pii-safe"
            sx={{
              fontWeight: 600,
            }}
          >
            {node.data.name}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        {!isSingleEnv && isModelSeedOrSnapshot && (
          <ExploreHeaderButtons
            node={node}
            actionCallbacks={extendedCallbacks}
            runTypeIcons={runTypeIcons}
            featureToggles={featureToggles}
            ConnectionPopoverWrapper={ConnectionPopoverWrapper}
          />
        )}
        <Box sx={{ flex: "0 1 1%" }}>
          <IconButton size="small" onClick={onCloseNode}>
            <IoClose />
          </IconButton>
        </Box>
      </Stack>
      {/* Tags row: resource type, row count */}
      <Box sx={{ color: "text.secondary", pl: 2 }}>
        <Stack direction="row" spacing={1}>
          {ResourceTypeTag && <ResourceTypeTag node={node} />}
          {isModelSeedOrSnapshot &&
            (isSingleEnv
              ? RowCountTag && (
                  <RowCountTag
                    node={node}
                    onRefresh={actionCallbacks?.onRowCountClick}
                  />
                )
              : RowCountDiffTag && (
                  <RowCountDiffTag
                    node={node}
                    onRefresh={actionCallbacks?.onRowCountDiffClick}
                  />
                ))}
        </Stack>
      </Box>
      {/* Action buttons row */}
      {isModelSeedOrSnapshot && (
        <Box sx={{ pl: 2, py: 1 }}>
          {isSingleEnv ? (
            <SingleEnvActionButtons
              node={node}
              actionCallbacks={actionCallbacks}
              runTypeIcons={runTypeIcons}
              isActionAvailable={isActionAvailable}
            />
          ) : (
            <DiffActionButtons
              node={node}
              actionCallbacks={extendedCallbacks}
              runTypeIcons={runTypeIcons}
              featureToggles={featureToggles}
              isActionAvailable={isActionAvailable}
              ConnectionPopoverWrapper={ConnectionPopoverWrapper}
            />
          )}
        </Box>
      )}
      {/* Content area: tabs for columns and code */}
      {withColumns && (
        <Box
          sx={{
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Notification for single env mode */}
          {isSingleEnv && isNotificationOpen && NotificationComponent && (
            <Box sx={{ p: 1.5 }}>
              <NotificationComponent
                onClose={() => setIsNotificationOpen(false)}
              >
                <Typography variant="body2">
                  Enable the Recce Checklist and start adding checks for better
                  data validation and review.
                </Typography>
              </NotificationComponent>
            </Box>
          )}

          {/* Tabs */}
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Tab
              label={
                <Box
                  component="span"
                  sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
                >
                  Columns
                  {hasSchemaChanges && (
                    <Box
                      component="span"
                      sx={{
                        color: "amber.main",
                        fontSize: "0.5rem",
                        lineHeight: 1,
                      }}
                    >
                      ●
                    </Box>
                  )}
                </Box>
              }
            />
            <Tab
              label={
                <Box
                  component="span"
                  sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
                >
                  Code
                  {hasCodeChanges && (
                    <Box
                      component="span"
                      sx={{
                        color: "amber.main",
                        fontSize: "0.5rem",
                        lineHeight: 1,
                      }}
                    >
                      ●
                    </Box>
                  )}
                </Box>
              }
            />
          </Tabs>

          {/* Tab panels */}
          <Box sx={{ overflow: "auto", height: "calc(100% - 48px)" }}>
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ overflowY: "auto", height: "100%" }}>
                {isSingleEnv
                  ? SingleEnvSchemaView && (
                      <SingleEnvSchemaView current={current} />
                    )
                  : SchemaView && (
                      <SchemaView
                        base={base}
                        current={current}
                        columnChanges={node.data.change?.columns}
                        onViewCode={() => setTabValue(1)}
                      />
                    )}
              </Box>
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ height: "100%" }}>
                {NodeSqlView && <NodeSqlView node={node} />}
              </Box>
            </TabPanel>
          </Box>
        </Box>
      )}
      {/* Sandbox dialog */}
      {SandboxDialog && (
        <SandboxDialog
          isOpen={isSandboxOpen}
          onClose={() => setIsSandboxOpen(false)}
          current={current}
        />
      )}
    </Box>
  );
}
