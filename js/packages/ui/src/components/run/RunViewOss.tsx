"use client";

/**
 * @file run/RunViewOss.tsx
 * @description OSS wrapper for RunView component with Sentry error boundary injection.
 *
 * This thin wrapper imports the base RunView from @datarecce/ui and injects
 * OSS-specific dependencies:
 * - ErrorBoundary: Sentry error boundary for error tracking
 * - ResultErrorFallback: Error fallback component for run results
 *
 * @example
 * ```tsx
 * import { RunViewOss } from "@datarecce/ui/components/run";
 * import { QueryResultView } from "./QueryResultView";
 *
 * function MyComponent() {
 *   return (
 *     <RunViewOss
 *       run={run}
 *       isRunning={isRunning}
 *       RunResultView={QueryResultView}
 *       onCancel={handleCancel}
 *     />
 *   );
 * }
 * ```
 */

import type { ReactNode, Ref } from "react";
import { forwardRef } from "react";
import type { Run } from "../../api";
import ResultErrorFallback from "../../lib/result/ResultErrorFallback";
import { ErrorBoundary } from "../errorboundary";
import {
  RunView as BaseRunView,
  type RunViewProps as BaseRunViewProps,
} from "./RunView";
import {
  RefTypes,
  RegistryEntry,
  RunResultViewProps,
  ViewOptionTypes,
} from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * OSS-specific RunView props using OSS types for backward compatibility.
 *
 * @typeParam VO - View options type (defaults to ViewOptionTypes union)
 */
export interface RunViewOssProps<VO = ViewOptionTypes> {
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
  viewOptions?: VO;

  /** Callback when view options change */
  onViewOptionsChanged?: (viewOptions: VO) => void;

  /**
   * Component to render run results.
   * Either RunResultView or children is required.
   */
  RunResultView?: RegistryEntry["RunResultView"];

  /**
   * Render prop for custom result rendering.
   * Either RunResultView or children is required.
   */
  children?: (params: RunResultViewProps<ViewOptionTypes>) => ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * OSS RunView component with Sentry error boundary pre-injected.
 *
 * This is a thin wrapper around the base RunView from @datarecce/ui that
 * injects OSS-specific error handling via Sentry.
 *
 * States:
 * 1. **Error state**: Shows error message from API response or run.error
 * 2. **Running state**: Shows loading spinner with progress and cancel button
 * 3. **Loading state**: Shows spinner when run is undefined
 * 4. **Result state**: Renders RunResultView or children with run results,
 *    wrapped in Sentry error boundary for crash reporting
 *
 * @example
 * ```tsx
 * const ref = useRef<DataGridHandle>(null);
 *
 * <RunViewOss
 *   ref={ref}
 *   run={run}
 *   RunResultView={QueryResultView}
 *   viewOptions={viewOptions}
 *   onViewOptionsChanged={setViewOptions}
 * />
 * ```
 */
export const RunViewOss = forwardRef<RefTypes, RunViewOssProps>(
  function RunViewOss(props, ref) {
    // Cast to base props for compatibility
    const baseProps: BaseRunViewProps = {
      ...props,
      ErrorBoundary,
      errorBoundaryFallback: ResultErrorFallback,
    };

    return <BaseRunView {...baseProps} ref={ref as Ref<unknown>} />;
  },
);

// Set display name for debugging
RunViewOss.displayName = "RunViewOss";
