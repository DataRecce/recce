/**
 * @file valueDiffCells.tsx
 * @description Re-exports from @datarecce/ui for Value Diff summary grid cells
 *
 * This file re-exports cell components and render functions from @datarecce/ui
 * for backward compatibility with existing OSS imports.
 */

export type {
  MatchedPercentCellProps,
  PrimaryKeyIndicatorCellProps,
  ValueDiffColumnNameCellProps,
} from "@datarecce/ui/components/ui/dataGrid";
// Re-export all components and types from @datarecce/ui
export {
  createColumnNameRenderer,
  createPrimaryKeyIndicatorRenderer,
  MatchedPercentCell,
  PrimaryKeyIndicatorCell,
  renderMatchedPercentCell,
  ValueDiffColumnNameCell,
} from "@datarecce/ui/components/ui/dataGrid";
