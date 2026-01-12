// js/src/lib/dataGrid/index.ts

// Value diff summary grid (column-level match statistics)
export {
  toValueDataGrid,
  type ValueDataGridOptions,
  type ValueDataGridResult,
} from "@datarecce/ui/components/ui/dataGrid";
// Row count utilities - exported directly from @datarecce/ui
export {
  calculateDelta,
  getRowCountDiffStatus,
  type RowCountDataGridResult,
  type RowCountDiffDataGridResult,
  type RowCountDiffRowData,
  type RowCountRowData,
  rowCountDiffResultToDataFrame,
  rowCountResultToDataFrame,
  toRowCountDataGrid,
  toRowCountDiffDataGrid,
} from "@datarecce/ui/utils";
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
// Schema grid types
export type {
  SchemaDataGridOptions,
  SchemaDataGridResult,
  SchemaDiffRow,
  SchemaRow,
  SingleEnvSchemaDataGridResult,
} from "./generators/toSchemaDataGrid";
