/**
 * Browser-specific export utilities (CSV, TSV, Excel)
 *
 * These utilities depend on browser APIs (Clipboard, file-saver) and should
 * only be used in browser environments.
 */
import saveAs from "file-saver";

/**
 * Trigger browser download of CSV file
 * @param content - CSV string content
 * @param filename - Name for the downloaded file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  saveAs(blob, filename);
}

/**
 * Trigger browser download of TSV file
 * @param content - TSV string content
 * @param filename - Name for the downloaded file
 */
export function downloadTSV(content: string, filename: string): void {
  const blob = new Blob([content], {
    type: "text/tab-separated-values;charset=utf-8",
  });
  saveAs(blob, filename);
}

/**
 * Trigger browser download of Excel file
 * @param blob - Excel Blob content
 * @param filename - Name for the downloaded file
 */
export function downloadExcel(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}

/**
 * Copy text content to clipboard
 * Requires a secure context (HTTPS or localhost)
 * @param content - Text content to copy (CSV, TSV, or any string)
 * @throws Error if Clipboard API is not available
 */
export async function copyToClipboard(content: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error(
      "Clipboard API not available. Ensure you're using HTTPS or localhost.",
    );
  }

  await navigator.clipboard.writeText(content);
}
