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
 * Convert tabular data to TSV string
 * @param columns - Column headers
 * @param rows - Row data (array of arrays)
 * @returns TSV string (no BOM — plain text suitable for clipboard and file download)
 */
export function toTSV(columns: string[], rows: unknown[][]): string {
  const headerRow = columns.map(escapeTSVValue).join("\t");
  const dataRows = rows.map((row) => row.map(escapeTSVValue).join("\t"));

  return [headerRow, ...dataRows].join("\r\n");
}

/**
 * Format a row count as a human-readable string
 * - < 1,000: exact number ("450 rows")
 * - 1,000–999,999: thousands ("12k rows", "450k rows")
 * - >= 1,000,000: millions ("1.2M rows", "3.5M rows")
 */
export function formatRowCount(n: number): string {
  const label = n === 1 ? "row" : "rows";

  if (n < 1000) {
    return `${n} ${label}`;
  }

  if (n < 1_000_000) {
    const k = n / 1000;
    // Round up to M if k would display as 1000
    if (k >= 999.95) {
      return `1M ${label}`;
    }
    const formatted = k % 1 === 0 ? String(k) : k.toFixed(1);
    return `${formatted}k ${label}`;
  }

  const m = n / 1_000_000;
  const formatted = m % 1 === 0 ? String(m) : m.toFixed(1);
  return `${formatted}M ${label}`;
}
