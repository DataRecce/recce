"use client";

/**
 * @file run/RunView.tsx
 * @description Generic run view component for displaying run execution state and results.
 *
 * This component provides:
 * - Loading state with progress indicator
 * - Error state display
 * - Run result rendering via RunResultView component or children render prop
 * - Dependency injection for error boundaries (OSS uses Sentry, others can use custom)
 *
 * @example Basic usage with RunResultView
 * ```tsx
 * import { RunView } from "@datarecce/ui/components/run";
 * import { QueryResultView } from "./QueryResultView";
 *
 * function MyComponent() {
 *   return (
 *     <RunView
 *       run={run}
 *       isRunning={isRunning}
 *       RunResultView={QueryResultView}
 *       onCancel={handleCancel}
 *     />
 *   );
 * }
 * ```
 *
 * @example With children render prop
 * ```tsx
 * <RunView run={run} isRunning={isRunning}>
 *   {({ run, viewOptions, onViewOptionsChanged }) => (
 *     <CustomResultView run={run} viewOptions={viewOptions} />
 *   )}
 * </RunView>
 * ```
 *
 * @example With error boundary injection (OSS pattern)
 * ```tsx
 * import { ErrorBoundary } from "@datarecce/ui/components/errorboundary";
 * import ResultErrorFallback from "@datarecce/ui/lib/result/ResultErrorFallback";
 *
 * <RunView
 *   run={run}
 *   ErrorBoundary={ErrorBoundary}
 *   errorBoundaryFallback={ResultErrorFallback}
 * />
 * ```
 */

import MuiAlert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type {
  ComponentType,
  ForwardRefExoticComponent,
  ReactNode,
  Ref,
  RefAttributes,
} from "react";
import { forwardRef } from "react";

import type { Run } from "../../api";
import { useIsDark } from "../../hooks";
import type { RunResultViewProps } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * API error shape for extracting error messages from axios responses.
 */
interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

/**
 * Props for the error boundary wrapper component.
 * Compatible with Sentry ErrorBoundary and custom implementations.
 */
export interface ErrorBoundaryWrapperProps {
  /** The content to wrap with error boundary */
  children: ReactNode;
  /** Fallback to display when an error occurs */
  // biome-ignore lint/suspicious/noExplicitAny: Fallback type varies by implementation (Sentry FallbackRender, React element, etc.)
  fallback?: any;
}

/**
 * Props for the RunView component.
 *
 * Uses permissive types to support various run result view components.
 * Consumers can pass typed RunResultView components and the types will
 * be inferred correctly at the call site.
 */
export interface RunViewProps {
  /** Whether a run is currently executing */
  isRunning?: boolean;

  /** The run object containing execution state and results */
  run?: Run;

  /** Error that occurred during run execution */
  error?: Error | null;

  /** Progress information for the current run */
  progress?: Run["progress"];

  /** Whether the run is being aborted */
  isAborting?: boolean;

  /**
   * Whether this is a check detail view.
   * @deprecated This prop may be removed in future versions.
   */
  isCheckDetail?: boolean;

  /** Callback when user cancels the run */
  onCancel?: () => void;

  /** Callback to execute/re-execute the run */
  onExecuteRun?: () => void;

  /** Current view options for result display */
  // biome-ignore lint/suspicious/noExplicitAny: View options type varies by run type
  viewOptions?: any;

  /** Callback when view options change */
  // biome-ignore lint/suspicious/noExplicitAny: View options type varies by run type
  onViewOptionsChanged?: (viewOptions: any) => void;

  /**
   * Component to render run results.
   * Either RunResultView or children is required.
   */
  RunResultView?: ForwardRefExoticComponent<
    // biome-ignore lint/suspicious/noExplicitAny: RunResultView types vary by run type
    RunResultViewProps<any> & RefAttributes<any>
  >;

  /**
   * Render prop for custom result rendering.
   * Either RunResultView or children is required.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Render prop view options vary by run type
  children?: (params: RunResultViewProps<any>) => ReactNode;

  // ============================================================================
  // Dependency Injection Props
  // ============================================================================

  /**
   * Error boundary component to wrap the result view.
   * If not provided, results are rendered without error boundary.
   *
   * @example Using Sentry ErrorBoundary
   * ```tsx
   * import { ErrorBoundary } from "@sentry/react";
   * <RunView ErrorBoundary={ErrorBoundary} />
   * ```
   */
  ErrorBoundary?: ComponentType<ErrorBoundaryWrapperProps>;

