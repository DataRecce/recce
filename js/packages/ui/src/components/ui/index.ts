"use client";

// UI primitives - common presentation components

export {
  ChangedOnlyCheckbox,
  type ChangedOnlyCheckboxProps,
} from "./ChangedOnlyCheckbox";
export {
  type DiffDisplayMode,
  DiffDisplayModeSwitch,
  type DiffDisplayModeSwitchProps,
} from "./DiffDisplayModeSwitch";
export { DiffText, type DiffTextProps } from "./DiffText";
export {
  DiffTextWithToast,
  type DiffTextWithToastProps,
} from "./DiffTextWithToast";
export {
  DropdownValuesInput,
  type DropdownValuesInputProps,
  type DropdownValuesInputSize,
} from "./DropdownValuesInput";
// DataGrid components - cell renderers and column headers
export type {
  ColDefWithMetadata,
  DataFrameColumnGroupHeaderProps,
  DataFrameColumnHeaderProps,
  InlineDiffTextProps,
  InlineRenderCellConfig,
  MatchedPercentCellProps,
  PrimaryKeyIndicatorCellProps,
  RecceColumnContext,
  ValueDataGridOptions,
  ValueDataGridResult,
  ValueDiffColumnNameCellProps,
} from "./dataGrid";
export {
  asNumber,
  createColumnNameRenderer,
  createInlineRenderCell,
  createPrimaryKeyIndicatorRenderer,
  DataFrameColumnGroupHeader,
  DataFrameColumnHeader,
  defaultRenderCell,
  inlineRenderCell,
  MatchedPercentCell,
  PrimaryKeyIndicatorCell,
  renderMatchedPercentCell,
  toValueDataGrid,
  ValueDiffColumnNameCell,
} from "./dataGrid";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
// Markdown
export {
  ExternalLinkConfirmDialog,
  type ExternalLinkConfirmDialogProps,
  truncateUrl,
} from "./ExternalLinkConfirmDialog";
export {
  MarkdownContent,
  type MarkdownContentProps,
} from "./MarkdownContent";
export { MuiProvider } from "./mui-provider";
export { semanticColors } from "./mui-theme";
export { ScreenshotBox, type ScreenshotBoxProps } from "./ScreenshotBox";
export { HSplit, type SplitProps, VSplit } from "./Split";
export {
  type SplitDirection,
  SplitPane,
  type SplitPaneProps,
} from "./SplitPane";
export { SquareIcon, type SquareIconProps } from "./SquareIcon";
export {
  StatusBadge,
  type StatusBadgeProps,
  type StatusType,
} from "./StatusBadge";
// Toast notification system
export {
  Toaster,
  ToasterProvider,
  type ToastOptions,
  toaster,
  useToaster,
} from "./Toaster";
export { ToggleSwitch, type ToggleSwitchProps } from "./ToggleSwitch";
