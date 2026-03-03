/**
 * @file lib/index.ts
 * @description Library utilities for @datarecce/ui
 */

// DataGrid types
export type {
  SchemaDataGridOptions,
  SchemaDataGridResult,
  SchemaDiffRow,
  SchemaRow,
  SingleEnvSchemaDataGridResult,
} from "./dataGrid";
// DataGrid utilities and generators
export {
  mergeColumns,
  toSchemaDataGrid,
  toSingleEnvDataGrid,
} from "./dataGrid";
