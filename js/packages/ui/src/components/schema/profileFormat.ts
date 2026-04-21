/**
 * @file profileFormat.ts
 * @description Shared number/string formatting helpers for inline-profile
 * values. Used by both SchemaGalleryView (grid mode) and the strip-cell
 * hover card (strip mode).
 */

/**
 * Parse a value that may be a number or a numeric string.
 * The profile backend returns numbers as strings (e.g. "69.370000"), so
 * callers need to normalise before formatting.
 */
export function toNumeric(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n) && v.trim() !== "") return n;
  }
  return null;
}

/**
 * Formats a profile stat value for display.
 * - undefined/null → "—"
 * - boolean → "✓" / "✗"
 * - numeric (or numeric string) → trimmed 2-decimal float or integer; percent when pct=true
 * - other → string coercion
 */
export function formatProfileValue(v: unknown, pct = false): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  const n = toNumeric(v);
  if (n !== null) {
    if (pct) return `${(n * 100).toFixed(2)}%`;
    if (Number.isInteger(n)) return String(n);
    return Number(n.toFixed(2)).toString();
  }
  return String(v);
}
