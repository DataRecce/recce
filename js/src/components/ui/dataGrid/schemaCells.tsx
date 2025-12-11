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

// ============================================================================
// Merged Column Render Functions for Compressed Schema View
// ============================================================================

/**
 * Renders the merged index column.
 * Shows currentIndex for normal/added rows, baseIndex for removed rows.
 */
export function renderIndexCell({
  row,
}: RenderCellProps<SchemaDiffRow>): React.ReactNode {
  const { baseIndex, currentIndex } = row;
  const isRemoved = currentIndex === undefined;
  return <span>{isRemoved ? baseIndex : currentIndex}</span>;
}

/**
 * Renders the merged type column with badges for type changes.
 * - Type changed: shows red badge (base) + green badge (current) inline
 * - Added row: shows currentType
 * - Removed row: shows baseType
 * - No change: shows currentType (same as baseType)
 */
export function renderTypeCell({
  row,
}: RenderCellProps<SchemaDiffRow>): React.ReactNode {
  const { baseType, currentType, baseIndex, currentIndex } = row;
  const isAdded = baseIndex === undefined;
  const isRemoved = currentIndex === undefined;
  const isTypeChanged = !isAdded && !isRemoved && baseType !== currentType;

  if (isTypeChanged) {
    return (
      <span>
        <span
          className="type-badge type-badge-removed"
          aria-label={`Base type: ${baseType}`}
        >
          {baseType}
        </span>
        <span
          className="type-badge type-badge-added"
          aria-label={`Current type: ${currentType}`}
        >
          {currentType}
        </span>
      </span>
    );
  }

  // For added rows, show currentType; for removed rows, show baseType
  return <span>{isRemoved ? baseType : currentType}</span>;
}
