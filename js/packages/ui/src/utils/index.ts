/**
 * @file utils/index.ts
 * @description Utility functions for data manipulation and formatting
 */

// CSV utilities
export {
  type CSVData,
  type CSVExportOptions,
  copyToClipboard,
  downloadCSV,
  downloadExcel,
  downloadTSV,
  extractCSVData,
  generateCSVFilename,
  generateTimestamp,
  supportsCSVExport,
  toCSV,
  toExcelBlob,
  toTSV,
} from "./csv";
// Grid generators
export type {
  DataDiffGridResult,
  DataGridResult,
  QueryDataDiffGridOptions,
  QueryDataGridOptions,
  RowCountDataGridResult,
  RowCountDiffDataGridResult,
  ToDataDiffGridConfig,
  ToDataGridConfig,
  ToValueDiffGridConfig,
  ValueDiffGridResult,
} from "./dataGrid";
// DataGrid utilities
export {
  // Diff column builder (React component builder)
  type BuildDiffColumnDefinitionsConfig,
  // Pre-configured exports (with default render components)
  type BuildDiffColumnDefinitionsConfigConfigured,
  type BuildDiffColumnDefinitionsResult,
  // Row builders
  type BuildDiffRowsConfig,
  type BuildDiffRowsResult,
  // Simple column builder (React component builder)
  type BuildSimpleColumnDefinitionsConfig,
  type BuildSimpleColumnDefinitionsConfigConfigured,
  type BuildSimpleColumnDefinitionsResult,
  buildColumnMap,
  buildColumnOrder,
  buildDiffColumnDefinitions,
  buildDiffColumnDefinitionsConfigured,
  buildDiffRows,
  buildJoinedColumnMap,
  buildMergedColumnMap,
  buildSimpleColumnDefinitions,
  buildSimpleColumnDefinitionsConfigured,
  // Render types (for column builder dependency injection)
  type CellRendererFunction,
  // Column builders (pure data)
  type ColumnConfig,
  // Grid utilities
  type ColumnMapEntry,
  type ColumnOrderConfig,
  // Column precision options
  type ColumnPrecisionOption,
  type ColumnRenderComponents,
  calculateDelta,
  columnPrecisionSelectOptions,
  columnRenderedValue,
  createCellClassBase,
  createCellClassCurrent,
  type DataFrameColumnGroupHeaderProps,
  type DataFrameColumnHeaderProps,
  // Validation
  DataGridValidationError,
  // toDiffColumn (shared diff column builder)
  type DiffColumnConfig,
  type DiffColumnConfigConfigured,
  type DiffColumnDefinition,
  type DiffColumnMapEntry,
  type DiffColumnRenderComponents,
  type DiffColumnResult,
  defaultRenderComponents,
  defaultSimpleRenderComponents,
  determineRowStatus,
  formatSmartDecimal,
  type GridColumnsConfig,
  getCellClass,
  getDisplayColumns,
  getHeaderCellClass,
  getPrimaryKeyValue,
  getRowCountDiffStatus,
  getSimpleDisplayColumns,
  isExcludedColumn,
  isPinnedColumn,
  isPrimaryKeyColumn,
  type MergeColumnMapEntry,
  type RecceColumnContext,
  // Row count utilities
  type RowCountDiffRowData,
  type RowCountRowData,
  type RowStats,
  rowCountDiffResultToDataFrame,
  rowCountResultToDataFrame,
  type SimpleColumnDefinition,
  type SimpleColumnRenderComponents,
  shouldIncludeColumn,
  toDataDiffGrid,
  toDataDiffGridConfigured,
  toDataGrid,
  toDataGridConfigured,
  toDiffColumn,
  toDiffColumnConfigured,
  toRenderedValue,
  toRowCountDataGrid,
  toRowCountDiffDataGrid,
  toValueDiffGrid,
  toValueDiffGridConfigured,
  validateColumnDataAlignment,
  validateColumns,
  validateDataFrame,
  validatePrimaryKeyConfig,
  validatePrimaryKeys,
  validateToDataDiffGridInputs,
  validateToDataGridInputs,
  validateToValueDiffGridInputs,
} from "./dataGrid";
export { deltaPercentageString } from "./delta";
export { extractSchemas } from "./envUtils";
export { formatSelectColumns } from "./formatSelect";
export {
  formatDuration,
  formatTimestamp,
  formatTimeToNow,
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
export { getSettingsUrl } from "./urls";
