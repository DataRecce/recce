"use client";

import Box from "@mui/material/Box";
import type { ColumnDistribution } from "../../hooks/useInlineProfile";
import type { SchemaDiffRow } from "../../lib/dataGrid/generators/toSchemaDataGrid";
import {
  PairedHistogramContinuousCell,
  PairedHistogramDiscreteCell,
} from "../data";
import { formatProfileValue, toNumeric } from "./profileFormat";

export type CardStatus = "impacted" | "typechg" | "defchg" | "added";

export interface SchemaGalleryViewProps {
  rows: SchemaDiffRow[];
  /** Optional click handler — fires with the column name when a card is clicked */
  onColumnClick?: (columnName: string) => void;
  /**
   * Per-column paired-histogram distribution data, keyed by lower-cased
   * column name. When set, replaces the `unique` quadrant with a chart slot
   * above the remaining min/max/null%.
   */
  distributionByName?: Map<string, ColumnDistribution>;
  /**
   * Lower-cased names of columns whose distribution is in flight. Cards in
   * this set render a spinner in the chart slot until the fetch finishes.
   */
  pendingDistributionColumns?: Set<string>;
}

const STATUS_LABEL: Record<CardStatus, string> = {
  impacted: "impacted",
  typechg: "type",
  defchg: "def",
  added: "added",
};

// 3-quad layout (no `unique`) — leaves card real estate for the paired-
// histogram chart slot above. `unique` was binary anyway, never carried
// much per-column signal next to a chart.
const QUADRANTS = [
  { field: "min", label: "min", pct: false },
  { field: "max", label: "max", pct: false },
  { field: "not_null_proportion", label: "null%", pct: true },
] as const;

function classifyInteresting(row: SchemaDiffRow): CardStatus | null {
  if (row.baseIndex === undefined) return "added";
  if (row.baseType !== undefined && row.baseType !== row.currentType)
    return "typechg";
  if (row.definitionChanged) return "defchg";
  if (row.isImpacted) return "impacted";
  return null;
}

const formatQuadValue = formatProfileValue;

function isQuadChanged(row: SchemaDiffRow, field: string): boolean {
  const rec = row as unknown as Record<string, unknown>;
  const b = rec[`base__${field}`];
  const c = rec[`current__${field}`];
  const absent = (v: unknown) => v === undefined || v === null;
  if (absent(b) && absent(c)) return false;
  if (absent(b) || absent(c)) return true;
  // Compare numerically when both sides parse as numbers — avoids false
  // positives from inconsistent string formatting (e.g. "69.370000" vs "69.37").
  const bn = toNumeric(b);
  const cn = toNumeric(c);
  if (bn !== null && cn !== null) return bn !== cn;
  return b !== c;
}

function CardChart({ distribution }: { distribution: ColumnDistribution }) {
  // Card-density chart sits in a slot ~180×44 inside a 200-300 px card. No
  // labels — at this density the chart signals divergence; the card name +
  // quads do the labelling.
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
        width={180}
        height={44}
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
      width={180}
      height={44}
    />
  );
}

