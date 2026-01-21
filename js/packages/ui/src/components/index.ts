"use client";

// Components barrel export
// Re-exports all UI components from @datarecce/ui

// App components
export { EnvInfo, Main, MainLayout } from "./app";

// Check components
export type {
  CheckAction,
  CheckActionsProps,
  CheckActionType,
  CheckBreadcrumbProps,
  CheckCardData,
  CheckCardProps,
  CheckDescriptionProps,
  CheckDetailProps,
  CheckDetailTab,
  CheckEmptyStateProps,
  CheckListProps,
  CheckRunStatus,
  CheckType,
} from "./check";
export {
  CheckActions,
  CheckBreadcrumb,
  CheckCard,
  CheckDescription,
  CheckDetail,
  CheckDetailOss,
  CheckEmptyState,
  CheckEmptyStateOss,
  CheckList,
  CheckListOss,
  CheckPageContentOss,
  CheckPageLoadingOss,
  isDisabledByNoResult,
} from "./check";
// Error boundary components
export { ErrorBoundary } from "./errorboundary";

// Histogram components
export type { HistogramDiffRun, HistogramResultViewProps } from "./histogram";
export {
  HistogramDiffForm,
  HistogramDiffResultView,
  supportsHistogramDiff,
} from "./histogram";
// Lineage visualization components
export type {
  LineageCanvasProps,
  LineageViewProps,
  LineageViewRef,
} from "./lineage";
export { LineageCanvas, LineagePageOss, LineageView } from "./lineage";
// Notification components
export type { NotificationProps } from "./notifications";
export { LineageViewNotification } from "./notifications";
// Onboarding guide components
export { LearnHowLink, RecceNotification } from "./onboarding-guide";
// Profile result views and forms
export type {
  ProfileDiffFormParams,
  ProfileDiffRun,
  ProfileResultViewProps,
  ProfileRun,
} from "./profile";
export {
  ProfileDiffForm,
  ProfileDiffResultView,
  ProfileResultView,
} from "./profile";
// Query components
export type {
  DualSqlEditorProps,
  QueryDiffResultViewProps,
  QueryDiffViewOptions,
  QueryFormProps,
  QueryResultViewProps,
  QueryViewOptions,
  SetupConnectionGuideProps,
  SqlEditorProps,
} from "./query";
export {
  DualSqlEditor,
  QueryDiffResultView,
  QueryForm,
  QueryPageOss,
  QueryResultView,
  SetupConnectionGuide,
  SqlEditor,
} from "./query";
// Row count result views
export type {
  RowCountDiffRun,
  RowCountResultViewProps,
  RowCountRun,
} from "./rowcount";
export { RowCountDiffResultView, RowCountResultView } from "./rowcount";
export type {
  IconComponent,
  PartialRunTypeRegistry,
  RunFormProps,
  RunListItemData,
  RunListItemProps,
  RunListProps,
  RunProgressOverlayProps,
  RunProgressProps,
  RunProgressVariant,
  RunResultViewProps,
  RunResultViewRef,
  RunStatus,
  RunStatusBadgeProps,
  RunStatusWithDateProps,
  RunToolbarProps,
  RunTypeConfig,
  RunTypeRegistry,
} from "./run";
// Run primitives and registry
export {
  createBoundFindByRunType,
  createRunTypeRegistry,
  defaultRunTypeConfig,
  findByRunType,
  formatRunDate,
  formatRunDateTime,
  RunList,
  RunListItem,
  RunListOss,
  RunProgress,
  RunProgressOverlay,
  RunStatusBadge,
  RunStatusWithDate,
  RunToolbar,
  RunViewOss,
} from "./run";
// Schema components
export type { ColumnNameCellProps } from "./schema";
export {
  ColumnNameCell,
  mergeSchemaColumns,
  SchemaDiff,
  type SchemaDiffHandle,
  type SchemaDiffProps,
  type SchemaDiffRow,
  type SchemaDiffStatus,
  SchemaView,
  SingleEnvSchemaView,
} from "./schema";
// Shared components
export { HistoryToggle } from "./shared";
// Summary components
export type {
  ChangeStatus,
  ChangeSummaryProps,
  ChangeSummaryResult,
  ColumnChangeResult,
} from "./summary";
export {
  ChangeSummary,
  calculateChangeSummary,
  calculateColumnChange,
  getIconForChangeStatus,
  NODE_CHANGE_STATUS_MSGS,
  SchemaSummary,
} from "./summary";
// Timeout components
export { IdleTimeoutBadge } from "./timeout";
// Top-K diff components
export type { TopKDiffResultViewProps, TopKDiffRun } from "./top-k";
export { TopKDiffForm, TopKDiffResultView } from "./top-k";
// UI primitives
export type {
  ChangedOnlyCheckboxProps,
  DiffDisplayMode,
  DiffDisplayModeSwitchProps,
  DiffTextProps,
  SplitProps,
  SquareIconProps,
  ToggleSwitchProps,
} from "./ui";
export {
  ChangedOnlyCheckbox,
  DiffDisplayModeSwitch,
  DiffText,
  HSplit,
  SquareIcon,
  ToggleSwitch,
  VSplit,
} from "./ui";
// Value diff result views and forms
export type {
  ValueDiffDetailResultViewProps,
  ValueDiffDetailRun,
  ValueDiffDetailViewOptions,
  ValueDiffFormParams,
  ValueDiffResultViewProps,
  ValueDiffRun,
} from "./valuediff";
export {
  ValueDiffDetailResultView,
  ValueDiffForm,
  ValueDiffResultView,
} from "./valuediff";
// High-level view components (Layer 3)
export type { ChecksViewProps } from "./views";
export { ChecksView } from "./views";
