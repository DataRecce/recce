// @datarecce/ui/types - Type-only exports for TypeScript consumers
// Use this entry point when you only need types (no runtime code)
// Import: import type { CheckCardData, LineageNodeData } from '@datarecce/ui/types';

export const TYPES_API_VERSION = "0.1.0";

// =============================================================================
// LINEAGE TYPES
// =============================================================================

// Column node types
export type {
  ColumnTransformationType,
  LineageColumnNodeData,
  LineageColumnNodeProps,
} from "../components/lineage/columns";
// Edge types
export type {
  EdgeChangeStatus,
  LineageEdgeData,
  LineageEdgeProps,
} from "../components/lineage/edges";
// Canvas types
export type { LineageCanvasProps } from "../components/lineage/LineageCanvas";
// View types
export type {
  LineageViewProps,
  LineageViewRef,
} from "../components/lineage/LineageView";
// Legend types
export type {
  ChangeStatusLegendItem,
  LineageLegendProps,
  TransformationLegendItem,
} from "../components/lineage/legend";
// Node types
export type {
  LineageNodeData,
  LineageNodeProps,
  NodeChangeStatus,
} from "../components/lineage/nodes";

// =============================================================================
// CHECK TYPES
// =============================================================================

export type {
  CheckAction,
  CheckActionsProps,
  CheckActionType,
} from "../components/check/CheckActions";
export type {
  CheckCardData,
  CheckCardProps,
  CheckRunStatus,
  CheckType,
} from "../components/check/CheckCard";
export type { CheckDescriptionProps } from "../components/check/CheckDescription";
export type {
  CheckDetailProps,
  CheckDetailTab,
} from "../components/check/CheckDetail";
export type { CheckEmptyStateProps } from "../components/check/CheckEmptyState";
export type { CheckListProps } from "../components/check/CheckList";

// =============================================================================
// RUN TYPES
// =============================================================================

export type {
  RunListItemData,
  RunListItemProps,
  RunListProps,
} from "../components/run/RunList";

export type {
  RunProgressOverlayProps,
  RunProgressProps,
  RunProgressVariant,
} from "../components/run/RunProgress";

export type {
  RunStatus,
  RunStatusBadgeProps,
  RunStatusWithDateProps,
} from "../components/run/RunStatusBadge";

// =============================================================================
// DATA TYPES
// =============================================================================

export type {
  ChartBarColors,
  ChartThemeColors,
  HistogramChartProps,
  HistogramDataset,
  HistogramDataType,
} from "../components/data/HistogramChart";

export type {
  TopKBarChartProps,
  TopKDataset,
  TopKItem,
} from "../components/data/TopKBarChart";

// =============================================================================
// SCHEMA TYPES
// =============================================================================

export type {
  SchemaDiffHandle,
  SchemaDiffProps,
  SchemaDiffRow,
  SchemaDiffStatus,
} from "../components/schema/SchemaDiff";

// =============================================================================
// EDITOR TYPES
// =============================================================================

export type {
  DiffEditorLanguage,
  DiffEditorProps,
  DiffEditorTheme,
} from "../components/editor/DiffEditor";

// =============================================================================
// UI TYPES
// =============================================================================

export type { EmptyStateProps } from "../components/ui/EmptyState";

export type {
  SplitDirection,
  SplitPaneProps,
} from "../components/ui/SplitPane";

// =============================================================================
// CONTEXT TYPES
// =============================================================================

// Action context types
export type {
  AxiosQueryParams,
  RecceActionContextType,
  RecceActionOptions,
  RecceActionProviderProps,
  SubmitRunTrackProps,
} from "../contexts/action";
// Idle timeout types
export type { IdleTimeoutContextType } from "../contexts/idle";
// Instance context types
export type { InstanceInfoType } from "../contexts/instance";
export type {
  LineageGraphContextType,
  LineageGraphProviderProps,
} from "../contexts/lineage";
// Lineage graph types
export type {
  EnvInfo,
  LineageGraph,
  LineageGraphColumnNode,
  LineageGraphEdge,
  LineageGraphNode,
  LineageGraphNodes,
} from "../contexts/lineage/types";
export type { NodeColumnSetMap } from "../contexts/lineage/utils";

// =============================================================================
// PROVIDER TYPES
// =============================================================================

export type {
  Check,
  CheckContextType,
  CheckProviderProps,
} from "../providers/contexts/CheckContext";

export type {
  QueryContextType,
  QueryProviderProps,
  QueryResult,
} from "../providers/contexts/QueryContext";

export type {
  NavigateOptions,
  RoutingConfig,
  RoutingContextValue,
} from "../providers/contexts/RoutingContext";

export type { RecceProviderProps } from "../providers/RecceProvider";

// =============================================================================
// THEME TYPES
// =============================================================================

export type { ThemeColors } from "../hooks/useThemeColors";
export type { Theme } from "../theme";
export type {
  ColorShade,
  SemanticColorVariant,
} from "../theme/colors";

// =============================================================================
// API TYPES
// =============================================================================

export type {
  CatalogMetadata,
  GitInfo,
  LineageData,
  LineageDataFromMetadata,
  LineageDiffData,
  ManifestMetadata,
  NodeColumnData,
  NodeData,
  PullRequestInfo,
  RecceInstanceInfo,
  RecceServerFlags,
  RunsAggregated,
  ServerInfoResult,
  ServerMode,
  SQLMeshInfo,
  StateMetadata,
} from "../api";

// =============================================================================
// FEATURE TYPES
// =============================================================================

export type {
  RecceFeatureMode,
  RecceFeatureToggles,
} from "../contexts/instance";
