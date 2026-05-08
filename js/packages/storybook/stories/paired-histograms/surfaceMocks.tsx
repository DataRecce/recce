import { DataTypeIcon } from "@datarecce/ui";
import type { ReactNode } from "react";

/**
 * Surface mocks for the Paired Histograms design exploration. Each mock approximates
 * the real visual context so chart sizing and density choices land in the
 * right frame, without dragging in OSS-app CSS or the real grid library.
 *
 * - GridRowMock: a single schema-grid row with column-name, type chip, the
 *   existing 5-square strip, and a "distribution" cell slot at ~140×40.
 * - GalleryCardMock: a SchemaGalleryView-style card (~280×~210) with a
 *   header, the chart as primary visual, and four-quadrant stats below.
 * - SidebarMock + SidebarRowMock: a narrow panel showing many columns at
 *   once with their paired-histogram cells stacked vertically — the "all columns
 *   at a glance" surface.
 */

const STRIP_COLOR_OK = "rgb(74 222 128 / 0.55)";
const STRIP_COLOR_CHANGED = "rgb(251 146 60 / 0.85)";
const STRIP_COLOR_EMPTY = "rgb(229 231 235)";

interface GridRowMockProps {
  columnName: string;
  columnType: string;
  /** 5 strip-square states. "ok" | "changed" | "empty". */
  strip?: ("ok" | "changed" | "empty")[];
  /** The chart goes here. */
  distribution: ReactNode;
}

export function GridRowMock({
  columnName,
  columnType,
  strip = ["ok", "ok", "ok", "ok", "ok"],
  distribution,
}: GridRowMockProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 80px 64px 1fr",
        alignItems: "center",
        gap: 12,
        padding: "6px 12px",
        border: "1px solid #e5e7eb",
        borderRadius: 4,
        background: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 13,
        width: 560,
      }}
    >
      <span
        style={{ color: "#1f2937", fontWeight: 500, overflow: "hidden" }}
        title={columnName}
      >
        {columnName}
      </span>
      <span
        style={{
          color: "#6b7280",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
        }}
      >
        {columnType}
      </span>
      <span
        aria-label="profile strip"
        style={{ display: "inline-flex", gap: 2 }}
      >
        {strip.map((state, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: stable order
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background:
                state === "changed"
                  ? STRIP_COLOR_CHANGED
                  : state === "ok"
                    ? STRIP_COLOR_OK
                    : STRIP_COLOR_EMPTY,
            }}
          />
        ))}
      </span>
      <div
        aria-label="distribution"
        style={{ display: "flex", justifyContent: "flex-start" }}
      >
        {distribution}
      </div>
    </div>
  );
}

interface GalleryCardMockProps {
  columnName: string;
  columnType: string;
  /** Optional badge text — "impacted", "type", "added", etc. */
  badge?: string;
  /** Chart slot — primary visual on the card. */
  chart: ReactNode;
  /** Four-quadrant stats: [label, value][]. Use 4 entries. */
  quads?: [label: string, value: ReactNode][];
}

export function GalleryCardMock({
  columnName,
  columnType,
  badge,
  chart,
  quads = [
    ["min", "—"],
    ["max", "—"],
    ["null%", "—"],
    ["unique", "—"],
  ],
}: GalleryCardMockProps) {
  return (
    <div
      style={{
        width: 280,
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        background: "#fff",
        padding: 12,
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxShadow: "0 1px 2px rgb(0 0 0 / 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#111827",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={columnName}
        >
          {columnName}
        </span>
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              padding: "2px 6px",
              borderRadius: 3,
              background: "rgb(251 146 60 / 0.18)",
              color: "rgb(154 52 18)",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
          color: "#6b7280",
          marginBottom: 10,
        }}
      >
        {columnType}
      </div>
      <div
        style={{
          marginBottom: 10,
          padding: "4px 0",
          borderTop: "1px solid #f3f4f6",
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {chart}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          rowGap: 4,
          columnGap: 12,
          fontSize: 11,
        }}
      >
        {quads.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#374151",
            }}
          >
            <span style={{ color: "#6b7280" }}>{label}</span>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              {value}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 12,
          fontSize: 10,
          color: "#6b7280",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              background: "#F6AD55A5",
              borderRadius: 1,
            }}
          />
          base
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              background: "#63B3EDA5",
              borderRadius: 1,
            }}
          />
          current
        </span>
      </div>
    </div>
  );
}

/**
 * Status maps directly to Recce's existing schema CSS:
 *   - row tint class:  .row-{added/removed/changed/impacted/normal}
 *   - badge variant:   .schema-change-badge-{added/removed/changed/impacted}
 *   - glyph:           +/-/~/!  (matches ColumnNameCell.tsx)
 */
type SidebarRowStatus = "ok" | "changed" | "added" | "removed" | "impacted";

interface SidebarRowMockProps {
  columnName: string;
  columnType: string;
  status?: SidebarRowStatus;
  /** Tiny chart slot, ~130×28. */
  chart: ReactNode;
}

const ROW_TINT_CLASS: Record<SidebarRowStatus, string> = {
  ok: "row-normal",
  changed: "row-changed",
  added: "row-added",
  removed: "row-removed",
  impacted: "row-impacted",
};

const BADGE: Record<
  Exclude<SidebarRowStatus, "ok">,
  { variant: string; glyph: string; aria: string }
> = {
  added: { variant: "schema-change-badge-added", glyph: "+", aria: "added" },
  removed: {
    variant: "schema-change-badge-removed",
    glyph: "−",
    aria: "removed",
  },
  changed: {
    variant: "schema-change-badge-changed",
    glyph: "~",
    aria: "changed",
  },
  impacted: {
    variant: "schema-change-badge-impacted",
    glyph: "!",
    aria: "impacted",
  },
};

export function SidebarRowMock({
  columnName,
  columnType,
  status = "ok",
  chart,
}: SidebarRowMockProps) {
  const badge = status === "ok" ? null : BADGE[status];
  return (
    <div
      className={ROW_TINT_CLASS[status]}
      style={{
        display: "grid",
        gridTemplateColumns: "16px 16px 1fr auto",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderBottom: "1px solid #f3f4f6",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {badge ? (
        <span
          className={`schema-change-badge ${badge.variant}`}
          aria-label={badge.aria}
        >
          {badge.glyph}
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
      <DataTypeIcon type={columnType} size={14} disableTooltip />
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "#1f2937",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={`${columnName} : ${columnType}`}
      >
        {columnName}
      </span>
      <div style={{ display: "flex", alignItems: "center" }}>{chart}</div>
    </div>
  );
}

interface SidebarMockProps {
  /** Sidebar header label. */
  title?: string;
  /** Optional summary line under the title (e.g., "12 columns, 5 changed"). */
  subtitle?: string;
  children: ReactNode;
}

export function SidebarMock({ title, subtitle, children }: SidebarMockProps) {
  return (
    <div
      style={{
        width: 320,
        maxHeight: 600,
        overflow: "auto",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        background: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxShadow: "0 1px 2px rgb(0 0 0 / 0.04)",
      }}
    >
      {(title || subtitle) && (
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fafafa",
          }}
        >
          {title && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
