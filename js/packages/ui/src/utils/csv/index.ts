/**
 * @file csv/index.ts
 * @description CSV/TSV export utilities
 */

export {
  copyToClipboard,
  downloadCSV,
  downloadExcel,
  downloadTSV,
} from "./browser";
export { toExcelBuffer } from "./excel";
export {
  type CSVData,
  type CSVExportOptions,
  extractCSVData,
  supportsCSVExport,
} from "./extractors";
export { toCSV, toTSV } from "./format";

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
