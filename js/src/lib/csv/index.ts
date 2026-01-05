/**
 * CSV export utilities
 */
import saveAs from "file-saver";

export { toCSV } from "./format";

/**
 * Trigger browser download of CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  saveAs(blob, filename);
}

/**
 * Copy CSV content to clipboard
 * Uses modern Clipboard API with fallback for older browsers
 */
export async function copyCSVToClipboard(content: string): Promise<void> {
  // Prefer modern async Clipboard API when available in a browser context
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(content);
    return;
  }

  // Fallback for older browsers or non-secure contexts using execCommand
  if (typeof document === "undefined") {
    // In non-DOM environments (e.g., SSR), throw error
    throw new Error("Clipboard API not available in this environment");
  }

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.style.position = "fixed"; // avoid scrolling to bottom
  textarea.style.opacity = "0";
  textarea.setAttribute("readonly", "");
  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();

  try {
    const success = document.execCommand("copy");
    if (!success) {
      throw new Error("execCommand('copy') failed");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * Generate timestamp string for filenames
 * Format: YYYYMMDD-HHmmss
 */
export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Generate context-aware CSV filename
 */
export function generateCSVFilename(
  runType: string,
  params?: Record<string, unknown>,
): string {
  const timestamp = generateTimestamp();
  const type = runType.replace(/_/g, "-");

  // Try to extract node name from params
  let nodeName: string | undefined;

  if (
    params?.node_names &&
    Array.isArray(params.node_names) &&
    params.node_names.length === 1
  ) {
    nodeName = String(params.node_names[0]);
  } else if (params?.model && typeof params.model === "string") {
    nodeName = params.model;
  }

  // Sanitize node name for filesystem (preserve dots for schema.table patterns)
  if (nodeName) {
    nodeName = nodeName.replace(/[^a-zA-Z0-9_.-]/g, "-").toLowerCase();
    return `${type}-${nodeName}-${timestamp}.csv`;
  }

  return `${type}-result-${timestamp}.csv`;
}

export {
  type CSVData,
  type CSVExportOptions,
  extractCSVData,
  supportsCSVExport,
} from "./extractors";
