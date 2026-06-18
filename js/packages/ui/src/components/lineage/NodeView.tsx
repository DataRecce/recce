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
import { useThemeColors } from "../../hooks";
import type { ChangeCategory } from "./nodes";
import { TreatmentChip } from "./TreatmentChip";
import { getTitleRowTooltip, pickTitleChip } from "./wholeModelTreatment";

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
      columns?: Record<string, "added" | "removed" | "modified" | "unknown">;
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
}

/**
 * Props for the SchemaView component (diff mode).
 */
export interface SchemaViewProps {
  base?: NodeData;
  current?: NodeData;
  columnChanges?: Record<
    string,
    "added" | "removed" | "modified" | "unknown"
  > | null;
  onViewCode?: () => void;
  /**
   * Optional action element rendered alongside the schema legend (e.g.
   * "Add schema diff to checklist" button). Diff mode only.
   */
  headerAction?: ReactNode;
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
  /**
   * Optional slot rendered as a "Lineage" tab body. When provided, a tab
   * labeled "Lineage" appears as the LAST tab (after Columns/Code).
   * Columns remains the default landing tab.
   * Consumers inject this to expose the focused node's upstream/downstream
   * without coupling NodeView to the lineage graph context.
   */
  lineageTabContent?: ReactNode;

  // =========================================================================
  // DEPENDENCY INJECTION: Components
  // =========================================================================

  /** Schema view component for diff mode */
  SchemaView?: ComponentType<SchemaViewProps>;
  /** Schema view component for single env mode */
  SingleEnvSchemaView?: ComponentType<SingleEnvSchemaViewProps>;
  /** Node SQL view component */
  NodeSqlView?: ComponentType<{ node: TNode }>;
  /** Resource type tag component (rendered in the header row) */
  ResourceTypeTag?: ComponentType<{ node: TNode }>;
  /** Notification component for single env mode */
  NotificationComponent?: ComponentType<NotificationComponentProps>;
  /** Wrapper component for buttons that need connection popover */
  ConnectionPopoverWrapper?: ComponentType<ConnectionPopoverWrapperProps>;
  /**
   * Optional inline display rendered after "Row Count" on the row count
   * action button (e.g. "N/A → 280,844 rows" with delta arrow). Omit when
   * no row-count data is available yet.
   */
  rowCountDisplay?: ReactNode;

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

  /** This model itself has a whole-model change — paints the brown title chip + brown left stripe. */
  isWholeModelChanged?: boolean;
  /** This model is downstream of a whole-model change — paints the amber title chip + amber left stripe. Precedence is enforced internally: `isWholeModelChanged` outranks this flag. */
  isWholeModelImpacted?: boolean;
  /** Whether the new CLL experience (`new_cll_experience` server flag) is on. When false, no whole-model UI renders (no title chip, no left stripe). */
  newCllExperience?: boolean;
  /** This model is downstream of any breaking change. Only feeds the title-row hover tooltip (column-impacted kind) — no visual chip in NodeView. */
  isImpacted?: boolean;
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
  rowCountDisplay?: ReactNode;
}

