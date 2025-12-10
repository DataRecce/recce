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
// Schema grid types
export type {
  SchemaDataGridOptions,
  SchemaDataGridResult,
  SchemaDiffRow,
  SchemaRow,
  SingleEnvSchemaDataGridResult,
} from "./generators/toSchemaDataGrid";
