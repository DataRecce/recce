"use client";

import Box from "@mui/material/Box";
import { forwardRef, type Ref, useMemo } from "react";

import { useIsDark } from "../../hooks";
import {
  type DataGridHandle,
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data/ScreenshotDataGrid";
import { ScreenshotBox } from "../ui/ScreenshotBox";
import type {
  CreatedResultViewProps,
  ResultViewConfig,
  ResultViewRef,
} from "./types";

/**
 * Factory function to create type-safe ResultView components
 *
 * Reduces boilerplate by handling:
 * - Type guard validation with consistent error messages
 * - forwardRef setup for screenshot capture
 * - Dark/light theme handling
 * - Empty state rendering
 *
 * @example
 * export const RowCountResultView = createResultView({
 *   displayName: "RowCountResultView",
 *   typeGuard: isRowCountRun,
 *   expectedRunType: "row_count",
 *   screenshotWrapper: "grid",
 *   transformData: (run) => ({
 *     columns: toRowCountGrid(run).columns,
 *     rows: toRowCountGrid(run).rows,
 *   }),
 * });
 */
export function createResultView<
  TRun,
  TViewOptions = unknown,
  TRef extends ResultViewRef = DataGridHandle,
>(config: ResultViewConfig<TRun, TViewOptions>) {
  const {
    displayName,
    typeGuard,
    expectedRunType,
    screenshotWrapper,
    transformData,
    emptyState = "No data",
    conditionalEmptyState,
  } = config;

  function ResultViewInner(
    {
      run,
      viewOptions,
      onViewOptionsChanged,
    }: CreatedResultViewProps<TViewOptions>,
    ref: Ref<TRef>,
  ) {
    const isDark = useIsDark();

    // Type guard validation
    if (!typeGuard(run)) {
      throw new Error(`Run type must be ${expectedRunType}`);
    }

    // Transform data - memoized for performance (must be called before conditional returns)
    const data = useMemo(
      () => transformData(run, { viewOptions, onViewOptionsChanged }),
      [run, viewOptions, onViewOptionsChanged],
    );

    // Check conditional empty state
    const conditionalEmpty = conditionalEmptyState?.(run, viewOptions);
    if (conditionalEmpty !== null && conditionalEmpty !== undefined) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: isDark ? "grey.900" : "grey.50",
            height: "100%",
          }}
        >
          {conditionalEmpty}
        </Box>
      );
    }

    // Empty state
    if (!data || data.isEmpty) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: isDark ? "grey.900" : "grey.50",
            height: "100%",
          }}
        >
          {emptyState}
        </Box>
      );
    }

    // Render based on wrapper type
    if (screenshotWrapper === "grid") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <ScreenshotDataGrid
            ref={ref as Ref<DataGridHandle>}
            style={{
              blockSize: "auto",
              maxHeight: "100%",
              overflow: "auto",
              fontSize: "0.875rem",
              borderWidth: 1,
            }}
            columns={(data.columns ?? []) as never}
            rows={(data.rows ?? []) as never}
            renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
          />
        </Box>
      );
    }

    // Box wrapper for charts
    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <ScreenshotBox
          ref={ref as Ref<HTMLDivElement>}
          height="100%"
          backgroundColor={isDark ? "#1f2937" : "white"}
        >
          {data.content}
        </ScreenshotBox>
      </Box>
    );
  }

  // Set display name for DevTools
  ResultViewInner.displayName = displayName;

  // Create forwardRef component with proper typing
  const ForwardedResultView = forwardRef(ResultViewInner);

  return ForwardedResultView;
}
