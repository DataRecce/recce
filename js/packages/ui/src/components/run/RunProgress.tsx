"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { memo, type ReactNode } from "react";
import { type RunStatus, RunStatusBadge } from "./RunStatusBadge";

/**
 * Progress variant types
 */
export type RunProgressVariant = "spinner" | "linear" | "circular";

/**
 * Props for the RunProgress component
 */
export interface RunProgressProps {
  /** Run status */
  status: RunStatus;
  /** Progress percentage (0-100) for determinate progress */
  progress?: number;
  /** Progress message (e.g., "Querying base...") */
  message?: string;
  /** Error message when status is 'failed' */
  errorMessage?: string;
  /** Progress display variant */
  variant?: RunProgressVariant;
  /** Show status badge */
  showStatus?: boolean;
  /** Optional icon to display */
  icon?: ReactNode;
  /** Optional CSS class */
  className?: string;
}

/**
 * RunProgress Component
 *
 * A pure presentation component for displaying run progress with
 * optional progress bar, message, and status.
 *
 * @example Basic spinner
 * ```tsx
 * import { RunProgress } from '@datarecce/ui/primitives';
 *
 * function RunningIndicator({ run }) {
 *   return (
 *     <RunProgress
 *       status={run.status}
 *       message="Executing query..."
 *     />
 *   );
 * }
 * ```
 *
 * @example With progress bar
 * ```tsx
 * <RunProgress
 *   status="running"
 *   variant="linear"
 *   progress={65}
 *   message="Processing records: 65,000 / 100,000"
 * />
 * ```
 *
 * @example Error state
 * ```tsx
 * <RunProgress
 *   status="failed"
 *   errorMessage="Connection timeout after 30 seconds"
 * />
 * ```
 */
function RunProgressComponent({
  status,
  progress,
  message,
  errorMessage,
  variant = "spinner",
  showStatus = true,
  icon,
  className,
}: RunProgressProps) {
  const isRunning = status === "running";
  const isFailed = status === "failed";
  const hasProgress = progress !== undefined && progress >= 0;

  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        p: 3,
        textAlign: "center",
      }}
    >
      {/* Icon or Progress indicator */}
      {icon ? (
        <Box sx={{ fontSize: 40, color: "text.secondary" }}>{icon}</Box>
      ) : (
        isRunning && (
          <>
            {variant === "spinner" && (
              <CircularProgress size={40} color="primary" />
            )}
            {variant === "circular" && (
              <CircularProgress
                size={60}
                variant={hasProgress ? "determinate" : "indeterminate"}
                value={progress}
                color="primary"
              />
            )}
          </>
        )
      )}

      {/* Linear progress bar */}
      {isRunning && variant === "linear" && (
        <Box sx={{ width: "100%", maxWidth: 300 }}>
          <LinearProgress
            variant={hasProgress ? "determinate" : "indeterminate"}
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
          {hasProgress && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: "block" }}
            >
              {Math.round(progress)}%
            </Typography>
          )}
        </Box>
      )}

      {/* Status badge */}
      {showStatus && <RunStatusBadge status={status} size="medium" />}

      {/* Message */}
      {message && !isFailed && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}

      {/* Error message */}
      {isFailed && errorMessage && (
        <Box
          sx={{
            p: 2,
            bgcolor: "error.light",
            borderRadius: 1,
            maxWidth: 400,
          }}
        >
          <Typography variant="body2" color="error.contrastText">
            {errorMessage}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export const RunProgress = memo(RunProgressComponent);
RunProgress.displayName = "RunProgress";

/**
 * Props for RunProgressOverlay component
 */
export interface RunProgressOverlayProps extends RunProgressProps {
  /** Whether the overlay is visible */
  visible?: boolean;
  /** Background opacity (0-1) */
  opacity?: number;
}

/**
 * RunProgressOverlay Component
 *
 * A full-container overlay version of RunProgress.
 *
 * @example
 * ```tsx
 * <div style={{ position: 'relative', height: 400 }}>
 *   <YourContent />
 *   <RunProgressOverlay
 *     visible={isLoading}
 *     status="running"
 *     message="Loading data..."
 *   />
 * </div>
 * ```
 */
function RunProgressOverlayComponent({
  visible = true,
  opacity = 0.8,
  ...progressProps
}: RunProgressOverlayProps) {
  if (!visible) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: `rgba(255, 255, 255, ${opacity})`,
        zIndex: 10,
        ".dark &": {
          bgcolor: `rgba(0, 0, 0, ${opacity})`,
        },
      }}
    >
      <RunProgress {...progressProps} />
    </Box>
  );
}

export const RunProgressOverlay = memo(RunProgressOverlayComponent);
RunProgressOverlay.displayName = "RunProgressOverlay";
