/**
 * @file csv/format.ts
 * @description CSV and TSV formatting utilities
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

/**
 * Escape a value for TSV format
 * - Replace tabs, newlines, and carriage returns with spaces
 * - No quoting needed (tabs are the only delimiter)
 */
function escapeTSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  // Replace characters that would break TSV structure
  return stringValue.replace(/[\t\r\n]+/g, " ");
}

/**
 * Convert tabular data to TSV string for clipboard pasting into spreadsheets
 * @param columns - Column headers
 * @param rows - Row data (array of arrays)
 * @returns TSV string (no BOM - intended for clipboard, not file download)
 */
export function toTSV(columns: string[], rows: unknown[][]): string {
  const headerRow = columns.map(escapeTSVValue).join("\t");
  const dataRows = rows.map((row) => row.map(escapeTSVValue).join("\t"));

  return [headerRow, ...dataRows].join("\r\n");
}
