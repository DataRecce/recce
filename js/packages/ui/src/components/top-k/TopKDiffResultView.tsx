"use client";

/**
 * @file TopKDiffResultView.tsx
 * @description Framework-agnostic Top-K diff result view component for @datarecce/ui
 *
 * This component uses the createResultView factory pattern and can be used by both
 * Recce OSS and Recce Cloud. It accepts generic Run types and uses type guards
 * for validation.
 *
 * The component displays top-K value distribution comparison:
 * - Horizontal bar chart comparing base vs current top-K values
 * - "View More Items" / "View Only Top-10" toggle when >10 items exist
 * - Title shows model name and column name
 * - Dark/light theme support
 */

import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  isTopKDiffRun,
  type Run,
  type TopKDiffParams,
  type TopKDiffResult,
  type TopKViewOptions,
} from "../../api";
import { useIsDark } from "../../hooks";
import { TopKBarChart } from "../data/TopKBarChart";
import { createResultView } from "../result/createResultView";
import type { CreatedResultViewProps, ResultViewData } from "../result/types";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Run type with top_k_diff result
 */
export type TopKDiffRun = Run & {
  type: "top_k_diff";
  params?: TopKDiffParams;
  result?: TopKDiffResult;
};

/**
 * Props for TopKDiffResultView component
 */
export interface TopKDiffResultViewProps
  extends CreatedResultViewProps<TopKViewOptions> {
  run: TopKDiffRun | unknown;
}

// ============================================================================
// Type Guard (wrapper to accept unknown)
// ============================================================================

/**
 * Type guard wrapper that accepts unknown and delegates to typed guard.
 */
function isTopKDiffRunGuard(run: unknown): run is TopKDiffRun {
  return isTopKDiffRun(run as Run);
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Title component for the top-K chart.
 * Uses useIsDark hook for theme-aware styling.
 */
function TopKTitle({
  model,
  columnName,
}: {
  model: string;
  columnName: string;
}) {
  const isDark = useIsDark();
  return (
    <Typography
      variant="h5"
      sx={{
        pt: 4,
        textAlign: "center",
        color: isDark ? "grey.200" : "grey.600",
      }}
    >
      Model {model}.{columnName}
    </Typography>
  );
}

/**
 * View toggle link for switching between top-10 and all items.
 */
function ViewToggleLink({
  showAll,
  onToggle,
}: {
  showAll: boolean;
  onToggle: () => void;
}) {
  return (
    <Box sx={{ display: "flex", p: 5, justifyContent: "start" }}>
      <Link
        component="button"
        onClick={onToggle}
        sx={{ color: "iochmara.main", cursor: "pointer" }}
      >
        {showAll ? "View Only Top-10" : "View More Items"}
      </Link>
    </Box>
  );
}

// ============================================================================
// Transform Function
// ============================================================================

/**
 * Transform TopKDiffRun data to result view format
 */
function transformTopKDiffData(
  run: TopKDiffRun,
  {
    viewOptions,
    onViewOptionsChanged,
  }: {
    viewOptions?: TopKViewOptions;
    onViewOptionsChanged?: (options: TopKViewOptions) => void;
  },
): ResultViewData | null {
  const result = run.result;
  const params = run.params as TopKDiffParams;

  // Empty state when no result
  if (!result) {
    return { isEmpty: true };
  }

  const baseTopK = result.base;
  const currentTopK = result.current;

  // Derive isDisplayTopTen from viewOptions (inverted: show_all=false means top10=true)
  const showAll = viewOptions?.show_all ?? false;
  const isDisplayTopTen = !showAll;

  // Check if toggle should be visible (>10 items in either base or current)
  const shouldShowToggle =
    baseTopK.values.length > 10 || currentTopK.values.length > 10;

  // Build footer with toggle link (if needed)
  const footer = shouldShowToggle ? (
    <ViewToggleLink
      showAll={showAll}
      onToggle={() => {
        if (onViewOptionsChanged) {
          onViewOptionsChanged({
            ...viewOptions,
            show_all: !showAll,
          });
        }
      }}
    />
  ) : undefined;

  return {
    content: (
      <>
        <TopKTitle model={params.model} columnName={params.column_name} />
        <Stack direction="row" alignItems="center">
          <Box sx={{ flex: 1 }} />
          <TopKBarChart
            baseData={baseTopK}
            currentData={currentTopK}
            showComparison={true}
            maxItems={isDisplayTopTen ? 10 : undefined}
          />
          <Box sx={{ flex: 1 }} />
        </Stack>
      </>
    ),
    footer,
  };
}

// ============================================================================
// Factory-Created Component
// ============================================================================

/**
 * TopKDiffResultView component - displays top-K value distribution comparison.
 *
 * Features:
 * - Displays horizontal bar chart comparing base vs current top-K values
 * - "View More Items" / "View Only Top-10" toggle when >10 items exist
 * - Title shows model name and column name
 * - Dark/light theme support
 *
 * @example
 * ```tsx
 * <TopKDiffResultView
 *   run={topKDiffRun}
 *   viewOptions={{ show_all: false }}
 *   onViewOptionsChanged={setViewOptions}
 * />
 * ```
 */
export const TopKDiffResultView = createResultView<
  TopKDiffRun,
  TopKViewOptions,
  HTMLDivElement
>({
  displayName: "TopKDiffResultView",
  typeGuard: isTopKDiffRunGuard,
  expectedRunType: "top_k_diff",
  screenshotWrapper: "box",
  emptyState: "No data",
  transformData: transformTopKDiffData,
}) as ForwardRefExoticComponent<
  TopKDiffResultViewProps & RefAttributes<HTMLDivElement>
>;
