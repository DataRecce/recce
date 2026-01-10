"use client";

/**
 * @file NodeRunsAggregated.tsx
 * @description Pure presentation component for displaying aggregated run results in lineage nodes
 *
 * This component displays a summary of run results for a node, including:
 * - Row count diff (base vs current comparison)
 * - Value diff summary (mismatch count)
 *
 * Source: Simplified from OSS js/src/components/lineage/NodeTag.tsx
 */

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { memo } from "react";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Row count diff result from a run
 */
export interface RowCountDiffData {
  /** Base row count (null if not available) */
  base: number | null;
  /** Current row count (null if not available) */
  curr: number | null;
}

/**
 * Value diff result from a run
 */
export interface ValueDiffData {
  /** Number of mismatched columns */
  mismatchedColumns: number;
  /** Total number of columns compared */
  totalColumns: number;
}

/**
 * Props for NodeRunsAggregated component
 */
export interface NodeRunsAggregatedProps {
  /** Row count diff result to display */
  rowCountDiff?: RowCountDiffData;
  /** Value diff result to display */
  valueDiff?: ValueDiffData;
  /** Whether the component is in dark mode */
  isDark?: boolean;
  /** Test ID for testing */
  "data-testid"?: string;
}

// =============================================================================
// ICONS
// =============================================================================

/**
 * Arrow up icon for row count increase
 */
const ArrowUpIcon = () => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 24 24"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 4l-8 8h5v8h6v-8h5z" />
  </svg>
);

/**
 * Arrow down icon for row count decrease
 */
const ArrowDownIcon = () => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 24 24"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 20l8-8h-5v-8h-6v8h-5z" />
  </svg>
);

/**
 * Swap icon for no change
 */
const SwapIcon = () => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 24 24"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6 9h12l-4-4m0 10H6l4 4" />
  </svg>
);

/**
 * Arrow right icon for transition
 */
const ArrowRightIcon = () => (
  <svg
    stroke="currentColor"
    fill="none"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate delta percentage between base and current
 */
function deltaPercentage(base: number, current: number): string {
  if (base === 0) {
    return current === 0 ? "0%" : "∞";
  }
  const delta = ((current - base) / base) * 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * Display row count comparison
 */
function RowCountDisplay({ data }: { data: RowCountDiffData }) {
  const { base, curr: current } = data;
  const baseLabel = base === null ? "N/A" : `${base.toLocaleString()} rows`;
  const currentLabel =
    current === null ? "N/A" : `${current.toLocaleString()} rows`;

  // Both null
  if (base === null && current === null) {
    return (
      <Typography variant="body2" component="span" sx={{ color: "error.main" }}>
        Failed to load
      </Typography>
    );
  }

  // One null
  if (base === null || current === null) {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" component="span">
          {baseLabel}
        </Typography>
        <Box component="span" sx={{ display: "flex" }}>
          <ArrowRightIcon />
        </Box>
        <Typography variant="body2" component="span">
          {currentLabel}
        </Typography>
      </Stack>
    );
  }

  // Equal
  if (base === current) {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" component="span">
          {currentLabel}
        </Typography>
        <Box component="span" sx={{ color: "grey.500", display: "flex" }}>
          <SwapIcon />
        </Box>
        <Typography variant="body2" component="span" sx={{ color: "grey.500" }}>
          No Change
        </Typography>
      </Stack>
    );
  }

  // Increase
  if (base < current) {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" component="span">
          {currentLabel}
        </Typography>
        <Box component="span" sx={{ color: "success.main", display: "flex" }}>
          <ArrowUpIcon />
        </Box>
        <Typography
          variant="body2"
          component="span"
          sx={{ color: "success.main" }}
        >
          {deltaPercentage(base, current)}
        </Typography>
      </Stack>
    );
  }

  // Decrease
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Typography variant="body2" component="span">
        {currentLabel}
      </Typography>
      <Box component="span" sx={{ color: "error.main", display: "flex" }}>
        <ArrowDownIcon />
      </Box>
      <Typography variant="body2" component="span" sx={{ color: "error.main" }}>
        {deltaPercentage(base, current)}
      </Typography>
    </Stack>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * NodeRunsAggregated - Pure presentation component for aggregated run results
 *
 * Displays a summary of run results for a lineage node, including:
 * - Row count diff comparison with change indicator
 * - Value diff mismatch summary
 *
 * @example
 * ```tsx
 * // Row count diff display
 * <NodeRunsAggregated
 *   rowCountDiff={{ base: 100, curr: 150 }}
 * />
 *
 * // Value diff display
 * <NodeRunsAggregated
 *   valueDiff={{ mismatchedColumns: 2, totalColumns: 10 }}
 * />
 *
 * // Combined display
 * <NodeRunsAggregated
 *   rowCountDiff={{ base: 100, curr: 150 }}
 *   valueDiff={{ mismatchedColumns: 0, totalColumns: 10 }}
 *   isDark={false}
 * />
 * ```
 */
function NodeRunsAggregatedComponent({
  rowCountDiff,
  valueDiff,
  isDark = false,
  "data-testid": testId,
}: NodeRunsAggregatedProps) {
  // No data to display
  if (!rowCountDiff && !valueDiff) {
    return null;
  }

  const tagRootSx = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 16,
    px: 1,
    py: 0.25,
    fontSize: "0.75rem",
    bgcolor: isDark ? "grey.700" : "grey.100",
    color: isDark ? "grey.100" : "inherit",
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      data-testid={testId}
      sx={{ flexWrap: "wrap", gap: 0.5 }}
    >
      {rowCountDiff && (
        <Tooltip
          title={`${rowCountDiff.base ?? "N/A"} → ${rowCountDiff.curr ?? "N/A"} rows`}
        >
          <Box component="span" sx={tagRootSx}>
            <RowCountDisplay data={rowCountDiff} />
          </Box>
        </Tooltip>
      )}

      {valueDiff && (
        <Box
          component="span"
          sx={{
            ...tagRootSx,
            bgcolor:
              valueDiff.mismatchedColumns > 0
                ? isDark
                  ? "error.dark"
                  : "error.light"
                : isDark
                  ? "success.dark"
                  : "success.light",
            color:
              valueDiff.mismatchedColumns > 0 ? "error.main" : "success.main",
          }}
        >
          {valueDiff.mismatchedColumns > 0
            ? `${valueDiff.mismatchedColumns}/${valueDiff.totalColumns} columns differ`
            : "All columns match"}
        </Box>
      )}
    </Stack>
  );
}

export const NodeRunsAggregated = memo(NodeRunsAggregatedComponent);
NodeRunsAggregated.displayName = "NodeRunsAggregated";
