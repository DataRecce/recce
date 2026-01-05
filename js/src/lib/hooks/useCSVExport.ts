/**
 * Hook for CSV export functionality
 */
import { useCallback, useMemo } from "react";
import { toaster } from "@/components/ui/toaster";
import type { Run } from "@/lib/api/types";
import {
  type CSVExportOptions,
  copyCSVToClipboard,
  downloadCSV,
  extractCSVData,
  generateCSVFilename,
  supportsCSVExport,
  toCSV,
} from "@/lib/csv";

interface UseCSVExportOptions {
  run?: Run;
  /** View options - displayMode is extracted if present (for query_diff views) */
  viewOptions?: Record<string, unknown>;
}

interface UseCSVExportResult {
  /** Whether CSV export is available for this run type */
  canExportCSV: boolean;
  /** Copy result data as CSV to clipboard */
  copyAsCSV: () => Promise<void>;
  /** Download result data as CSV file */
  downloadAsCSV: () => void;
}

export function useCSVExport({
  run,
  viewOptions,
}: UseCSVExportOptions): UseCSVExportResult {
  const canExportCSV = useMemo(() => {
    if (!run?.type || !run?.result) return false;
    return supportsCSVExport(run.type);
  }, [run?.type, run?.result]);

  const getCSVContent = useCallback((): string | null => {
    if (!run?.type || !run?.result) return null;

    // Extract display_mode from viewOptions if it exists (for query_diff)
    const displayMode = viewOptions?.display_mode as
      | "inline"
      | "side_by_side"
      | undefined;

    // Extract primary_keys from run params (for query_diff with primary keys)
    const primaryKeys = (run?.params as { primary_keys?: string[] })
      ?.primary_keys;

    const exportOptions: CSVExportOptions = {
      displayMode,
      primaryKeys,
    };

    const csvData = extractCSVData(run.type, run.result, exportOptions);
    if (!csvData) return null;

    return toCSV(csvData.columns, csvData.rows);
  }, [run?.type, run?.result, run?.params, viewOptions]);

  const copyAsCSV = useCallback(async () => {
    const content = getCSVContent();
    if (!content) {
      toaster.create({
        title: "Export failed",
        description: "Unable to extract data for CSV export",
        type: "error",
        duration: 3000,
      });
      return;
    }

    try {
      await copyCSVToClipboard(content);
      toaster.create({
        title: "Copied to clipboard",
        description: "CSV data copied successfully",
        type: "success",
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to copy CSV to clipboard:", error);
      toaster.create({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        type: "error",
        duration: 3000,
      });
    }
  }, [getCSVContent]);

  const downloadAsCSV = useCallback(() => {
    const content = getCSVContent();
    if (!content) {
      toaster.create({
        title: "Export failed",
        description: "Unable to extract data for CSV export",
        type: "error",
        duration: 3000,
      });
      return;
    }

    try {
      const filename = generateCSVFilename(
        run?.type ?? "",
        run?.params as Record<string, unknown>,
      );
      downloadCSV(content, filename);
      toaster.create({
        title: "Downloaded",
        description: filename,
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to download CSV file:", error);
      toaster.create({
        title: "Download failed",
        description: "Failed to download CSV file",
        type: "error",
        duration: 3000,
      });
    }
  }, [getCSVContent, run]);

  return {
    canExportCSV,
    copyAsCSV,
    downloadAsCSV,
  };
}