  /**
   * Fallback element/render function for the error boundary.
   * Type depends on the ErrorBoundary implementation used.
   *
   * @example Using Sentry FallbackRender
   * ```tsx
   * import ResultErrorFallback from "@datarecce/ui/lib/result/ResultErrorFallback";
   * <RunView errorBoundaryFallback={ResultErrorFallback} />
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: Fallback type varies by error boundary implementation
  errorBoundaryFallback?: any;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Generic run view component that displays run execution state and results.
 *
 * States:
 * 1. **Error state**: Shows error message from API response or run.error
 * 2. **Running state**: Shows loading spinner with progress and cancel button
 * 3. **Loading state**: Shows spinner when run is undefined
 * 4. **Result state**: Renders RunResultView or children with run results
 *
 * @remarks
 * The component uses forwardRef to pass refs to the RunResultView component,
 * enabling features like screenshot capture for data grids.
 *
 * @example
 * ```tsx
 * const ref = useRef<DataGridHandle>(null);
 *
 * <RunView
 *   ref={ref}
 *   run={run}
 *   RunResultView={QueryResultView}
 *   viewOptions={viewOptions}
 *   onViewOptionsChanged={setViewOptions}
 * />
 * ```
 */
export const RunView = forwardRef<unknown, RunViewProps>(function RunView(
  {
    isRunning,
    isAborting,
    progress,
    error,
    run,
    onCancel,
    viewOptions,
    onViewOptionsChanged,
    RunResultView,
    children,
    ErrorBoundary,
    errorBoundaryFallback,
  },
  ref,
) {
  const isDark = useIsDark();
  const errorMessage =
    (error as ApiError | undefined)?.response?.data?.detail ?? run?.error;

  // ============================================================================
  // Error State
  // ============================================================================
  if (errorMessage) {
    return (
      <MuiAlert severity="error">
        Error: <span className="no-track-pii-safe">{errorMessage}</span>
      </MuiAlert>
    );
  }

  // ============================================================================
  // Running State
  // ============================================================================
  if (isRunning ?? run?.status === "running") {
    let loadingMessage = "Loading...";
    if (progress?.message) {
      loadingMessage = progress.message;
    } else if (run?.progress?.message) {
      loadingMessage = run.progress.message;
    }

    const progressValue =
      progress?.percentage != null ? progress.percentage * 100 : undefined;

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: "1rem",
          height: "100%",
          bgcolor: isDark ? "grey.900" : "grey.50",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1}>
            {progressValue == null ? (
              <CircularProgress size={32} />
            ) : (
              <Box sx={{ position: "relative", display: "inline-flex" }}>
                <CircularProgress
                  variant="determinate"
                  value={progressValue}
                  size={32}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: "absolute",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{ fontSize: "0.6rem" }}
                  >
                    {`${Math.round(progressValue)}%`}
                  </Typography>
                </Box>
              </Box>
            )}

            {isAborting ? (
              <Typography>Aborting...</Typography>
            ) : (
              <Typography className="no-track-pii-safe">
                {loadingMessage}
              </Typography>
            )}
          </Stack>
          {!isAborting && (
            <Button variant="contained" onClick={onCancel} size="small">
              Cancel
            </Button>
          )}
        </Stack>
      </Box>
    );
  }

  // ============================================================================
  // Loading State (No Run Yet)
  // ============================================================================
  if (!run) {
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
        <CircularProgress size={32} />
      </Box>
    );
  }

  // ============================================================================
  // Validation
  // ============================================================================
  if (children && RunResultView) {
    throw new Error(
      "RunView requires either a children or a RunResultView prop, but not both.",
    );
  }
  if (!children && !RunResultView) {
    throw new Error(
      "RunView requires at least one of children or RunResultView prop.",
    );
  }

  // ============================================================================
  // Result State
  // ============================================================================

  /**
   * Renders the result content, optionally wrapped with an error boundary.
   */
  const renderResultContent = () => {
    const resultView =
      RunResultView && (run.error ?? run.result) ? (
        <RunResultView
          ref={ref}
          run={run}
          viewOptions={viewOptions}
          onViewOptionsChanged={onViewOptionsChanged}
        />
      ) : null;

    const childContent = children?.({ run, viewOptions, onViewOptionsChanged });

    // If ErrorBoundary is provided, wrap the content
    if (ErrorBoundary && resultView) {
      return (
        <>
          <ErrorBoundary fallback={errorBoundaryFallback}>
            {resultView}
          </ErrorBoundary>
          {childContent}
        </>
      );
    }

    // Otherwise render without error boundary
    return (
      <>
        {resultView}
        {childContent}
      </>
    );
  };

  return (
    <Box
      sx={{
        height: "100%",
        contain: "layout",
        overflow: "auto",
      }}
      className="no-track-pii-safe"
    >
      {renderResultContent()}
    </Box>
  );
});

// Set display name for debugging
RunView.displayName = "RunView";