function SingleEnvActionButtons({
  node,
  actionCallbacks,
  runTypeIcons,
  isActionAvailable,
  rowCountDisplay,
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
        {rowCountDisplay != null && <>:&nbsp;{rowCountDisplay}</>}
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

/**
 * "Add schema diff to checklist" button — rendered inside the Columns tab
 * next to the schema legend (not in the header row).
 */
interface AddSchemaDiffButtonProps {
  onClick?: () => void;
  Icon: ComponentType<{ fontSize?: string }>;
}

function AddSchemaDiffButton({ onClick, Icon }: AddSchemaDiffButtonProps) {
  return (
    <Button
      size="xsmall"
      variant="outlined"
      color="neutral"
      startIcon={<Icon fontSize="small" />}
      onClick={onClick}
      sx={{ textTransform: "none" }}
    >
      Add schema diff to checklist
    </Button>
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
  rowCountDisplay?: ReactNode;
}

function DiffActionButtons({
  node,
  actionCallbacks,
  runTypeIcons,
  featureToggles,
  isActionAvailable,
  ConnectionPopoverWrapper,
  rowCountDisplay,
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
            {rowCountDisplay != null && <>:&nbsp;{rowCountDisplay}</>}
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
  lineageTabContent,
  // Injected components
  SchemaView,
  SingleEnvSchemaView,
  NodeSqlView,
  ResourceTypeTag,
  NotificationComponent,
  ConnectionPopoverWrapper = DefaultConnectionWrapper,
  // Injected icons
  runTypeIcons,
  // Injected callbacks
  actionCallbacks,
  isActionAvailable = defaultIsActionAvailable,
  isWholeModelChanged = false,
  isWholeModelImpacted = false,
  newCllExperience = false,
  isImpacted = false,
  rowCountDisplay,
}: NodeViewProps<TNode>) {
  const withColumns =
    node.data.resourceType === "model" ||
    node.data.resourceType === "seed" ||
    node.data.resourceType === "source" ||
    node.data.resourceType === "snapshot";

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

  const showAddSchemaDiff =
    !isSingleEnv &&
    isModelSeedOrSnapshot &&
    actionCallbacks?.onAddSchemaDiffClick != null;
  const SchemaDiffIcon = runTypeIcons?.schema_diff ?? DefaultIcon;

  // useTheme().palette.mode === "dark" does NOT work with this codebase's
  // MUI colorSchemes setup — useThemeColors() is the correct accessor.
  const { isDark } = useThemeColors();
  const treatmentInputs = {
    newCllExperience,
    isWholeModelChanged,
    isWholeModelImpacted,
    isImpacted,
    changeCategory: node.data.change?.category as ChangeCategory | undefined,
  };
  // pickTitleChip returns null for per-column kinds — those paint on the
  // LineageNode graph badge instead.
  const titleChip = pickTitleChip(treatmentInputs, isDark);
  const titleRowTooltip = getTitleRowTooltip(
    {
      name: node.data.name,
      resourceType: node.data.resourceType,
      materialized: node.data.materialized,
    },
    treatmentInputs,
  );

  return (
    <Box
      className={titleChip ? "cll-experience" : undefined}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        // Reserve the 3px stripe even when no treatment applies, so the
        // content doesn't shift horizontally when navigating between models
        // with and without whole-model treatment.
        borderLeft: `3px solid ${titleChip ? titleChip.tokens.stripeAccent : "transparent"}`,
      }}
    >
      {/* Header row: name, type tag, close button */}
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          px: 2,
          py: 1.5,
          gap: 1,
        }}
      >
        <MuiTooltip title={titleRowTooltip} placement="top">
          {titleChip ? (
            <TreatmentChip
              tokens={titleChip.tokens}
              variant="titleChip"
              testId={`whole-model-${titleChip.kind}-title-chip`}
              sx={{
                flex: "0 1 auto",
                mr: "auto",
                minWidth: 0,
              }}
            >
              <Typography
                variant="subtitle1"
                component="span"
                className="no-track-pii-safe"
                sx={{
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "inherit",
                }}
              >
                {node.data.name}
              </Typography>
            </TreatmentChip>
          ) : (
            <Typography
              component="span"
              variant="subtitle1"
              className="no-track-pii-safe"
              sx={{
                fontWeight: 600,
                flex: "0 1 auto",
                mr: "auto",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {node.data.name}
            </Typography>
          )}
        </MuiTooltip>
        {ResourceTypeTag && (
          <Box sx={{ color: "text.secondary", flexShrink: 0 }}>
            <ResourceTypeTag node={node} />
          </Box>
        )}
        <IconButton size="small" onClick={onCloseNode} sx={{ flexShrink: 0 }}>
          <IoClose />
        </IconButton>
      </Stack>
      {/* Action buttons row */}
      {isModelSeedOrSnapshot && (
        <Box sx={{ pl: 2, py: 1 }}>
          {isSingleEnv ? (
            <SingleEnvActionButtons
              node={node}
              actionCallbacks={actionCallbacks}
              runTypeIcons={runTypeIcons}
              isActionAvailable={isActionAvailable}
              rowCountDisplay={rowCountDisplay}
            />
          ) : (
            <DiffActionButtons
              node={node}
              actionCallbacks={actionCallbacks}
              runTypeIcons={runTypeIcons}
              featureToggles={featureToggles}
              isActionAvailable={isActionAvailable}
              ConnectionPopoverWrapper={ConnectionPopoverWrapper}
              rowCountDisplay={rowCountDisplay}
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

          {/* Tabs — "Columns" is always index 0 (default landing tab) */}
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Tab
              label={
                <Box
                  component="span"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                  }}
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
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                  }}
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
            {lineageTabContent && <Tab label="Lineage" />}
          </Tabs>

          {/* Tab panels — Columns=0, Code=1, Lineage=2 (when present) */}
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
                        headerAction={
                          showAddSchemaDiff ? (
                            <AddSchemaDiffButton
                              onClick={actionCallbacks?.onAddSchemaDiffClick}
                              Icon={SchemaDiffIcon}
                            />
                          ) : undefined
                        }
                      />
                    )}
              </Box>
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ height: "100%" }}>
                {NodeSqlView && <NodeSqlView node={node} />}
              </Box>
            </TabPanel>
            {lineageTabContent && (
              <TabPanel value={tabValue} index={2}>
                <Box sx={{ height: "100%" }}>{lineageTabContent}</Box>
              </TabPanel>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
