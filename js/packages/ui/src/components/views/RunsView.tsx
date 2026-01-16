"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { memo, type ReactNode, useCallback } from "react";
import { RunList, type RunListItemData } from "../run/RunList";
import { RunProgress, type RunProgressProps } from "../run/RunProgress";
import { EmptyState } from "../ui/EmptyState";
import { SplitPane } from "../ui/SplitPane";

/**
 * Props for the RunsView component.
 * Defines options for viewing run history and details.
 */
export interface RunsViewProps {
  /**
   * List of runs to display.
   */
  runs: RunListItemData[];

  /**
   * Loading state.
   */
  isLoading?: boolean;

  /**
   * Error message.
   */
  error?: string;

  /**
   * Currently selected run ID.
   */
  selectedRunId?: string;

  /**
   * Callback when a run is selected.
   */
  onRunSelect?: (runId: string) => void;

  /**
   * Callback when "add to checklist" is clicked.
   */
  onAddToChecklist?: (runId: string) => void;

  /**
   * Callback when "go to check" is clicked.
   */
  onGoToCheck?: (checkId: string) => void;

  /**
   * Function to get icon for a run type.
   * Receives the run type string.
   */
  getRunIcon?: (runType: string) => ReactNode;

  /**
   * Content to display for the selected run.
   * Receives the selected run data.
   */
  renderRunDetail?: (run: RunListItemData) => ReactNode;

  /**
   * Current execution progress (for running items).
   */
  currentProgress?: {
    status: RunProgressProps["status"];
    progress?: number;
    message?: string;
    errorMessage?: string;
  };

  /**
   * Whether to hide "add to checklist" action.
   */
  hideAddToChecklist?: boolean;

  /**
   * Optional height for the view.
   * @default "100%"
   */
  height?: number | string;

  /**
   * Initial split pane size (percentage for list).
   * @default 35
   */
  listPaneSize?: number;

  /**
   * Minimum list pane size in pixels.
   * @default 250
   */
  minListSize?: number;

  /**
   * Maximum list pane size in pixels.
   * @default 500
   */
  maxListSize?: number;

  /**
   * Title for the run list.
   */
  listTitle?: string;

  /**
   * Whether to group runs by date.
   */
  groupByDate?: boolean;

  /**
   * Optional CSS class name.
   */
  className?: string;
}

/**
 * RunsView Component
 *
 * A high-level component for viewing run history with a split-pane
 * layout showing a list on the left and details on the right.
 *
 * @example Basic usage
 * ```tsx
 * import { RunsView } from '@datarecce/ui';
 *
 * function App({ runs }) {
 *   const [selectedId, setSelectedId] = useState<string>();
 *   const selectedRun = runs.find(r => r.id === selectedId);
 *
 *   return (
 *     <RunsView
 *       runs={runs}
 *       selectedRunId={selectedId}
 *       onRunSelect={setSelectedId}
 *       renderRunDetail={(run) => <RunResultDisplay run={run} />}
 *     />
 *   );
 * }
 * ```
 *
 * @example With current progress
 * ```tsx
 * import { RunsView } from '@datarecce/ui';
 *
 * function App({ runs, currentRun }) {
 *   return (
 *     <RunsView
 *       runs={runs}
 *       currentProgress={currentRun ? {
 *         status: currentRun.status,
 *         progress: currentRun.progress,
 *         message: currentRun.statusMessage,
 *       } : undefined}
 *       renderRunDetail={(run) => <RunResult run={run} />}
 *     />
 *   );
 * }
 * ```
 */
function RunsViewComponent({
  runs,
  isLoading = false,
  error,
  selectedRunId,
  onRunSelect,
  onAddToChecklist,
  onGoToCheck,
  getRunIcon,
  renderRunDetail,
  currentProgress,
  hideAddToChecklist = false,
  height = "100%",
  listPaneSize = 35,
  minListSize = 250,
  maxListSize = 500,
  listTitle = "History",
  groupByDate = true,
  className,
}: RunsViewProps) {
  // Find selected run
  const selectedRun = runs.find((r) => r.id === selectedRunId);

  // Handle run selection
  const handleRunSelect = useCallback(
    (runId: string) => {
      onRunSelect?.(runId);
    },
    [onRunSelect],
  );

  // Loading state
  if (isLoading) {
    return (
      <Box
        className={className}
        sx={{
          width: "100%",
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        className={className}
        sx={{
          width: "100%",
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Empty state
  if (runs.length === 0) {
    return (
      <Box
        className={className}
        sx={{
          width: "100%",
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EmptyState
          title="No runs yet"
          description="Run a query or check to see results here."
        />
      </Box>
    );
  }

  return (
    <Box className={className} sx={{ width: "100%", height }}>
      <SplitPane
        direction="horizontal"
        sizes={[listPaneSize, 100 - listPaneSize]}
        minSizes={[minListSize, 200]}
        maxSizes={[maxListSize, Infinity]}
      >
        {/* Left pane: Run list */}
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Show current progress at top if running */}
          {currentProgress && currentProgress.status === "Running" && (
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <RunProgress
                status={currentProgress.status}
                progress={currentProgress.progress}
                message={currentProgress.message}
                variant="linear"
                showStatus
              />
            </Box>
          )}

          <Box sx={{ flex: 1, overflow: "hidden" }}>
            <RunList
              runs={runs}
              selectedId={selectedRunId}
              onRunSelect={handleRunSelect}
              onAddToChecklist={onAddToChecklist}
              onGoToCheck={onGoToCheck}
              getRunIcon={getRunIcon}
              hideAddToChecklist={hideAddToChecklist}
              title={listTitle}
              groupByDate={groupByDate}
            />
          </Box>
        </Box>

        {/* Right pane: Run detail */}
        <Box sx={{ height: "100%", overflow: "auto" }}>
          {selectedRun ? (
            renderRunDetail ? (
              renderRunDetail(selectedRun)
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography variant="h6">
                  {selectedRun.name || selectedRun.type}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {selectedRun.status}
                </Typography>
                {selectedRun.runAt && (
                  <Typography variant="body2" color="text.secondary">
                    Run at: {selectedRun.runAt}
                  </Typography>
                )}
              </Box>
            )
          ) : (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography color="text.secondary">
                Select a run from the list to view details
              </Typography>
            </Box>
          )}
        </Box>
      </SplitPane>
    </Box>
  );
}

/**
 * Memoized RunsView component for performance optimization.
 */
export const RunsView = memo(RunsViewComponent);
RunsView.displayName = "RunsView";
