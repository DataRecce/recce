// @datarecce/ui/primitives - Building block components for custom composition
// These are pure presentation components - no data fetching, just props and callbacks.

"use client";

export const PRIMITIVES_API_VERSION = "0.1.0";

// =============================================================================
// LINEAGE PRIMITIVES
// =============================================================================

// Lineage node components
export {
  LineageNode,
  type LineageNodeData,
  type LineageNodeProps,
  type NodeChangeStatus,
} from "./components/lineage/nodes";

// Lineage edge components
export {
  LineageEdge,
  type EdgeChangeStatus,
  type LineageEdgeData,
  type LineageEdgeProps,
} from "./components/lineage/edges";

// Lineage column node components (for column-level lineage)
export {
  COLUMN_NODE_HEIGHT,
  COLUMN_NODE_WIDTH,
  LineageColumnNode,
  type ColumnTransformationType,
  type LineageColumnNodeData,
  type LineageColumnNodeProps,
} from "./components/lineage/columns";

// Lineage controls (zoom, pan, fit-view)
export {
  ControlButton,
  LineageControls,
  type LineageControlsProps,
} from "./components/lineage/controls";

// Lineage legends (change status, transformation types)
export {
  LineageLegend,
  type ChangeStatusLegendItem,
  type LineageLegendProps,
  type TransformationLegendItem,
} from "./components/lineage/legend";

// =============================================================================
// CHECK PRIMITIVES
// =============================================================================

// Check card (single check display)
export {
  CheckCard,
  type CheckCardData,
  type CheckCardProps,
  type CheckRunStatus,
  type CheckType,
} from "./components/check/CheckCard";

// Check list (list of checks)
export { CheckList, type CheckListProps } from "./components/check/CheckList";

// Check detail (detailed check view)
export {
  CheckDetail,
  type CheckDetailProps,
  type CheckDetailTab,
} from "./components/check/CheckDetail";

// Check description (editable description)
export {
  CheckDescription,
  type CheckDescriptionProps,
} from "./components/check/CheckDescription";

// Check empty state
export {
  CheckEmptyState,
  type CheckEmptyStateProps,
} from "./components/check/CheckEmptyState";

// Check actions (action buttons/menu)
export {
  CheckActions,
  type CheckAction,
  type CheckActionsProps,
  type CheckActionType,
} from "./components/check/CheckActions";

// =============================================================================
// QUERY PRIMITIVES
// =============================================================================

// Query editor (SQL/YAML editing)
export {
  QueryEditor,
  QueryEditorToolbar,
  QueryEditorWithToolbar,
  type QueryEditorKeyBinding,
  type QueryEditorLanguage,
  type QueryEditorProps,
  type QueryEditorTheme,
  type QueryEditorToolbarProps,
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

// Query diff view (side-by-side or inline diff)
export {
  QueryDiffView,
  type DiffColumn,
  type DiffDisplayMode,
  type DiffRow,
  type QueryDiffViewHandle,
  type QueryDiffViewProps,
} from "./components/query/QueryDiffView";

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
  RunStatusBadge,
  RunStatusWithDate,
  type RunStatus,
  type RunStatusBadgeProps,
  type RunStatusWithDateProps,
} from "./components/run/RunStatusBadge";

// =============================================================================
// DATA PRIMITIVES (to be added in Phase 2E)
// =============================================================================

// Data grid primitives (to be added)
// export { DataGrid } from "./components/data/DataGrid";
// export { DataGridDiff } from "./components/data/DataGridDiff";
// export { HistogramChart } from "./components/data/HistogramChart";
// export { ProfileTable } from "./components/data/ProfileTable";
// export { TopKTable } from "./components/data/TopKTable";
