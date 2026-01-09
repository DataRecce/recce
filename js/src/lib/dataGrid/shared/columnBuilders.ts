/**
 * @file columnBuilders.ts
 * @description OSS re-exports for column builder utilities
 *
 * This file re-exports column builders from @datarecce/ui for backward compatibility.
 * New code should import directly from @datarecce/ui/utils.
 */

// Re-export everything from @datarecce/ui
export type {
  ColumnConfig,
  ColumnOrderConfig,
  GridColumnsConfig,
} from "@datarecce/ui/utils";

export {
  buildColumnOrder,
  getDisplayColumns,
  getSimpleDisplayColumns,
  isExcludedColumn,
  isPinnedColumn,
  isPrimaryKeyColumn,
  shouldIncludeColumn,
} from "@datarecce/ui/utils";
