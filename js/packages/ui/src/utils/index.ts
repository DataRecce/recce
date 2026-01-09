/**
 * @file utils/index.ts
 * @description Utility functions for data manipulation and formatting
 */

// CSV utilities
export {
  type CSVData,
  type CSVExportOptions,
  extractCSVData,
  generateCSVFilename,
  generateTimestamp,
  supportsCSVExport,
  toCSV,
} from "./csv";

export { deltaPercentageString } from "./delta";
export { formatSelectColumns } from "./formatSelect";
export {
  formatDuration,
  type TimeFormatStyle,
} from "./formatTime";
export {
  formatAsAbbreviatedNumber,
  formatIntervalMinMax,
  formatNumber,
} from "./formatters";
export { type MergeStatus, mergeKeys, mergeKeysWithStatus } from "./mergeKeys";
export { isSchemaChanged } from "./schemaDiff";
export {
  dataFrameToRowObjects,
  getCaseInsensitive,
  getValueAtPath,
  hashStringToNumber,
  keyToNumber,
} from "./transforms";

// DataGrid utilities
export {
  // Validation
  DataGridValidationError,
  validateColumnDataAlignment,
  validateColumns,
  validateDataFrame,
  validatePrimaryKeyConfig,
  validateToDataDiffGridInputs,
  validateToDataGridInputs,
  validateToValueDiffGridInputs,
  // Grid utilities
  type ColumnMapEntry,
  type MergeColumnMapEntry,
  type RowStats,
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
  // Column builders
  type ColumnConfig,
  type ColumnOrderConfig,
  type GridColumnsConfig,
  buildColumnOrder,
  getDisplayColumns,
  getSimpleDisplayColumns,
  isExcludedColumn,
  isPinnedColumn,
  isPrimaryKeyColumn,
  shouldIncludeColumn,
  // Row builders
  type BuildDiffRowsConfig,
  type BuildDiffRowsResult,
  type DiffColumnMapEntry,
  buildDiffRows,
  // Row count utilities
  type RowCountDiffRowData,
  type RowCountRowData,
  calculateDelta,
  getRowCountDiffStatus,
  rowCountDiffResultToDataFrame,
  rowCountResultToDataFrame,
} from "./dataGrid";
