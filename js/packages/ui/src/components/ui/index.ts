"use client";

// UI primitives - common presentation components

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
