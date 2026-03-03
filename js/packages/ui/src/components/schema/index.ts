"use client";

// Schema primitives - pure presentation components for database schema display

// Re-export types from lib/dataGrid for component usage
export type { SchemaRow } from "../../lib/dataGrid/generators/toSchemaDataGrid";
// ColumnNameCell - cell renderer for column names with diff action menu
export { ColumnNameCell, type ColumnNameCellProps } from "./ColumnNameCell";
export { SchemaView, SingleEnvSchemaView } from "./SchemaView";
// Schema diff types
export type { SchemaDiffRow, SchemaDiffStatus } from "./types";
