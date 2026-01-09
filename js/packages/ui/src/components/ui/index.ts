"use client";

// UI primitives - common presentation components

export { DiffText, type DiffTextProps } from "./DiffText";
export {
  DropdownValuesInput,
  type DropdownValuesInputProps,
  type DropdownValuesInputSize,
} from "./DropdownValuesInput";
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
