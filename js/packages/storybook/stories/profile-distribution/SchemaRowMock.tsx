import type { ReactNode } from "react";

/**
 * Compact-mode schema-row stand-in for the Paired Histograms storybook
 * (DRC-3390 PR 3). Approximates the visual context the real
 * `SchemaView` cells will appear in without dragging in `ag-grid` or
 * the OSS app's CSS — chart sizing + density choices can be validated
 * in isolation.
 *
 * One row = [badge slot] [type icon] [column name + type chip]
 *           [distribution cell].
 *
 * This is the GA equivalent of the prototype `SidebarRowMock` /
 * `GridRowMock`. Grid mode is intentionally absent at GA.
 */

const STRIP_COLOR_OK = "rgb(74 222 128 / 0.55)";
const STRIP_COLOR_CHANGED = "rgb(251 146 60 / 0.85)";

interface SchemaRowMockProps {
  columnName: string;
  columnType: string;
  status?: "ok" | "changed" | "added" | "removed";
  distribution: ReactNode;
  /** Force dark mode for snapshot stories. */
  isDark?: boolean;
}

const ROW_BG_LIGHT: Record<
  NonNullable<SchemaRowMockProps["status"]>,
  string
> = {
  ok: "#ffffff",
  changed: "rgb(255 244 230 / 0.55)",
  added: "rgb(220 252 231 / 0.55)",
  removed: "rgb(254 226 226 / 0.55)",
};

const ROW_BG_DARK: Record<NonNullable<SchemaRowMockProps["status"]>, string> = {
  ok: "#0f172a",
  changed: "rgb(180 83 9 / 0.20)",
  added: "rgb(22 101 52 / 0.25)",
  removed: "rgb(127 29 29 / 0.25)",
};

const BADGE_GLYPH: Record<NonNullable<SchemaRowMockProps["status"]>, string> = {
  ok: "",
  changed: "~",
  added: "+",
  removed: "−",
};

const BADGE_COLOR: Record<NonNullable<SchemaRowMockProps["status"]>, string> = {
  ok: "transparent",
  changed: STRIP_COLOR_CHANGED,
  added: STRIP_COLOR_OK,
  removed: "rgb(248 113 113 / 0.85)",
};

export function SchemaRowMock({
  columnName,
  columnType,
  status = "ok",
  distribution,
  isDark = false,
}: SchemaRowMockProps) {
  const bg = isDark ? ROW_BG_DARK[status] : ROW_BG_LIGHT[status];
  const textColor = isDark ? "#e5e7eb" : "#1f2937";
  const typeColor = isDark ? "#9ca3af" : "#6b7280";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr 80px 160px",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        background: bg,
        borderBottom: isDark ? "1px solid #1f2937" : "1px solid #f3f4f6",
        fontFamily: "system-ui, -apple-system, sans-serif",
        minHeight: 32,
      }}
    >
      <span
        aria-label={status === "ok" ? "unchanged" : status}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          fontSize: 11,
          fontWeight: 700,
          color: status === "ok" ? "transparent" : "#1f2937",
          background: BADGE_COLOR[status],
          borderRadius: 3,
        }}
      >
        {BADGE_GLYPH[status]}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: textColor,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={`${columnName} : ${columnType}`}
      >
        {columnName}
      </span>
      <span
        style={{
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
          color: typeColor,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {columnType}
      </span>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        {distribution}
      </div>
    </div>
  );
}

export function SchemaContainerMock({
  children,
  isDark = false,
  title,
  subtitle,
}: {
  children: ReactNode;
  isDark?: boolean;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        width: 540,
        background: isDark ? "#0b1220" : "#ffffff",
        color: isDark ? "#e5e7eb" : "#1f2937",
        border: isDark ? "1px solid #1f2937" : "1px solid #e5e7eb",
        borderRadius: 6,
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {(title || subtitle) && (
        <div
          style={{
            padding: "10px 12px",
            borderBottom: isDark ? "1px solid #1f2937" : "1px solid #e5e7eb",
            background: isDark ? "#111827" : "#fafafa",
          }}
        >
          {title && (
            <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
          )}
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: isDark ? "#9ca3af" : "#6b7280",
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
