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
// Diff column definitions (high-level, with JSX)
export {
  type BuildDiffColumnDefinitionsConfig,
  type BuildDiffColumnDefinitionsResult,
  buildDiffColumnDefinitions,
  type DiffColumnDefinition,
} from "./diffColumnBuilder";
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
  formatSmartDecimal,
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
export {
  type BuildDiffRowsConfig,
  type BuildDiffRowsResult,
  buildDiffRows,
  type DiffColumnMapEntry,
} from "./rowBuilders";
export {
  type BuildSimpleColumnDefinitionsConfig,
  type BuildSimpleColumnDefinitionsResult,
  buildSimpleColumnDefinitions,
  type SimpleColumnDefinition,
} from "./simpleColumnBuilder";
// Diff column builder (low-level)
export {
  createCellClassBase,
  createCellClassCurrent,
  type DiffColumnConfig,
  type DiffColumnResult,
  toDiffColumn,
} from "./toDiffColumn";
export {
  DataGridValidationError,
  validateColumnDataAlignment,
  validateColumns,
  validateDataFrame,
  validatePrimaryKeyConfig,
  validateToDataDiffGridInputs,
  validateToDataGridInputs,
  validateToValueDiffGridInputs,
} from "./validation";
