/**
 * @file RowCountDiffResultView.tsx
 * @description OSS wrapper for Row Count result view components
 *
 * This file re-exports the framework-agnostic components from @datarecce/ui.
 * The actual implementation lives in @datarecce/ui for use by both
 * Recce OSS and Recce Cloud.
 */

// Re-export components from @datarecce/ui
export {
  RowCountDiffResultView,
  type RowCountDiffRun,
  RowCountResultView,
  type RowCountResultViewProps,
  type RowCountRun,
} from "@datarecce/ui/components/rowcount";
