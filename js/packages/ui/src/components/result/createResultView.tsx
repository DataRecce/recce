"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { amber } from "@mui/material/colors";
import { forwardRef, type ReactNode, type Ref, useMemo } from "react";
import { PiWarning } from "react-icons/pi";

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
  WarningStyle,
} from "./types";

/**
 * Renders a single warning with amber styling (icon + text).
 */
function AmberWarning({
  warning,
  isDark,
}: {
  warning: string;
  isDark: boolean;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        fontSize: "0.75rem",
      }}
    >
      <PiWarning color={isDark ? amber[400] : amber[600]} />
      <Box>{warning}</Box>
    </Box>
  );
}

/**
 * Toolbar area component for ResultView.
 * Renders warnings on the left, spacer, and toolbar controls on the right.
 */
function ToolbarArea({
  toolbar,
  warnings,
  warningStyle = "alert",
  isDark,
}: {
  toolbar?: ReactNode;
  warnings?: string[];
  warningStyle?: WarningStyle;
  isDark: boolean;
}) {
  if (!toolbar && (!warnings || warnings.length === 0)) {
    return null;
  }

  // Determine background color based on warning style
  const bgColor =
    warningStyle === "amber" && warnings && warnings.length > 0
      ? isDark
        ? amber[900]
        : amber[100]
      : isDark
        ? "grey.900"
        : "grey.50";

  // Determine text color for amber style
  const textColor =
    warningStyle === "amber" && warnings && warnings.length > 0
      ? isDark
        ? amber[200]
        : amber[800]
      : undefined;

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
        bgcolor: bgColor,
        color: textColor,
      }}
    >
      {warningStyle === "amber"
        ? warnings?.map((warning) => (
            <AmberWarning key={warning} warning={warning} isDark={isDark} />
          ))
        : warnings?.map((warning) => (
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
 * Factory function to create type-safe ResultView components.
 *
 * @remarks
 * Reduces boilerplate by handling:
 * - Type guard validation with consistent error messages
 * - forwardRef setup for screenshot capture
 * - Dark/light theme handling
 * - Empty state rendering
 *
 * @typeParam TRun - Run payload type validated by the type guard.
 * @typeParam TViewOptions - Optional view options shape used by the view.
 * @typeParam TRef - Ref type exposed by the view (defaults to DataGridHandle).
 *
 * @example
 * ```tsx
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
 * ```
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
      const hasToolbar =
        data?.toolbar || (data?.warnings && data.warnings.length > 0);

      // Empty state WITH toolbar (for patterns like ValueDiffDetailResultView "No change")
      if (hasToolbar) {
        return (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              bgcolor: isDark ? "grey.900" : "grey.50",
              height: "100%",
            }}
          >
            <ToolbarArea
              toolbar={data?.toolbar}
              warnings={data?.warnings}
              warningStyle={data?.warningStyle}
              isDark={isDark}
            />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
              }}
            >
              {data?.emptyMessage ?? emptyState}
            </Box>
          </Box>
        );
      }

      // Empty state WITHOUT toolbar (default)
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
            warningStyle={data.warningStyle}
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
            renderers={{
              noRowsFallback: (
                <EmptyRowsRenderer emptyMessage={data.noRowsMessage} />
              ),
            }}
            defaultColumnOptions={data.defaultColumnOptions}
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
          warningStyle={data.warningStyle}
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
