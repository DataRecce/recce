// @datarecce/ui/primitives - Building block components for custom composition
// These are pure presentation components - no data fetching, just props and callbacks.

"use client";

/**
 * Version marker for the primitives surface.
 */
export const PRIMITIVES_API_VERSION = "0.1.0";

// =============================================================================
// LINEAGE PRIMITIVES
// =============================================================================

/**
 * Lineage column node primitives for column-level lineage rendering.
 *
 * @remarks
 * Exports: COLUMN_NODE_HEIGHT, COLUMN_NODE_WIDTH, ColumnTransformationType,
 * LineageColumnNode, LineageColumnNodeData, LineageColumnNodeProps.
 */
export {
  COLUMN_NODE_HEIGHT,
  COLUMN_NODE_WIDTH,
  type ColumnTransformationType,
  LineageColumnNode,
  type LineageColumnNodeData,
  type LineageColumnNodeProps,
} from "./components/lineage/columns";
/**
 * Lineage edge primitives for graph edges.
 *
 * @remarks
 * Exports: EdgeChangeStatus, LineageEdge, LineageEdgeData, LineageEdgeProps.
 */
export {
  type EdgeChangeStatus,
  LineageEdge,
  type LineageEdgeData,
  type LineageEdgeProps,
} from "./components/lineage/edges";
/**
 * Lineage legend primitives for change status and transformation types.
 *
 * @remarks
 * Exports: ChangeStatusLegendItem, LineageLegend, LineageLegendProps,
 * TransformationLegendItem.
 */
export {
  type ChangeStatusLegendItem,
  LineageLegend,
  type LineageLegendProps,
  type TransformationLegendItem,
} from "./components/lineage/legend";
/**
 * Lineage node primitives for graph nodes.
 *
 * @remarks
 * Exports: LineageNode, LineageNodeData, LineageNodeProps, NodeChangeStatus.
 */
export {
  LineageNode,
  type LineageNodeData,
  type LineageNodeProps,
  type NodeChangeStatus,
} from "./components/lineage/nodes";

// =============================================================================
// CHECK PRIMITIVES
// =============================================================================

/**
 * Check action primitives for check-level actions.
 *
 * @remarks
 * Exports: CheckAction, CheckActions, CheckActionsProps, CheckActionType.
 */
export {
  type CheckAction,
  CheckActions,
  type CheckActionsProps,
  type CheckActionType,
} from "./components/check/CheckActions";
/**
 * Check breadcrumb primitive for inline name editing.
 *
 * @remarks
 * Exports: CheckBreadcrumb, CheckBreadcrumbProps.
 */
export {
  CheckBreadcrumb,
  type CheckBreadcrumbProps,
} from "./components/check/CheckBreadcrumb";
/**
 * Check card primitives for individual check display.
 *
 * @remarks
 * Exports: CheckCard, CheckCardData, CheckCardProps, CheckRunStatus, CheckType.
 */
export {
  CheckCard,
  type CheckCardData,
  type CheckCardProps,
  type CheckRunStatus,
  type CheckType,
} from "./components/check/CheckCard";
/**
 * Check description primitives for inline description editing.
 *
 * @remarks
 * Exports: CheckDescription, CheckDescriptionProps.
 */
export {
  CheckDescription,
  type CheckDescriptionProps,
} from "./components/check/CheckDescription";
/**
 * Check detail primitives for full check view content.
 *
 * @remarks
 * Exports: CheckDetail, CheckDetailProps, CheckDetailTab.
 */
export {
  CheckDetail,
  type CheckDetailProps,
  type CheckDetailTab,
} from "./components/check/CheckDetail";
/**
 * Check empty state primitive.
 *
 * @remarks
 * Exports: CheckEmptyState, CheckEmptyStateProps.
 */
export {
  CheckEmptyState,
  type CheckEmptyStateProps,
} from "./components/check/CheckEmptyState";
/**
 * Check list primitives for rendering the checks list.
 *
 * @remarks
 * Exports: CheckList, CheckListProps.
 */
export { CheckList, type CheckListProps } from "./components/check/CheckList";

/**
 * Lineage diff view primitives for check results.
 *
 * @remarks
 * Exports: LineageDiffView, LineageDiffViewOptions, LineageDiffViewProps, LineageViewRef.
 */
export {
  LineageDiffView,
  type LineageDiffViewOptions,
  type LineageDiffViewProps,
  type LineageViewRef,
} from "./components/check/LineageDiffView";

