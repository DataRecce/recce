"use client";

/**
 * @file ActionTag.tsx
 * @description Pure presentation component for displaying action status in lineage nodes
 *
 * This component displays the status of an action (pending, running, skipped, error, or result).
 * It is designed to be used with lineage graph nodes and receives all data via props.
 *
 * Source: Simplified from OSS js/src/components/lineage/ActionTag.tsx
 */

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { memo } from "react";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Action status values
 */
export type ActionStatus =
  | "pending"
  | "running"
  | "skipped"
  | "success"
  | "error";

/**
 * Progress information for running actions
 */
export interface ActionProgress {
  /** Progress percentage (0-1) */
  percentage?: number;
  /** Current step description */
  message?: string;
}

/**
 * Value diff result summary
 */
export interface ValueDiffResult {
  /** Number of mismatched columns */
  mismatchedColumns: number;
  /** Total number of columns compared */
  totalColumns: number;
}

/**
 * Row count diff result summary
 */
export interface RowCountDiffResult {
  /** Base row count (null if not available) */
  base: number | null;
  /** Current row count (null if not available) */
  current: number | null;
}

/**
 * Props for ActionTag component
 */
export interface ActionTagProps {
  /** Current status of the action */
  status: ActionStatus;
  /** Skip reason if status is 'skipped' */
  skipReason?: string;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Progress info if status is 'running' */
  progress?: ActionProgress;
  /** Value diff result if this is a value diff action */
  valueDiffResult?: ValueDiffResult;
  /** Row count diff result if this is a row count diff action */
  rowCountDiffResult?: RowCountDiffResult;
  /** Run ID to display as fallback */
  runId?: string;
  /** Test ID for testing */
  "data-testid"?: string;
}

// =============================================================================
// ICON COMPONENTS
// =============================================================================

/**
 * Info icon for tooltips
 */
const InfoIcon = () => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 256 256"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
  </svg>
);

/**
 * Warning icon for error states
 */
const WarningIcon = () => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 256 256"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z" />
  </svg>
);

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * Skipped status display
 */
function SkippedTag({ skipReason }: { skipReason?: string }) {
  return (
    <Chip
      size="small"
      label={
        <Stack
          direction="row"
          sx={{
            fontSize: "10pt",
            color: "grey.500",
            alignItems: "center",
            gap: "3px",
          }}
        >
          <Box>Skipped</Box>
          {skipReason && (
            <Tooltip title={skipReason}>
              <Box component="span" sx={{ display: "flex" }}>
                <InfoIcon />
              </Box>
            </Tooltip>
          )}
        </Stack>
      }
      sx={{ bgcolor: "grey.100" }}
    />
  );
}

/**
 * Error status display
 */
function ErrorTag({ errorMessage }: { errorMessage?: string }) {
  return (
    <Stack
      direction="row"
      sx={{ fontSize: "10pt", color: "gray", alignItems: "center" }}
    >
      <Box>Error</Box>
      {errorMessage && (
        <Tooltip title={errorMessage}>
          <Box component="span" sx={{ display: "flex" }}>
            <WarningIcon />
          </Box>
        </Tooltip>
      )}
    </Stack>
  );
}

/**
 * Value diff result display
 */
function ValueDiffTag({ result }: { result: ValueDiffResult }) {
  const { mismatchedColumns } = result;
  const hasIssues = mismatchedColumns > 0;

  return (
    <Chip
      size="small"
      sx={{
        bgcolor: hasIssues ? "error.light" : "success.light",
      }}
      label={
        <Stack
          direction="row"
          sx={{
            fontSize: "10pt",
            color: hasIssues ? "error.main" : "success.main",
            alignItems: "center",
            gap: "3px",
          }}
        >
          {hasIssues
            ? `${mismatchedColumns} columns mismatched`
            : "All columns match"}
        </Stack>
      }
    />
  );
}

/**
 * Row count diff result display
 */
function RowCountDiffTag({ result }: { result: RowCountDiffResult }) {
  const { base, current } = result;
  const baseLabel = base === null ? "N/A" : base.toLocaleString();
  const currentLabel = current === null ? "N/A" : current.toLocaleString();

  // Determine change direction
  let changeIndicator = "";
  let changeColor = "grey.500";

  if (base !== null && current !== null) {
    if (current > base) {
      changeIndicator = "↑";
      changeColor = "success.main";
    } else if (current < base) {
      changeIndicator = "↓";
      changeColor = "error.main";
    } else {
      changeIndicator = "=";
    }
  }

  return (
    <Chip
      size="small"
      sx={{ bgcolor: "grey.100" }}
      label={
        <Stack
          direction="row"
          sx={{
            fontSize: "10pt",
            alignItems: "center",
            gap: "3px",
          }}
        >
          <Box>{baseLabel}</Box>
          <Box>→</Box>
          <Box>{currentLabel}</Box>
          {changeIndicator && (
            <Box component="span" sx={{ color: changeColor, ml: 0.5 }}>
              {changeIndicator}
            </Box>
          )}
        </Stack>
      }
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * ActionTag - Pure presentation component for action status
 *
 * Displays the current status of an action with appropriate visual feedback:
 * - Pending: Spinner
 * - Running: Progress indicator (indeterminate or percentage)
 * - Skipped: Chip with optional reason tooltip
 * - Error: Error text with optional message tooltip
 * - Success with value diff: Match/mismatch summary
 * - Success with row count diff: Count comparison
 *
 * @example
 * ```tsx
 * // Pending action
 * <ActionTag status="pending" />
 *
 * // Running with progress
 * <ActionTag status="running" progress={{ percentage: 0.5 }} />
 *
 * // Skipped with reason
 * <ActionTag status="skipped" skipReason="No changes detected" />
 *
 * // Value diff result
 * <ActionTag
 *   status="success"
 *   valueDiffResult={{ mismatchedColumns: 2, totalColumns: 10 }}
 * />
 * ```
 */
function ActionTagComponent({
  status,
  skipReason,
  errorMessage,
  progress,
  valueDiffResult,
  rowCountDiffResult,
  runId,
  "data-testid": testId,
}: ActionTagProps) {
  // Pending state
  if (status === "pending") {
    return (
      <CircularProgress size={16} data-testid={testId} data-status="pending" />
    );
  }

  // Skipped state
  if (status === "skipped") {
    return (
      <Box data-testid={testId} data-status="skipped">
        <SkippedTag skipReason={skipReason} />
      </Box>
    );
  }

  // Running state
  if (status === "running") {
    if (progress?.percentage === undefined) {
      return (
        <CircularProgress
          size={16}
          data-testid={testId}
          data-status="running"
        />
      );
    }
    return (
      <CircularProgress
        variant="determinate"
        value={progress.percentage * 100}
        size={16}
        data-testid={testId}
        data-status="running"
      />
    );
  }

  // Error state
  if (status === "error") {
    return (
      <Box data-testid={testId} data-status="error">
        <ErrorTag errorMessage={errorMessage} />
      </Box>
    );
  }

  // Success state with value diff result
  if (valueDiffResult) {
    return (
      <Box data-testid={testId} data-status="success">
        <ValueDiffTag result={valueDiffResult} />
      </Box>
    );
  }

  // Success state with row count diff result
  if (rowCountDiffResult) {
    return (
      <Box data-testid={testId} data-status="success">
        <RowCountDiffTag result={rowCountDiffResult} />
      </Box>
    );
  }

  // Fallback: show run ID
  return (
    <Box data-testid={testId} data-status="success">
      {runId || "Complete"}
    </Box>
  );
}

export const ActionTag = memo(ActionTagComponent);
ActionTag.displayName = "ActionTag";
