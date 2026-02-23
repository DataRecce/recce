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

import { DisableTooltipMessages } from "../../constants";
import type { NodeSqlViewProps } from "./NodeSqlView";

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
    from?: string;
    data: {
      base?: {
        raw_code?: string;
        name?: string;
        columns?: Record<string, unknown>;
      };
      current?: {
        raw_code?: string;
        name?: string;
        columns?: Record<string, unknown>;
      };
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
 *
 * Note: Injected component types use `any` to allow consumers to provide
 * components with more specific prop types than the base interface requires.
 * The consumer is responsible for ensuring type compatibility.
 */
export interface NodeViewProps {
  /** The node to display */
  node: NodeViewNodeData;
  /** Callback when close button is clicked */
  onCloseNode: () => void;
  /** Whether in single environment mode */
  isSingleEnv: boolean;
  /** Feature toggles for conditional UI */
  featureToggles?: {
    mode?: string | null;
    disableDatabaseQuery?: boolean;
  };

  // =========================================================================
  // DEPENDENCY INJECTION: Components
  // =========================================================================
  // Using ComponentType<any> for flexibility - consumers provide their own types

  /**
   * Schema view component for diff mode.
   * Should accept: { base?: NodeData, current?: NodeData }
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  SchemaView?: ComponentType<any>;
  /**
   * Schema view component for single env mode.
   * Should accept: { current?: NodeData }
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  SingleEnvSchemaView?: ComponentType<any>;
  /**
   * Node SQL view component.
   * Should accept: { node: LineageGraphNode }
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  NodeSqlView?: ComponentType<any>;
  /**
   * Row count diff tag component.
   * Should accept: { node: LineageGraphNode, onRefresh?: () => void }
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  RowCountDiffTag?: ComponentType<any>;
  /**
   * Row count tag component (single env).
   * Should accept: { node: LineageGraphNode, onRefresh?: () => void }
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  RowCountTag?: ComponentType<any>;
  /**
   * Resource type tag component.
   * Should accept: { node: LineageGraphNode }
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  ResourceTypeTag?: ComponentType<any>;
  /**
   * Notification component for single env mode.
   * Should accept: { onClose: () => void, children: ReactNode }
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  NotificationComponent?: ComponentType<any>;
  /**
   * Wrapper component for buttons that need connection popover.
   * Should accept: { display: boolean, children: ReactNode }
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  ConnectionPopoverWrapper?: ComponentType<any>;
  /**
   * Sandbox dialog component.
   * Should accept: { isOpen: boolean, onClose: () => void, current?: NodeData }
   */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  SandboxDialog?: ComponentType<any>;
  /** Sample filter component for WHERE clause filtering */
  // biome-ignore lint/suspicious/noExplicitAny: DI pattern requires flexible component types
  SampleFilterComponent?: ComponentType<any>;

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
const DefaultConnectionWrapper = ({
  children,
}: {
  display: boolean;
  children: ReactNode;
}) => <>{children}</>;

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
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
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
 * import { NodeView } from '@datarecce/ui/components/lineage';
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
export function NodeView({
  node,
  onCloseNode,
  isSingleEnv,
  featureToggles,
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
  SampleFilterComponent,
  // Injected icons
  runTypeIcons,
  // Injected callbacks
  actionCallbacks,
  isActionAvailable = defaultIsActionAvailable,
}: NodeViewProps) {
  const withColumns =
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "source" ||
    node.data.resourceType === "snapshot";

  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(true);
  const [tabValue, setTabValue] = useState(0);

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
        display: "grid",
        gridTemplateRows: "auto auto auto 1fr",
      }}
    >
      {/* Header row: name + close button */}
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

      {/* Sample filter */}
      {isModelSeedOrSnapshot && SampleFilterComponent && (
        <SampleFilterComponent />
      )}

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
          sx={{ overflow: "auto", display: "flex", flexDirection: "column" }}
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
            <Tab label="Columns" />
            <Tab label="Code" />
          </Tabs>

          {/* Tab panels */}
          <Box sx={{ overflow: "auto", height: "calc(100% - 48px)" }}>
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ overflowY: "auto", height: "100%" }}>
                {isSingleEnv
                  ? SingleEnvSchemaView && (
                      <SingleEnvSchemaView current={node.data.data.current} />
                    )
                  : SchemaView && (
                      <SchemaView
                        base={node.data.data.base}
                        current={node.data.data.current}
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
          current={node.data.data.current}
        />
      )}
    </Box>
  );
}