/**
 * Preset check template primitives.
 *
 * @remarks
 * Exports: GenerateCheckTemplateOptions, generateCheckTemplate,
 * PresetCheckTemplateView, PresetCheckTemplateViewProps.
 */
export {
  type GenerateCheckTemplateOptions,
  generateCheckTemplate,
  PresetCheckTemplateView,
  type PresetCheckTemplateViewProps,
} from "./components/check/PresetCheckTemplateView";

/**
 * Check timeline primitives.
 *
 * @remarks
 * Exports: CommentInput, CommentInputProps, TimelineActor, TimelineEvent,
 * TimelineEventData, TimelineEventProps, TimelineEventType.
 */
export {
  CommentInput,
  type CommentInputProps,
  type TimelineActor,
  TimelineEvent,
  type TimelineEventData,
  type TimelineEventProps,
  type TimelineEventType,
} from "./components/check/timeline";

/**
 * Check utility functions.
 *
 * @remarks
 * Exports: buildCheckDescription, buildCheckTitle, formatSqlAsMarkdown,
 * isDisabledByNoResult.
 */
export {
  buildCheckDescription,
  buildCheckTitle,
  formatSqlAsMarkdown,
  isDisabledByNoResult,
} from "./components/check/utils";

// =============================================================================
// RUN PRIMITIVES
// =============================================================================

/**
 * Run list primitives for run history display.
 *
 * @remarks
 * Exports: RunList, RunListItem, RunListItemData, RunListItemProps, RunListProps.
 */
export {
  RunList,
  RunListItem,
  type RunListItemData,
  type RunListItemProps,
  type RunListProps,
} from "./components/run/RunList";

/**
 * Run progress primitives for execution indicators.
 *
 * @remarks
 * Exports: RunProgress, RunProgressOverlay, RunProgressOverlayProps,
 * RunProgressProps, RunProgressVariant.
 */
export {
  RunProgress,
  RunProgressOverlay,
  type RunProgressOverlayProps,
  type RunProgressProps,
  type RunProgressVariant,
} from "./components/run/RunProgress";

/**
 * Run status badge primitives.
 *
 * @remarks
 * Exports: formatRunDate, formatRunDateTime, inferRunStatus, RunStatus,
 * RunStatusAndDate, RunStatusAndDateProps, RunStatusBadge, RunStatusBadgeProps,
 * RunStatusWithDate, RunStatusWithDateProps.
 */
export {
  formatRunDate,
  formatRunDateTime,
  inferRunStatus,
  type RunStatus,
  RunStatusAndDate,
  type RunStatusAndDateProps,
  RunStatusBadge,
  type RunStatusBadgeProps,
  RunStatusWithDate,
  type RunStatusWithDateProps,
} from "./components/run/RunStatusBadge";

/**
 * Run toolbar primitives for warnings and actions.
 *
 * @remarks
 * Exports: DiffViewOptions, RunToolbar, RunToolbarProps.
 */
export {
  type DiffViewOptions,
  RunToolbar,
  type RunToolbarProps,
} from "./components/run/RunToolbar";

/**
 * Run registry types for extensibility.
 *
 * @remarks
 * Exports: RefTypes, RegistryEntry, RunFormParamTypes, RunFormProps,
 * RunResultViewProps, ViewOptionTypes.
 */
export type {
  RefTypes,
  RegistryEntry,
  RunFormParamTypes,
  RunFormProps,
  RunResultViewProps,
  ViewOptionTypes,
} from "./components/run/types";

// =============================================================================
// DATA PRIMITIVES
// =============================================================================

/**
 * Histogram chart primitives (Chart.js based).
 *
 * @remarks
 * Exports: ChartBarColors, ChartThemeColors, getChartBarColors,
 * getChartThemeColors, HistogramChart, HistogramChartProps, HistogramDataset,
 * HistogramDataType.
 */
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
/**
 * Screenshot data grid primitives (AG Grid wrapper).
 *
 * @remarks
 * Exports: ColDef, ColGroupDef, DataGridHandle, DataGridRow, EmptyRowsRenderer,
 * EmptyRowsRendererProps, GetRowIdParams, GridReadyEvent, RecceDataGridHandle,
 * ScreenshotDataGrid, ScreenshotDataGridProps.
 */
export {
  type ColDef,
  type ColGroupDef,
  type DataGridHandle,
  type DataGridRow,
  EmptyRowsRenderer,
  type EmptyRowsRendererProps,
  type GetRowIdParams,
  type GridReadyEvent,
  type RecceDataGridHandle,
  ScreenshotDataGrid,
  type ScreenshotDataGridProps,
} from "./components/data/ScreenshotDataGrid";

