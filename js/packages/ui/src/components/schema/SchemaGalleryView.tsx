"use client";

import Box from "@mui/material/Box";
import type { SchemaDiffRow } from "../../lib/dataGrid/generators/toSchemaDataGrid";

export type CardStatus = "impacted" | "typechg" | "defchg" | "added";

export interface SchemaGalleryViewProps {
  rows: SchemaDiffRow[];
}

const STATUS_LABEL: Record<CardStatus, string> = {
  impacted: "impacted",
  typechg: "type",
  defchg: "def",
  added: "added",
};

const QUADRANTS = [
  { field: "min", label: "min", pct: false },
  { field: "max", label: "max", pct: false },
  { field: "not_null_proportion", label: "null%", pct: true },
  { field: "is_unique", label: "unique", pct: false },
] as const;

function classifyInteresting(row: SchemaDiffRow): CardStatus | null {
  if (row.baseIndex === undefined) return "added";
  if (row.baseType !== undefined && row.baseType !== row.currentType) return "typechg";
  if (row.definitionChanged) return "defchg";
  if (row.isImpacted) return "impacted";
  return null;
}

function formatQuadValue(v: unknown, pct = false): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "✓" : "—";
  if (typeof v === "number") {
    if (pct) return `${(v * 100).toFixed(1)}%`;
    return String(v);
  }
  return String(v);
}

function isQuadChanged(row: SchemaDiffRow, field: string): boolean {
  const rec = row as unknown as Record<string, unknown>;
  const b = rec[`base__${field}`];
  const c = rec[`current__${field}`];
  const absent = (v: unknown) => v === undefined || v === null;
  if (absent(b) && absent(c)) return false;
  if (absent(b) || absent(c)) return true;
  return b !== c;
}

function Card({ row, status }: { row: SchemaDiffRow; status: CardStatus }) {
  const rec = row as unknown as Record<string, unknown>;
  const showQuadValue =
    status === "added"
      ? (field: string, pct: boolean) =>
          formatQuadValue(rec[`current__${field}`], pct)
      : (field: string, pct: boolean) =>
          formatQuadValue(
            rec[`current__${field}`] ?? rec[`base__${field}`],
            pct,
          );
  return (
    <div
      className={`schema-card schema-card-${status}`}
      data-testid={`card-${row.name}`}
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
      <div className="schema-card-quads">
        {QUADRANTS.map(({ field, label, pct }) => {
          const changed = status === "added" ? false : isQuadChanged(row, field);
          return (
            <div
              key={field}
              className="schema-card-quad"
              data-testid={`quad-${field}`}
              data-changed={String(changed)}
            >
              <span className="schema-card-quad-lbl">{label}</span>
              <span className="schema-card-quad-val">{showQuadValue(field, pct)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SchemaGalleryView({ rows }: SchemaGalleryViewProps) {
  const interesting: { row: SchemaDiffRow; status: CardStatus }[] = [];
  const other: SchemaDiffRow[] = [];
  for (const row of rows) {
    const status = classifyInteresting(row);
    if (status) interesting.push({ row, status });
    else other.push(row);
  }

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
      {interesting.length > 0 && (
        <section
          data-testid="interesting-section"
          className="schema-gallery-section"
        >
          <h4 className="schema-gallery-section-title">
            Interesting ({interesting.length})
          </h4>
          <div className="schema-gallery-grid">
            {interesting.map(({ row, status }) => (
              <Card key={row.name} row={row} status={status} />
            ))}
          </div>
        </section>
      )}
      {other.length > 0 && (
        <section data-testid="other-section" className="schema-gallery-section">
          <h4 className="schema-gallery-section-title">Other ({other.length})</h4>
          <div className="schema-gallery-strip">
            {other.map((row) => {
              const isRemoved = row.currentIndex === undefined;
              const isReordered = Boolean(row.reordered);
              const classes = [
                "schema-gallery-chip",
                isRemoved ? "schema-gallery-chip-removed" : "",
                isReordered ? "schema-gallery-chip-reordered" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div key={row.name} className={classes}>
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
