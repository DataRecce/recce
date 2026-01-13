/**
 * Summary components for @datarecce/ui
 *
 * This module provides components and utilities for displaying
 * change summaries in lineage graphs.
 */

// Components
export { ChangeSummary } from "./ChangeSummary";
export { SchemaSummary, type SchemaSummaryProps } from "./SchemaSummary";
// Types
export type {
  ChangeStatus,
  ChangeSummaryProps,
  ChangeSummaryResult,
  ColumnChangeResult,
} from "./types";
export { NODE_CHANGE_STATUS_MSGS } from "./types";
// Utilities
export {
  calculateChangeSummary,
  calculateColumnChange,
  getIconForChangeStatus,
} from "./utils";
