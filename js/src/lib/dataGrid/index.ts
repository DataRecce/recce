// js/src/lib/dataGrid/index.ts

// Value diff summary grid (column-level match statistics)
export {
  toValueDataGrid,
  type ValueDataGridOptions,
  type ValueDataGridResult,
} from "src/lib/dataGrid/generators/toValueDataGrid";
export type {
  BaseGridOptions,
  DataGridFromDataResult,
  DataGridInput,
  DataGridResult,
  DiffGridOptions,
} from "./dataGridFactory";
export {
  createDataGrid,
  createDataGridFromData,
  mergeColumns,
  toDataDiffGrid,
  toDataGrid,
  toSchemaDataGrid,
  toSingleEnvDataGrid,
  toValueDiffGrid,
} from "./dataGridFactory";
// Row count utilities
export {
  calculateDelta,
  getRowCountDiffStatus,
  type RowCountDiffRowData,
  type RowCountRowData,
  rowCountDiffResultToDataFrame,
  rowCountResultToDataFrame,
} from "./generators/rowCountUtils";
export {
  type RowCountDataGridResult,
  toRowCountDataGrid,
} from "./generators/toRowCountDataGrid";

export {
  type RowCountDiffDataGridResult,
  toRowCountDiffDataGrid,
} from "./generators/toRowCountDiffDataGrid";
// Schema grid types
export type {
  SchemaDataGridOptions,
  SchemaDataGridResult,
  SchemaDiffRow,
  SchemaRow,
  SingleEnvSchemaDataGridResult,
} from "./generators/toSchemaDataGrid";