/**
 * Top-K bar chart primitives (value distribution).
 *
 * @remarks
 * Exports: TopKBarChart, TopKBarChartProps, TopKDataset, TopKItem.
 */
export {
  TopKBarChart,
  type TopKBarChartProps,
  type TopKDataset,
  type TopKItem,
} from "./components/data/TopKBarChart";

// =============================================================================
// SCHEMA PRIMITIVES
// =============================================================================

/**
 * Schema diff primitives for base vs current comparison.
 *
 * @remarks
 * Exports: mergeSchemaColumns, SchemaDiff, SchemaDiffHandle, SchemaDiffProps,
 * SchemaDiffRow, SchemaDiffStatus.
 */
export {
  mergeSchemaColumns,
  SchemaDiff,
  type SchemaDiffHandle,
  type SchemaDiffProps,
  type SchemaDiffRow,
  type SchemaDiffStatus,
} from "./components/schema/SchemaDiff";

// =============================================================================
// EDITOR PRIMITIVES
// =============================================================================

/**
 * Code editor primitives (CodeMirror based).
 *
 * @remarks
 * Exports: CodeEditor, CodeEditorLanguage, CodeEditorProps, CodeEditorTheme.
 */
export {
  CodeEditor,
  type CodeEditorLanguage,
  type CodeEditorProps,
  type CodeEditorTheme,
} from "./components/editor/CodeEditor";

/**
 * Diff editor primitives (CodeMirror merge view).
 *
 * @remarks
 * Exports: DiffEditor, DiffEditorLanguage, DiffEditorProps, DiffEditorTheme.
 */
export {
  DiffEditor,
  type DiffEditorLanguage,
  type DiffEditorProps,
  type DiffEditorTheme,
} from "./components/editor/DiffEditor";

// =============================================================================
// UI PRIMITIVES
// =============================================================================

/**
 * Diff text primitives for inline diff visualization.
 *
 * @remarks
 * Exports: DiffText, DiffTextProps.
 */
export { DiffText, type DiffTextProps } from "./components/ui/DiffText";
/**
 * Dropdown values input primitives (multi-select with filtering).
 *
 * @remarks
 * Exports: DropdownValuesInput, DropdownValuesInputProps, DropdownValuesInputSize.
 */
export {
  DropdownValuesInput,
  type DropdownValuesInputProps,
  type DropdownValuesInputSize,
} from "./components/ui/DropdownValuesInput";
/**
 * Empty state primitives.
 *
 * @remarks
 * Exports: EmptyState, EmptyStateProps.
 */
export { EmptyState, type EmptyStateProps } from "./components/ui/EmptyState";
/**
 * External link confirmation dialog primitives.
 *
 * @remarks
 * Exports: ExternalLinkConfirmDialog, ExternalLinkConfirmDialogProps, truncateUrl.
 */
export {
  ExternalLinkConfirmDialog,
  type ExternalLinkConfirmDialogProps,
  truncateUrl,
} from "./components/ui/ExternalLinkConfirmDialog";
/**
 * Markdown content primitives.
 *
 * @remarks
 * Exports: MarkdownContent, MarkdownContentProps.
 */
export {
  MarkdownContent,
  type MarkdownContentProps,
} from "./components/ui/MarkdownContent";
/**
 * Screenshot box primitives.
 *
 * @remarks
 * Exports: ScreenshotBox, ScreenshotBoxProps.
 */
export {
  ScreenshotBox,
  type ScreenshotBoxProps,
} from "./components/ui/ScreenshotBox";
/**
 * Split pane primitives (resizable layout).
 *
 * @remarks
 * Exports: HSplit, SplitProps, VSplit.
 */
export { HSplit, type SplitProps, VSplit } from "./components/ui/Split";
/**
 * Split pane primitives with explicit direction.
 *
 * @remarks
 * Exports: SplitDirection, SplitPane, SplitPaneProps.
 */
export {
  type SplitDirection,
  SplitPane,
  type SplitPaneProps,
} from "./components/ui/SplitPane";

// =============================================================================
// RESULT VIEW PRIMITIVES
// =============================================================================
// NOTE: Result view factory canonical in @datarecce/ui/result

/**
 * Result view factory primitives.
 * @deprecated Import from @datarecce/ui/result instead
 */
export {
  type CreatedResultViewProps,
  createResultView,
  type ResultViewConfig,
  type ResultViewData,
  type ResultViewProps,
  type ResultViewRef,
  type ResultViewTransformOptions,
  type ScreenshotWrapperType,
} from "./components/result";
