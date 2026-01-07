/**
 * Check Timeline Components
 *
 * Timeline/conversation feature for checks, enabling GitHub PR-style
 * discussions with comments and automatic tracking of state changes.
 *
 * NOTE: This feature is only available when connected to Recce Cloud.
 */

// Re-export CommentInput from UI package
export { CommentInput, type CommentInputProps } from "@datarecce/ui/primitives";
export { CheckTimeline } from "./CheckTimeline";

// TimelineEvent is kept local (has OSS-specific avatar fetching via React Query)
export { TimelineEvent } from "./TimelineEvent";
