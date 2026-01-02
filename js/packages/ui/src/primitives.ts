// @datarecce/ui/primitives - Building block components for custom composition
// These are pure presentation components - no data fetching, just props and callbacks.

"use client";

export const PRIMITIVES_API_VERSION = "0.1.0";

// =============================================================================
// LINEAGE PRIMITIVES
// =============================================================================

// Lineage column node components (for column-level lineage)
export {
  COLUMN_NODE_HEIGHT,
  COLUMN_NODE_WIDTH,
  type ColumnTransformationType,
  LineageColumnNode,
  type LineageColumnNodeData,
  type LineageColumnNodeProps,
} from "./components/lineage/columns";
// Lineage controls (zoom, pan, fit-view)
export {
  ControlButton,
  LineageControls,
  type LineageControlsProps,
} from "./components/lineage/controls";
// Lineage edge components
export {
  type EdgeChangeStatus,
  LineageEdge,
  type LineageEdgeData,
  type LineageEdgeProps,
} from "./components/lineage/edges";
// Lineage legends (change status, transformation types)
export {
  type ChangeStatusLegendItem,
  LineageLegend,
  type LineageLegendProps,
  type TransformationLegendItem,
} from "./components/lineage/legend";
// Lineage node components
export {
  LineageNode,
  type LineageNodeData,
  type LineageNodeProps,
  type NodeChangeStatus,
} from "./components/lineage/nodes";

// =============================================================================
// CHECK PRIMITIVES
// =============================================================================

// Check actions (action buttons/menu)
export {
  type CheckAction,
  CheckActions,
  type CheckActionsProps,
  type CheckActionType,
} from "./components/check/CheckActions";
// Check card (single check display)
export {
  CheckCard,
  type CheckCardData,
  type CheckCardProps,
  type CheckRunStatus,
  type CheckType,
} from "./components/check/CheckCard";
// Check description (editable description)
export {
  CheckDescription,
  type CheckDescriptionProps,
} from "./components/check/CheckDescription";
// Check detail (detailed check view)
export {
  CheckDetail,
  type CheckDetailProps,
  type CheckDetailTab,
} from "./components/check/CheckDetail";

// Check empty state
export {
  CheckEmptyState,
  type CheckEmptyStateProps,
} from "./components/check/CheckEmptyState";
// Check list (list of checks)
export { CheckList, type CheckListProps } from "./components/check/CheckList";

// =============================================================================
// QUERY PRIMITIVES
// =============================================================================

// Query diff view (side-by-side or inline diff)
export {
  type DiffColumn,
  type DiffDisplayMode,
  type DiffRow,
  QueryDiffView,
  type QueryDiffViewHandle,
  type QueryDiffViewProps,
} from "./components/query/QueryDiffView";
// Query editor (SQL/YAML editing)
export {
  QueryEditor,
  type QueryEditorKeyBinding,
  type QueryEditorLanguage,
  type QueryEditorProps,
  type QueryEditorTheme,
  QueryEditorToolbar,
  type QueryEditorToolbarProps,
  QueryEditorWithToolbar,
  type QueryEditorWithToolbarProps,
} from "./components/query/QueryEditor";
// Query results (data grid display)
export {
  QueryResults,
  type QueryResultsColumn,
  type QueryResultsHandle,
  type QueryResultsProps,
  type QueryResultsRow,
} from "./components/query/QueryResults";

// =============================================================================
// RUN PRIMITIVES
// =============================================================================

// Run list (run history display)
export {
  RunList,
  RunListItem,
  type RunListItemData,
  type RunListItemProps,
  type RunListProps,
} from "./components/run/RunList";

// Run progress (loading/execution indicators)
export {
  RunProgress,
  RunProgressOverlay,
  type RunProgressOverlayProps,
  type RunProgressProps,
  type RunProgressVariant,
} from "./components/run/RunProgress";

// Run status badge (status display)
export {
  formatRunDate,
  formatRunDateTime,
  type RunStatus,
  RunStatusBadge,
  type RunStatusBadgeProps,
  RunStatusWithDate,
  type RunStatusWithDateProps,
} from "./components/run/RunStatusBadge";

// =============================================================================
// DATA PRIMITIVES
// =============================================================================

// Histogram chart (Chart.js based data distribution)
export {
  type ChartBarColors,
  type ChartThemeColors,
  getChartBarColors,
  getChartThemeColors,
  HistogramChart,
  type HistogramChartProps,
  type HistogramDataset,
  type HistogramDataType,
} from "./components/data/HistogramChart";

// Profile table (AG Grid based column statistics)
export {
  type ColumnRenderMode,
  type ProfileColumn,
  type ProfileDisplayMode,
  type ProfileRow,
  ProfileTable,
  type ProfileTableHandle,
  type ProfileTableProps,
} from "./components/data/ProfileTable";

// Top-K bar chart (value distribution)
export {
  SingleBarChart,
  type SingleBarChartProps,
  TopKBarChart,
  type TopKBarChartProps,
  type TopKDataset,
  type TopKItem,
  TopKSummaryList,
  type TopKSummaryListProps,
} from "./components/data/TopKBarChart";

// =============================================================================
// SCHEMA PRIMITIVES
// =============================================================================

// Schema diff (base vs current comparison)
export {
  mergeSchemaColumns,
  SchemaDiff,
  type SchemaDiffHandle,
  type SchemaDiffProps,
  type SchemaDiffRow,
  type SchemaDiffStatus,
} from "./components/schema/SchemaDiff";
// Schema table (single environment)
export {
  type SchemaColumnData,
  type SchemaRow,
  SchemaTable,
  type SchemaTableHandle,
  type SchemaTableProps,
} from "./components/schema/SchemaTable";

// =============================================================================
// EDITOR PRIMITIVES
// =============================================================================

// Diff editor (CodeMirror merge view for text diffs)
export {
  DiffEditor,
  type DiffEditorLanguage,
  type DiffEditorProps,
  type DiffEditorTheme,
} from "./components/editor/DiffEditor";

// =============================================================================
// UI PRIMITIVES
// =============================================================================

// Empty state (placeholder for no data)
export { EmptyState, type EmptyStateProps } from "./components/ui/EmptyState";

// Split pane (resizable split layout)
export {
  type SplitDirection,
  SplitPane,
  type SplitPaneProps,
} from "./components/ui/SplitPane";

// Status badge (status indicators)
export {
  StatusBadge,
  type StatusBadgeProps,
  type StatusType,
} from "./components/ui/StatusBadge";
