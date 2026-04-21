"use client";

// Schema primitives - pure presentation components for database schema display

// Re-export types from lib/dataGrid for component usage
export type { SchemaRow } from "../../lib/dataGrid/generators/toSchemaDataGrid";
// ColumnNameCell - cell renderer for column names with diff action menu
export { ColumnNameCell, type ColumnNameCellProps } from "./ColumnNameCell";
export { SchemaLegend, SchemaView, SingleEnvSchemaView } from "./SchemaView";
export { ProfileModeToggle, type ProfileModeToggleProps } from "./ProfileModeToggle";
// Schema diff types
export type { SchemaDiffRow, SchemaDiffStatus } from "./types";
