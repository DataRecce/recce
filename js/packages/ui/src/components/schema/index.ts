"use client";

// Schema primitives - pure presentation components for database schema display

// ColumnNameCell - cell renderer for column names with diff action menu
export { ColumnNameCell, type ColumnNameCellProps } from "./ColumnNameCell";
// SchemaDiff - diff view for comparing schemas between environments
export {
  mergeSchemaColumns,
  SchemaDiff,
  type SchemaDiffHandle,
  type SchemaDiffProps,
  type SchemaDiffRow,
  type SchemaDiffStatus,
} from "./SchemaDiff";
// SchemaTable - table view for displaying a single schema
export {
  type SchemaColumnData,
  type SchemaRow,
  SchemaTable,
  type SchemaTableHandle,
  type SchemaTableProps,
} from "./SchemaTable";
export { SchemaView, SingleEnvSchemaView } from "./SchemaView";
