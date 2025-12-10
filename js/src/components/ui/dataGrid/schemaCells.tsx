/**
 * @file schemaCells.tsx
 * @description Cell components and render functions for Schema grid views
 */

import React from "react";
import { RenderCellProps } from "react-data-grid";
import { ColumnNameCell } from "@/components/schema/ColumnNameCell";
import { NodeData } from "@/lib/api/info";
import type {
  SchemaDiffRow,
  SchemaRow,
} from "@/lib/dataGrid/generators/toSchemaDataGrid";

// ============================================================================
// Render Functions for toSchemaDataGrid.ts
// ============================================================================

/**
 * Creates a renderCell function for schema diff column names
 */
export function createColumnNameRenderer(
  node: NodeData,
  cllRunningMap?: Map<string, boolean>,
  showMenu?: boolean,
): (props: RenderCellProps<SchemaDiffRow>) => React.ReactNode {
  return ({ row }) => (
    <ColumnNameCell
      model={node}
      row={row}
      cllRunning={cllRunningMap?.get(row.name) ?? false}
      showMenu={showMenu}
    />
  );
}

/**
 * Creates a renderCell function for single-env schema column names
 */
export function createSingleEnvColumnNameRenderer(
  node: NodeData,
  cllRunningMap?: Map<string, boolean>,
  showMenu?: boolean,
): (props: RenderCellProps<SchemaRow>) => React.ReactNode {
  return ({ row }) => (
    <ColumnNameCell
      model={node}
      row={row}
      cllRunning={cllRunningMap?.get(row.name) ?? false}
      singleEnv
      showMenu={showMenu}
    />
  );
}
