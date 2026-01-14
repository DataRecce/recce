/**
 * CSV formatting utilities with Excel-friendly output
 */

/**
 * Escape a value for CSV format
 * - Wrap in quotes if contains comma, quote, or newline
 * - Escape quotes by doubling them
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  // Check if escaping is needed
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert tabular data to CSV string
 * @param columns - Column headers
 * @param rows - Row data (array of arrays)
 * @returns CSV string with UTF-8 BOM for Excel compatibility
 */
export function toCSV(columns: string[], rows: unknown[][]): string {
  const BOM = "\uFEFF";

  const headerRow = columns.map(escapeCSVValue).join(",");
  const dataRows = rows.map((row) => row.map(escapeCSVValue).join(","));

  return BOM + [headerRow, ...dataRows].join("\r\n");
}
