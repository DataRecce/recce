/**
 * @file ChangeSummary.tsx
 * @description OSS re-export for ChangeSummary component
 *
 * This file re-exports the ChangeSummary component and related utilities
 * from @datarecce/ui for backward compatibility with existing OSS imports.
 *
 * The core implementation lives in @datarecce/ui.
 */

export type {
  ChangeStatus,
  ChangeSummaryProps as Props,
  ChangeSummaryResult,
  ColumnChangeResult,
} from "@datarecce/ui/components/summary";
// Re-export everything from @datarecce/ui summary module
export {
  ChangeSummary,
  calculateChangeSummary,
  calculateColumnChange,
  getIconForChangeStatus,
  NODE_CHANGE_STATUS_MSGS,
} from "@datarecce/ui/components/summary";
