/**
 * Hook for data export functionality (CSV, TSV, Excel)
 */

import { useCallback, useMemo } from "react";
import type { Run } from "../api";
import { toaster } from "../components/ui/Toaster";
import {
  type CSVExportOptions,
  copyToClipboard,
  downloadCSV,
  downloadExcel,
  downloadTSV,
  extractCSVData,
  generateCSVFilename,
  supportsCSVExport,
  toCSV,
  toExcelBlob,
  toTSV,
} from "../utils";

interface UseCSVExportOptions {
  run?: Run;
  runId?: string;
  /** View options - displayMode is extracted if present (for query_diff views) */
  viewOptions?: Record<string, unknown>;
}

interface UseCSVExportResult {
  /** Whether CSV export is available for this run type */
  canExportCSV: boolean;
  /** Total row count from backend (null if unavailable) */
  totalRowCount: number | null;
  /** Copy result data as CSV to clipboard */
  copyAsCSV: () => Promise<void>;
  /** Copy result data as TSV to clipboard (pastes into spreadsheets) */
  copyAsTSV: () => Promise<void>;
  /** Download result data as CSV file */
  downloadAsCSV: () => void;
  /** Download result data as TSV file */
  downloadAsTSV: () => void;
  /** Download result data as Excel file */
  downloadAsExcel: () => void;
}

export function useCSVExport({
  run,
  runId,
  viewOptions,
}: UseCSVExportOptions): UseCSVExportResult {
  const canExportCSV = useMemo(() => {
    if (!run?.type || !run?.result) return false;
    return supportsCSVExport(run.type);
  }, [run?.type, run?.result]);

  const totalRowCount = useMemo(() => {
    if (!run?.result) return null;
    const result = run.result as Record<string, unknown>;

    // Single query (DataFrame with total_row_count)
    if (
      "total_row_count" in result &&
      typeof result.total_row_count === "number"
    ) {
      return result.total_row_count;
    }

    // Query diff (base/current DataFrames)
    const base = result.base as Record<string, unknown> | undefined;
    const current = result.current as Record<string, unknown> | undefined;
    const baseTrc =
      typeof base?.total_row_count === "number" ? base.total_row_count : null;
    const currTrc =
      typeof current?.total_row_count === "number"
        ? current.total_row_count
        : null;

    if (baseTrc !== null && currTrc !== null) return Math.max(baseTrc, currTrc);
    return baseTrc ?? currTrc;
  }, [run?.result]);

  const getExtractedData = useCallback(() => {
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

    return extractCSVData(run.type, run.result, exportOptions);
  }, [run?.type, run?.result, run?.params, viewOptions]);

  const getCSVContent = useCallback((): string | null => {
    const data = getExtractedData();
    if (!data) return null;
    return toCSV(data.columns, data.rows);
  }, [getExtractedData]);

  const getTSVContent = useCallback((): string | null => {
    const data = getExtractedData();
    if (!data) return null;
    return toTSV(data.columns, data.rows);
  }, [getExtractedData]);

  const triggerBackendDownload = useCallback(
    (format: string) => {
      if (!runId) return;
      // Use hidden anchor to avoid popup blockers (especially after warning dialog)
      const a = document.createElement("a");
      a.href = `/api/runs/${runId}/export?format=${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [runId],
  );

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
      await copyToClipboard(content);
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

  // Detect join-diff runs: query_diff with primary_keys uses warehouse-side join,
  // and backend export doesn't yet return the join-diff output shown in the UI.
  const isJoinDiffRun = useMemo(() => {
    return (
      run?.type === "query_diff" &&
      Boolean(
        (run?.params as Record<string, unknown> | undefined)?.primary_keys,
      )
    );
  }, [run?.type, run?.params]);

  const downloadAsCSV = useCallback(() => {
    // For query types with a runId, use backend streaming export
    // Exclude join-diff runs — backend would export raw queries, not the diff
    if (
      runId &&
      !isJoinDiffRun &&
      ["query", "query_base", "query_diff"].includes(run?.type ?? "")
    ) {
      triggerBackendDownload("csv");
      return;
    }
    // Fallback: client-side export for non-query types (and join-diff runs)
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
  }, [runId, run, isJoinDiffRun, getCSVContent, triggerBackendDownload]);

  const copyAsTSV = useCallback(async () => {
    const content = getTSVContent();
    if (!content) {
      toaster.create({
        title: "Export failed",
        description: "Unable to extract data for export",
        type: "error",
        duration: 3000,
      });
      return;
    }

    try {
      await copyToClipboard(content);
      toaster.create({
        title: "Copied to clipboard",
        description: "Text data copied — paste into any spreadsheet",
        type: "success",
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to copy TSV to clipboard:", error);
      toaster.create({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        type: "error",
        duration: 3000,
      });
    }
  }, [getTSVContent]);

  const downloadAsTSV = useCallback(() => {
    if (
      runId &&
      !isJoinDiffRun &&
      ["query", "query_base", "query_diff"].includes(run?.type ?? "")
    ) {
      triggerBackendDownload("tsv");
      return;
    }
    const content = getTSVContent();
    if (!content) {
      toaster.create({
        title: "Export failed",
        description: "Unable to extract data for export",
        type: "error",
        duration: 3000,
      });
      return;
    }
    try {
      const filename = generateCSVFilename(
        run?.type ?? "",
        run?.params as Record<string, unknown>,
      ).replace(/\.csv$/, ".tsv");
      downloadTSV(content, filename);
      toaster.create({
        title: "Downloaded",
        description: filename,
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to download TSV file:", error);
      toaster.create({
        title: "Download failed",
        description: "Failed to download TSV file",
        type: "error",
        duration: 3000,
      });
    }
  }, [runId, run, isJoinDiffRun, getTSVContent, triggerBackendDownload]);

  const downloadAsExcel = useCallback(async () => {
    if (
      runId &&
      !isJoinDiffRun &&
      ["query", "query_base", "query_diff"].includes(run?.type ?? "")
    ) {
      triggerBackendDownload("xlsx");
      return;
    }
    const data = getExtractedData();
    if (!data) {
      toaster.create({
        title: "Export failed",
        description: "Unable to extract data for export",
        type: "error",
        duration: 3000,
      });
      return;
    }
    try {
      const blob = await toExcelBlob(data.columns, data.rows);
      const filename = generateCSVFilename(
        run?.type ?? "",
        run?.params as Record<string, unknown>,
      ).replace(/\.csv$/, ".xlsx");
      downloadExcel(blob, filename);
      toaster.create({
        title: "Downloaded",
        description: filename,
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to download Excel file:", error);
      toaster.create({
        title: "Download failed",
        description: "Failed to download Excel file",
        type: "error",
        duration: 3000,
      });
    }
  }, [runId, run, isJoinDiffRun, getExtractedData, triggerBackendDownload]);

  return {
    canExportCSV,
    totalRowCount,
    copyAsCSV,
    copyAsTSV,
    downloadAsCSV,
    downloadAsExcel,
    downloadAsTSV,
  };
}
