"use client";

import Box from "@mui/material/Box";
import type { SchemaDiffRow } from "../../lib/dataGrid/generators/toSchemaDataGrid";

export type CardStatus = "impacted" | "typechg" | "defchg" | "added";

export interface SchemaGalleryViewProps {
  rows: SchemaDiffRow[];
}

function classifyInteresting(row: SchemaDiffRow): CardStatus | null {
  if (row.baseIndex === undefined) return "added";
  if (row.baseType !== undefined && row.baseType !== row.currentType) return "typechg";
  if (row.definitionChanged) return "defchg";
  if (row.isImpacted) return "impacted";
  return null;
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1, overflow: "auto", height: "100%" }}>
      {interesting.length > 0 && (
        <section data-testid="interesting-section" className="schema-gallery-section">
          <h4 className="schema-gallery-section-title">
            Interesting ({interesting.length})
          </h4>
          <div className="schema-gallery-grid">
            {interesting.map(({ row, status }) => (
              <div key={row.name} className={`schema-card schema-card-${status}`}>
                <div className="schema-card-head">
                  <span className="schema-card-name">{row.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {other.length > 0 && (
        <section data-testid="other-section" className="schema-gallery-section">
          <h4 className="schema-gallery-section-title">Other ({other.length})</h4>
          <div className="schema-gallery-strip">
            {other.map((row) => (
              <div key={row.name} className="schema-gallery-chip">
                <span>{row.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </Box>
  );
}
