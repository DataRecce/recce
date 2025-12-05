/**
 * @file shared/index.ts
 * @description Exports for shared data grid utilities
 */

// Column builders
export {
  // Functions
  buildColumnOrder,
  // Types
  type ColumnConfig,
  type ColumnOrderConfig,
  type GridColumnsConfig,
  getDisplayColumns,
  getSimpleDisplayColumns,
  isExcludedColumn,
  isPinnedColumn,
  isPrimaryKeyColumn,
  shouldIncludeColumn,
} from "./columnBuilders";
// Grid utilities
export {
  // Column map builders
  buildColumnMap,
  buildJoinedColumnMap,
  buildMergedColumnMap,
  // Types
  type ColumnMapEntry,
  // Value rendering
  columnRenderedValue,
  // Row status
  determineRowStatus,
  // Cell class utilities
  getCellClass,
  getHeaderCellClass,
  getPrimaryKeyValue,
  // Types
  type MergeColumnMapEntry,
  type RowStats,
  toRenderedValue,
  // Primary key utilities
  validatePrimaryKeys,
} from "./gridUtils";
