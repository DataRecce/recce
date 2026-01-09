/**
 * @file utils/dataGrid/index.ts
 * @description Data grid utilities for building AG Grid configurations
 *
 * This module provides pure TypeScript utilities for:
 * - Input validation with clear error messages
 * - Column map building for different data sources
 * - Row building and diff detection
 * - Cell rendering utilities
 * - Row count calculations
 */

// Validation utilities
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

// Grid utilities
export type {
  ColumnMapEntry,
  MergeColumnMapEntry,
  RowStats,
} from "./gridUtils";
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
} from "./gridUtils";

// Column builders
export type {
  ColumnConfig,
  ColumnOrderConfig,
  GridColumnsConfig,
} from "./columnBuilders";
export {
  buildColumnOrder,
  getDisplayColumns,
  getSimpleDisplayColumns,
  isExcludedColumn,
  isPinnedColumn,
  isPrimaryKeyColumn,
  shouldIncludeColumn,
} from "./columnBuilders";

// Row builders
export type {
  BuildDiffRowsConfig,
  BuildDiffRowsResult,
  DiffColumnMapEntry,
} from "./rowBuilders";
export { buildDiffRows } from "./rowBuilders";

// Row count utilities
export type {
  RowCountDiffRowData,
  RowCountRowData,
} from "./rowCountUtils";
export {
  calculateDelta,
  getRowCountDiffStatus,
  rowCountDiffResultToDataFrame,
  rowCountResultToDataFrame,
} from "./rowCountUtils";

// Render types (for column builder dependency injection)
export type {
  CellRendererFunction,
  ColumnRenderComponents,
  DataFrameColumnGroupHeaderProps,
  DataFrameColumnHeaderProps,
  DiffColumnRenderComponents,
  SimpleColumnRenderComponents,
} from "./renderTypes";

// Diff column builder (React component builder)
export type {
  BuildDiffColumnDefinitionsConfig,
  BuildDiffColumnDefinitionsResult,
  DiffColumnDefinition,
} from "./diffColumnBuilder";
export { buildDiffColumnDefinitions } from "./diffColumnBuilder";

// Simple column builder (React component builder)
export type {
  BuildSimpleColumnDefinitionsConfig,
  BuildSimpleColumnDefinitionsResult,
  SimpleColumnDefinition,
} from "./simpleColumnBuilder";
export { buildSimpleColumnDefinitions } from "./simpleColumnBuilder";

// toDiffColumn (shared diff column builder)
export type {
  DiffColumnConfig,
  DiffColumnResult,
  RecceColumnContext,
} from "./toDiffColumn";
export {
  createCellClassBase,
  createCellClassCurrent,
  toDiffColumn,
} from "./toDiffColumn";
