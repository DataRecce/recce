"use client";

/**
 * @file schemaCells.tsx
 * @description Cell components and render functions for Schema grid views
 */

import type { ICellRendererParams } from "ag-grid-community";
import React from "react";
import type {
  NodeData,
  ProfileDistributionColumnPayload,
  RowObjectType,
} from "../../../api";
import { InlineProfileDistributionCell } from "../../data/InlineProfileDistributionCell";
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
        isImpacted={row.isImpacted}
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

/**
 * Per-task distribution data threaded into the schema grid (DRC-3390 Stage C).
 * Holds the resolved per-column payloads plus the run-level loading/error
 * flags so the Distribution column's renderer can pick the right cell state.
 */
export interface SchemaDistributionData {
  /** Per-column payloads keyed by column name. */
  payloads: Record<string, ProfileDistributionColumnPayload>;
  /** Envelope-level totals — denominator for counts-mode proportions. */
  baseTotal: number;
  currentTotal: number;
  /** True while the run is in flight (cells show a pending dot). */
  isLoading: boolean;
  /** True when the run failed at the task level (not per-column). */
  hasError: boolean;
  /**
   * Column names the run actually requested. `undefined` means every column was
   * profiled (whole-model change or "Profile all columns"). Columns outside this
   * set were never part of the run, so the run-level pending/error state must not
   * bleed onto them — they stay blank.
   */
  scopedColumns?: string[];
}

/**
 * Creates a cellRenderer for the inline paired-distribution column. Looks up
 * the row's payload by column name and delegates state selection to
 * {@link InlineProfileDistributionCell}. While the run is loading, columns
 * with no payload yet show the pending dot.
 */
export function createDistributionCellRenderer(
  distribution: SchemaDistributionData,
): (params: ICellRendererParams<SchemaDiffRow>) => React.ReactNode {
  // A scoped run only requested a subset of columns; the run-level pending/error
  // state belongs only to those. `undefined` means the run covered every column.
  const scoped = distribution.scopedColumns
    ? new Set(distribution.scopedColumns)
    : undefined;
  return (params) => {
    const row = params.data;
    if (!row) return null;
    const payload = distribution.payloads[row.name];
    const inScope = !scoped || scoped.has(row.name);
    return (
      <InlineProfileDistributionCell
        payload={payload}
        columnType={row.currentType ?? row.baseType}
        baseTotal={distribution.baseTotal}
        currentTotal={distribution.currentTotal}
        isLoading={distribution.isLoading && !payload && inScope}
        hasError={distribution.hasError && inScope}
        notProfiled={!inScope}
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

  const value = isRemoved ? (baseIndex ?? "-") : (currentIndex ?? "-");
  return <span>{value}</span>;
}
