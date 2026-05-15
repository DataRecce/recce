"use client";

/**
 * @file schemaCells.tsx
 * @description Cell components and render functions for Schema grid views
 */

import type { ICellRendererParams } from "ag-grid-community";
import type React from "react";
import type { NodeData, RowObjectType } from "../../../api";
import type { ColumnDistribution } from "../../../hooks/useInlineProfile";
import {
  PairedHistogramContinuousCell,
  PairedHistogramDiscreteCell,
} from "../../data";
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

/**
 * Render the per-column paired-histogram cell. Picks discrete or continuous
 * by `kind`; renders nothing when no distribution is available (e.g. text
 * columns without an enumerable name, or columns we haven't profiled).
 */
function ProfileDistributionCell({
  distribution,
}: {
  distribution: ColumnDistribution;
}) {
  if (distribution.kind === "topk") {
    return (
      <PairedHistogramDiscreteCell
        data={{
          values: distribution.values.map((v) => v ?? "∅"),
          baseCounts: distribution.base_counts,
          currentCounts: distribution.current_counts,
          baseTotal: distribution.base_total,
          currentTotal: distribution.current_total,
        }}
        trimmed={distribution.trimmed}
      />
    );
  }
  return (
    <PairedHistogramContinuousCell
      data={{
        binEdges: distribution.bin_edges,
        baseCounts: distribution.base_counts,
        currentCounts: distribution.current_counts,
        baseTotal: distribution.base_total,
        currentTotal: distribution.current_total,
      }}
    />
  );
}

function DistributionPendingDot() {
  return (
    <span
      className="schema-distribution-pending"
      role="img"
      aria-label="Loading distribution"
      data-testid="distribution-pending"
    />
  );
}

/**
 * Creates a cellRenderer function for the inline-profile "distribution" column.
 * Distributions are passed in as a Map keyed by lower-cased column name —
 * the SchemaDiffRow index signature only permits primitive fields, so the
 * polymorphic distribution object cannot live on the row itself. The
 * pending Set carries column names whose fetch is in flight; those render
 * a small spinner instead of an empty slot.
 */
export function createProfileDistributionRenderer(
  distributionByName: Map<string, ColumnDistribution>,
  pendingColumns: Set<string>,
): (params: ICellRendererParams<SchemaDiffRow>) => React.ReactNode {
  return (params) => {
    const row = params.data;
    if (!row) return null;
    const key = row.name.toLowerCase();
    const dist = distributionByName.get(key);
    if (dist) {
      return <ProfileDistributionCell distribution={dist} />;
    }
    if (pendingColumns.has(key)) {
      return <DistributionPendingDot />;
    }
    return null;
  };
}
