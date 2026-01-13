"use client";

// Check primitives - pure presentation components

export {
  type CheckAction,
  CheckActions,
  type CheckActionsProps,
  type CheckActionType,
} from "./CheckActions";
export {
  CheckBreadcrumb,
  type CheckBreadcrumbProps,
} from "./CheckBreadcrumb";
export {
  CheckCard,
  type CheckCardData,
  type CheckCardProps,
  type CheckRunStatus,
  type CheckType,
} from "./CheckCard";
export {
  CheckDescription,
  type CheckDescriptionProps,
} from "./CheckDescription";
export {
  CheckDetail,
  type CheckDetailProps,
  type CheckDetailTab,
} from "./CheckDetail";
export {
  CheckEmptyState,
  type CheckEmptyStateProps,
} from "./CheckEmptyState";
export { CheckEmptyStateOss } from "./CheckEmptyStateOss";
export {
  CheckList,
  type CheckListProps,
} from "./CheckList";
export { CheckListOss } from "./CheckListOss";

// Lineage diff view for check results
export {
  LineageDiffView,
  type LineageDiffViewOptions,
  type LineageDiffViewProps,
  type LineageViewRef,
} from "./LineageDiffView";
export {
  LineageDiffViewOss,
  type LineageDiffViewProps as LineageDiffViewOssProps,
} from "./LineageDiffViewOss";

// Preset check template view
export {
  type GenerateCheckTemplateOptions,
  generateCheckTemplate,
  PresetCheckTemplateView,
  type PresetCheckTemplateViewProps,
} from "./PresetCheckTemplateView";
export { SchemaDiffView } from "./SchemaDiffView";

// Timeline components
export {
  CommentInput,
  type CommentInputProps,
  type TimelineActor,
  TimelineEvent,
  type TimelineEventData,
  type TimelineEventProps,
  type TimelineEventType,
} from "./timeline";

// Utility functions
export {
  buildCheckDescription,
  buildCheckTitle,
  formatSqlAsMarkdown,
  isDisabledByNoResult,
} from "./utils";
