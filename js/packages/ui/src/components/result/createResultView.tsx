"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { forwardRef, type ReactNode, type Ref, useMemo } from "react";

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
 * Toolbar area component for ResultView.
 * Renders warnings on the left, spacer, and toolbar controls on the right.
 */
function ToolbarArea({
  toolbar,
  warnings,
  isDark,
}: {
  toolbar?: ReactNode;
  warnings?: string[];
  isDark: boolean;
}) {
  if (!toolbar && (!warnings || warnings.length === 0)) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.5,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: isDark ? "grey.900" : "grey.50",
      }}
    >
      {warnings?.map((warning) => (
        <Alert
          key={warning}
          severity="warning"
          sx={{ py: 0, fontSize: "0.75rem" }}
        >
          {warning}
        </Alert>
      ))}
      <Box sx={{ flex: 1 }} />
      {toolbar}
    </Box>
  );
}

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
      onAddToChecklist,
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
      () =>
        transformData(run, {
          viewOptions,
          onViewOptionsChanged,
          onAddToChecklist,
        }),
      [run, viewOptions, onViewOptionsChanged, onAddToChecklist],
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

    // Return null case (component renders nothing)
    if (data?.renderNull) {
      return null;
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
          {data.header}
          <ToolbarArea
            toolbar={data.toolbar}
            warnings={data.warnings}
            isDark={isDark}
          />
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
          {data.footer}
        </Box>
      );
    }

    // Box wrapper for charts
    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {data.header}
        <ToolbarArea
          toolbar={data.toolbar}
          warnings={data.warnings}
          isDark={isDark}
        />
        <ScreenshotBox
          ref={ref as Ref<HTMLDivElement>}
          height="100%"
          backgroundColor={isDark ? "#1f2937" : "white"}
        >
          {data.content}
        </ScreenshotBox>
        {data.footer}
      </Box>
    );
  }

  // Set display name for DevTools
  ResultViewInner.displayName = displayName;

  // Create forwardRef component with proper typing
  const ForwardedResultView = forwardRef(ResultViewInner);

  return ForwardedResultView;
}
