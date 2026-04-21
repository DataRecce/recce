"use client";

/**
 * @file schemaCells.tsx
 * @description Cell components and render functions for Schema grid views
 */

import type { ICellRendererParams } from "ag-grid-community";
import MuiPopover from "@mui/material/Popover";
import React, { useState } from "react";
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
  { field: "not_null_proportion", label: "null%" },
  { field: "min", label: "min" },
  { field: "max", label: "max" },
  { field: "avg", label: "avg" },
  { field: "is_unique", label: "unique" },
] as const;

type StripState = "changed" | "same" | "empty";

function statState(row: SchemaDiffRow, field: string): StripState {
  const rec = row as unknown as Record<string, unknown>;
  const b = rec[`base__${field}`];
  const c = rec[`current__${field}`];
  if (b === undefined && c === undefined) return "empty";
  if (b === undefined || c === undefined) return "changed";
  return b === c ? "same" : "changed";
}

function formatStat(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") {
    // percentages are stored as 0..1
    if (Math.abs(v) < 1 && !Number.isInteger(v)) return v.toFixed(3);
    return String(v);
  }
  return String(v);
}

function ProfileStripCell({ row }: { row: SchemaDiffRow }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) =>
    setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  return (
    <>
      <button
        type="button"
        className="schema-profile-strip"
        data-testid="strip-button"
        onClick={handleOpen}
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
              title={label}
            />
          );
        })}
      </button>
      <MuiPopover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <div className="schema-profile-strip-popover">
          <div className="schema-profile-strip-popover-title">{row.name}</div>
          <table>
            <tbody>
              {STRIP_STATS.map(({ field, label }) => {
                const rec = row as unknown as Record<string, unknown>;
                const b = rec[`base__${field}`];
                const c = rec[`current__${field}`];
                const state = statState(row, field);
                return (
                  <tr key={field} data-state={state}>
                    <td className="lbl">{label}</td>
                    <td>{formatStat(b)}</td>
                    <td>→</td>
                    <td>{formatStat(c)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </MuiPopover>
    </>
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
