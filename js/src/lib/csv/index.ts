/**
 * Browser-specific CSV export utilities
 *
 * For CSV data extraction and formatting, use @datarecce/ui/utils directly.
 * This module provides browser-specific functions that depend on DOM/file-saver.
 */
import saveAs from "file-saver";

/**
 * Trigger browser download of CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  saveAs(blob, filename);
}

/**
 * Copy CSV content to clipboard
 * Requires a secure context (HTTPS or localhost)
 */
export async function copyCSVToClipboard(content: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error(
      "Clipboard API not available. Ensure you're using HTTPS or localhost.",
    );
  }

  await navigator.clipboard.writeText(content);
}
