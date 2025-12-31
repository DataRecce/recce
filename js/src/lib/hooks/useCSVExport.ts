/**
 * Hook for CSV export functionality
 */
import { useCallback, useMemo } from "react";
import { toaster } from "@/components/ui/toaster";
import type { Run } from "@/lib/api/types";
import {
  copyCSVToClipboard,
  downloadCSV,
  extractCSVData,
  generateCSVFilename,
  supportsCSVExport,
  toCSV,
} from "@/lib/csv";

interface UseCSVExportOptions {
  run?: Run;
}

interface UseCSVExportResult {
  /** Whether CSV export is available for this run type */
  canExportCSV: boolean;
  /** Copy result data as CSV to clipboard */
  copyAsCSV: () => Promise<void>;
  /** Download result data as CSV file */
  downloadAsCSV: () => void;
}

export function useCSVExport({ run }: UseCSVExportOptions): UseCSVExportResult {
  const canExportCSV = useMemo(() => {
    if (!run?.type || !run?.result) return false;
    return supportsCSVExport(run.type);
  }, [run?.type, run?.result]);

  const getCSVContent = useCallback((): string | null => {
    if (!run?.type || !run?.result) return null;

    const csvData = extractCSVData(run.type, run.result);
    if (!csvData) return null;

    return toCSV(csvData.columns, csvData.rows);
  }, [run?.type, run?.result]);

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
    } catch {
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
    } catch {
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
