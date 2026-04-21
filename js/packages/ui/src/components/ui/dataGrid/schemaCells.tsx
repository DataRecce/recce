"use client";

/**
 * @file schemaCells.tsx
 * @description Cell components and render functions for Schema grid views
 */

import Tooltip from "@mui/material/Tooltip";
import type { ICellRendererParams } from "ag-grid-community";
import type React from "react";
import type { NodeData, RowObjectType } from "../../../api";
import type { SchemaDiffRow, SchemaRow } from "../../schema";
import { ColumnNameCell } from "../../schema/ColumnNameCell";
import { formatProfileValue, toNumeric } from "../../schema/profileFormat";

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

// ============================================================================
// Profile Strip Renderer (strip render mode)
// ============================================================================

const STRIP_STATS = [
  { field: "not_null_proportion", label: "null%", pct: true },
  { field: "min", label: "min", pct: false },
  { field: "max", label: "max", pct: false },
  { field: "avg", label: "avg", pct: false },
  { field: "is_unique", label: "unique", pct: false },
] as const;

type StripState = "changed" | "same" | "empty";

const absent = (v: unknown) => v === undefined || v === null;

function statState(row: SchemaDiffRow, field: string): StripState {
  const rec = row as unknown as Record<string, unknown>;
  const b = rec[`base__${field}`];
  const c = rec[`current__${field}`];
  if (absent(b) && absent(c)) return "empty";
  if (absent(b) || absent(c)) return "changed";
  // Compare numerically when both are numeric strings — avoids false diffs
  // from inconsistent trailing zeros like "69.370000" vs "69.37".
  const bn = toNumeric(b);
  const cn = toNumeric(c);
  if (bn !== null && cn !== null) return bn === cn ? "same" : "changed";
  return b === c ? "same" : "changed";
}

function ProfileStripCard({ row }: { row: SchemaDiffRow }) {
  const rec = row as unknown as Record<string, unknown>;
  const renderValue = (field: string, pct: boolean): React.ReactNode => {
    const b = rec[`base__${field}`];
    const c = rec[`current__${field}`];
    if (absent(b) && absent(c)) return "—";
    if (absent(b)) return formatProfileValue(c, pct);
    if (absent(c)) return formatProfileValue(b, pct);
    const bn = toNumeric(b);
    const cn = toNumeric(c);
    if (bn !== null && cn !== null && bn === cn) {
      return formatProfileValue(c, pct);
    }
    if (!bn && !cn && b === c) return formatProfileValue(c, pct);
    return (
      <>
        <span className="schema-profile-hover-card-base">
          {formatProfileValue(b, pct)}
        </span>
        <span className="schema-profile-hover-card-arrow">→</span>
        <span>{formatProfileValue(c, pct)}</span>
      </>
    );
  };
  return (
    <div className="schema-profile-hover-card">
      <div className="schema-profile-hover-card-head">
        <span className="schema-profile-hover-card-name">{row.name}</span>
      </div>
      <div className="schema-profile-hover-card-stats">
        {STRIP_STATS.map(({ field, label, pct }) => {
          const state = statState(row, field);
          return (
            <div
              key={field}
              className="schema-profile-hover-card-stat"
              data-state={state}
            >
              <span className="schema-profile-hover-card-stat-lbl">
                {label}
              </span>
              <span className="schema-profile-hover-card-stat-val">
                {renderValue(field, pct)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileStripCell({ row }: { row: SchemaDiffRow }) {
  return (
    <Tooltip
      title={<ProfileStripCard row={row} />}
      arrow
      placement="right"
      enterDelay={150}
      leaveDelay={50}
      slotProps={{
        tooltip: { className: "schema-profile-hover-tooltip" },
      }}
    >
      <span
        className="schema-profile-strip"
        data-testid="strip-button"
        aria-label={`Profile for ${row.name}`}
      >
        {STRIP_STATS.map(({ field, label }) => {
          const state = statState(row, field);
          return (
            <span
              key={field}
              data-testid="strip-square"
              data-state={state}
              className={`schema-profile-strip-square schema-profile-strip-square-${state}`}
              aria-label={label}
            />
          );
        })}
      </span>
    </Tooltip>
  );
}

/**
 * Creates a cellRenderer function for the inline-profile "strip" column.
 * Each cell renders 5 tiny squares (one per stat) + popover with details.
 */
export function createProfileStripRenderer(): (
  params: ICellRendererParams<SchemaDiffRow>,
) => React.ReactNode {
  return (params) => {
    const row = params.data;
    if (!row) return null;
    return <ProfileStripCell row={row} />;
  };
}
