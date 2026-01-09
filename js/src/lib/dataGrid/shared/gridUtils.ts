/**
 * @file gridUtils.ts
 * @description OSS re-exports for grid utilities
 *
 * This file re-exports grid utilities from @datarecce/ui for backward compatibility.
 * New code should import directly from @datarecce/ui/utils.
 */

// Re-export everything from @datarecce/ui
export type {
  ColumnMapEntry,
  MergeColumnMapEntry,
  RowStats,
} from "@datarecce/ui/utils";

export {
  buildColumnMap,
  buildJoinedColumnMap,
  buildMergedColumnMap,
  columnRenderedValue,
  determineRowStatus,
  formatSmartDecimal,
  getCellClass,
  getHeaderCellClass,
  getPrimaryKeyValue,
  toRenderedValue,
  validatePrimaryKeys,
} from "@datarecce/ui/utils";