function Card({
  row,
  status,
  onClick,
  distribution,
  pending,
}: {
  row: SchemaDiffRow;
  status: CardStatus;
  onClick?: () => void;
  distribution?: ColumnDistribution;
  pending?: boolean;
}) {
  const rec = row as unknown as Record<string, unknown>;
  const absent = (v: unknown) => v === undefined || v === null;
  const renderQuadValue = (field: string, pct: boolean) => {
    const b = rec[`base__${field}`];
    const c = rec[`current__${field}`];
    // Added cards: no base to show, just render current.
    if (status === "added") return formatQuadValue(c, pct);
    // Both missing: single dash placeholder.
    if (absent(b) && absent(c)) return formatQuadValue(undefined, pct);
    // Only one side present: render whichever exists.
    if (absent(b)) return formatQuadValue(c, pct);
    if (absent(c)) return formatQuadValue(b, pct);
    // Unchanged: one number.
    if (b === c) return formatQuadValue(c, pct);
    // Changed: show both as base → current.
    return (
      <>
        <span className="schema-card-quad-base">{formatQuadValue(b, pct)}</span>
        <span className="schema-card-quad-arrow">→</span>
        <span>{formatQuadValue(c, pct)}</span>
      </>
    );
  };
  const clickable = Boolean(onClick);
  return (
    <div
      className={`schema-card schema-card-${status}${clickable ? " schema-card-clickable" : ""}`}
      data-testid={`card-${row.name}`}
      onClick={onClick}
      onKeyDown={
        clickable && onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="schema-card-head">
        <div className="schema-card-name-row">
          <span className="schema-card-name">{row.name}</span>
          <span className="schema-card-badge">{STATUS_LABEL[status]}</span>
        </div>
        <div className="schema-card-type">
          {status === "typechg" ? (
            <>
              <span className="schema-card-type-from">{row.baseType}</span>
              <span className="schema-card-type-arrow">→</span>
              <span className="schema-card-type-to">{row.currentType}</span>
            </>
          ) : (
            (row.currentType ?? row.baseType ?? "")
          )}
        </div>
      </div>
      {distribution ? (
        <div
          className="schema-card-chart"
          data-testid={`card-chart-${row.name}`}
        >
          <CardChart distribution={distribution} />
        </div>
      ) : pending ? (
        <div
          className="schema-card-chart schema-card-chart-pending"
          data-testid={`card-chart-pending-${row.name}`}
        >
          <span className="schema-distribution-pending" aria-label="Loading distribution" />
        </div>
      ) : null}
      <div className="schema-card-quads">
        {QUADRANTS.map(({ field, label, pct }) => {
          const changed =
            status === "added" ? false : isQuadChanged(row, field);
          return (
            <div
              key={field}
              className="schema-card-quad"
              data-testid={`quad-${field}`}
              data-changed={String(changed)}
            >
              <span className="schema-card-quad-lbl">{label}</span>
              <span className="schema-card-quad-val">
                {renderQuadValue(field, pct)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function extractTotalRows(
  rows: SchemaDiffRow[],
): { base: number | null; current: number | null } {
  let base: number | null = null;
  let current: number | null = null;
  for (const row of rows) {
    const rec = row as unknown as Record<string, unknown>;
    if (base === null) base = toNumeric(rec.base__row_count);
    if (current === null) current = toNumeric(rec.current__row_count);
    if (base !== null && current !== null) break;
  }
  return { base, current };
}

export function SchemaGalleryView({
  rows,
  onColumnClick,
  distributionByName,
  pendingDistributionColumns,
}: SchemaGalleryViewProps) {
  const interesting: { row: SchemaDiffRow; status: CardStatus }[] = [];
  const other: SchemaDiffRow[] = [];
  for (const row of rows) {
    const status = classifyInteresting(row);
    if (status) interesting.push({ row, status });
    else other.push(row);
  }
  const totalRows = extractTotalRows(rows);
  const hasRowCount = totalRows.base !== null || totalRows.current !== null;
  const rowsChanged =
    totalRows.base !== null &&
    totalRows.current !== null &&
    totalRows.base !== totalRows.current;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        p: 1,
        overflow: "auto",
        height: "100%",
      }}
    >
      {hasRowCount && (
        <div
          data-testid="gallery-total-rows"
          className={`schema-gallery-total-rows${rowsChanged ? " schema-gallery-total-rows-changed" : ""}`}
        >
          <span className="schema-gallery-total-rows-label">total rows</span>
          {rowsChanged ? (
            <span className="schema-gallery-total-rows-val">
              <span className="schema-gallery-total-rows-base">
                {formatQuadValue(totalRows.base)}
              </span>
              <span className="schema-gallery-total-rows-arrow">→</span>
              <span>{formatQuadValue(totalRows.current)}</span>
            </span>
          ) : (
            <span className="schema-gallery-total-rows-val">
              {formatQuadValue(totalRows.current ?? totalRows.base)}
            </span>
          )}
        </div>
      )}
      {interesting.length > 0 && (
        <section
          data-testid="interesting-section"
          className="schema-gallery-section"
        >
          <h4 className="schema-gallery-section-title">
            Interesting ({interesting.length})
          </h4>
          <div className="schema-gallery-grid">
            {interesting.map(({ row, status }) => {
              const key = row.name.toLowerCase();
              return (
                <Card
                  key={row.name}
                  row={row}
                  status={status}
                  distribution={distributionByName?.get(key)}
                  pending={pendingDistributionColumns?.has(key)}
                  onClick={
                    onColumnClick ? () => onColumnClick(row.name) : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      )}
      {other.length > 0 && (
        <section data-testid="other-section" className="schema-gallery-section">
          <h4 className="schema-gallery-section-title">
            Other ({other.length})
          </h4>
          <div className="schema-gallery-strip">
            {other.map((row) => {
              const isRemoved = row.currentIndex === undefined;
              const isReordered = Boolean(row.reordered);
              // Removed columns don't support CLL navigation.
              const clickable = Boolean(onColumnClick) && !isRemoved;
              const classes = [
                "schema-gallery-chip",
                isRemoved ? "schema-gallery-chip-removed" : "",
                isReordered ? "schema-gallery-chip-reordered" : "",
                clickable ? "schema-gallery-chip-clickable" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const handleClick = clickable
                ? () => onColumnClick?.(row.name)
                : undefined;
              return (
                <div
                  key={row.name}
                  className={classes}
                  onClick={handleClick}
                  onKeyDown={
                    handleClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleClick();
                          }
                        }
                      : undefined
                  }
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                >
                  <span>{row.name}</span>
                  <span className="schema-gallery-chip-type">
                    {row.currentType ?? row.baseType ?? ""}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Box>
  );
}
