/**
 * @file types.ts
 * @description Schema diff types for comparing schemas between environments.
 */

/**
 * Schema diff row status
 */
export type SchemaDiffStatus = "added" | "removed" | "modified" | "unchanged";

// Canonical SchemaDiffRow is defined in toSchemaDataGrid.ts
export type { SchemaDiffRow } from "../../lib/dataGrid/generators/toSchemaDataGrid";
