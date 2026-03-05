"use client";

/**
 * @file schemaCells.tsx
 * @description Cell components and render functions for Schema grid views
 */

import type { ICellRendererParams } from "ag-grid-community";
import React from "react";
import type { NodeData, RowObjectType } from "../../../api";
import type { SchemaDiffRow, SchemaRow } from "../../schema";
import { ColumnNameCell } from "../../schema/ColumnNameCell";

// ============================================================================
// Render Functions for toSchemaDataGrid.ts
// ============================================================================

/**
 * Creates a cellRenderer function for schema diff column names
 */
export function createSchemaColumnNameRenderer(
  node: NodeData,
  cllRunningMap?: Map<string, boolean>,
  showMenu?: boolean,
  onViewCode?: () => void,
): (params: ICellRendererParams<SchemaDiffRow>) => React.ReactNode {
  return (params) => {
    const row = params.data;
    if (!row) return null;
    return (
      <ColumnNameCell
        model={node}
        row={row}
        cllRunning={cllRunningMap?.get(row.name) ?? false}
        showMenu={showMenu}
        onViewCode={onViewCode}
      />
    );
  };
}

/**
 * Creates a cellRenderer function for single-env schema column names
 */
export function createSingleEnvColumnNameRenderer(
  node: NodeData,
  cllRunningMap?: Map<string, boolean>,
  showMenu?: boolean,
): (params: ICellRendererParams<SchemaRow>) => React.ReactNode {
  return (params) => {
    const row = params.data;
    if (!row) return null;
    return (
      <ColumnNameCell
        model={node}
        row={row}
        cllRunning={cllRunningMap?.get(row.name) ?? false}
        singleEnv
        showMenu={showMenu}
      />
    );
  };
}

// ============================================================================
// Merged Column Render Functions for Compressed Schema View
// ============================================================================

/**
 * Renders the merged index column.
 * Shows currentIndex for normal/added rows, baseIndex for removed rows.
 * For reordered rows, shows strikethrough old → bold new.
 */
export function renderIndexCell(
  params: ICellRendererParams<RowObjectType>,
): React.ReactNode {
  if (!params.data) {
    return null;
  }
  const row = params.data;

  const { baseIndex, currentIndex, reordered } = row;
  const isRemoved = currentIndex === undefined;
  const isAdded = baseIndex === undefined;

  if (
    reordered &&
    baseIndex !== undefined &&
    currentIndex !== undefined &&
    baseIndex !== currentIndex
  ) {
    return (
      <span>
        <span className="schema-index-old">{baseIndex}</span>
        <span className="schema-index-new">{currentIndex}</span>
      </span>
    );
  }

  const value = isRemoved
    ? baseIndex !== undefined
      ? baseIndex
      : "-"
    : isAdded
      ? currentIndex !== undefined
        ? currentIndex
        : "-"
      : (currentIndex ?? "-");
  return <span>{value}</span>;
}

// Memoized version for performance optimization
export const MemoizedRenderIndexCell = React.memo(renderIndexCell);
MemoizedRenderIndexCell.displayName = "MemoizedRenderIndexCell";

/**
 * Renders the merged type column with strikethrough/bold for type changes.
 * - Type changed: strikethrough old → bold new
 * - Added row: shows currentType
 * - Removed row: shows baseType
 * - No change: shows currentType (same as baseType)
 */
export function renderTypeCell(
  params: ICellRendererParams<RowObjectType>,
): React.ReactNode {
  if (!params.data) {
    return null;
  }
  const row = params.data;

  const { baseType, currentType, baseIndex, currentIndex } = row;
  const isAdded = baseIndex === undefined;
  const isRemoved = currentIndex === undefined;
  const isTypeChanged = !isAdded && !isRemoved && baseType !== currentType;

  if (isTypeChanged) {
    return (
      <span>
        <span className="schema-type-old" title={`Base type: ${baseType}`}>
          {baseType}
        </span>
        {" → "}
        <span
          className="schema-type-new"
          title={`Current type: ${currentType}`}
        >
          {currentType}
        </span>
      </span>
    );
  }

  // For added rows, show currentType; for removed rows, show baseType
  return <span>{isRemoved ? baseType : currentType}</span>;
}

// Memoized version for performance optimization
export const MemoizedRenderTypeCell = React.memo(renderTypeCell);
MemoizedRenderTypeCell.displayName = "MemoizedRenderTypeCell";
