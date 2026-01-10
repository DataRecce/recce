/**
 * Browser-specific CSV export utilities
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
 * Copy CSV content to clipboard
 * Requires a secure context (HTTPS or localhost)
 * @param content - CSV string content to copy
 * @throws Error if Clipboard API is not available
 */
export async function copyCSVToClipboard(content: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error(
      "Clipboard API not available. Ensure you're using HTTPS or localhost.",
    );
  }

  await navigator.clipboard.writeText(content);
}
