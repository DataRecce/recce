/**
 * @file HistogramDiffResultView.tsx
 * @description OSS wrapper for Histogram result view components
 *
 * This file re-exports the framework-agnostic components from @datarecce/ui.
 * The actual implementation lives in @datarecce/ui for use by both
 * Recce OSS and Recce Cloud.
 */

// Re-export components from @datarecce/ui
export {
  HistogramDiffResultView,
  type HistogramDiffRun,
  type HistogramResultViewProps,
} from "@datarecce/ui/components/histogram";
