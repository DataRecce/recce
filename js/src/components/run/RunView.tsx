import { useIsDark } from "@datarecce/ui/hooks";
import MuiAlert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React, { forwardRef } from "react";
import { ErrorBoundary } from "@/components/errorboundary/ErrorBoundary";
import {
  RefTypes,
  RegistryEntry,
  ViewOptionTypes,
} from "@/components/run/registry";
// Import Run from OSS types for proper discriminated union support
import type { Run } from "@/lib/api/types";
import ResultErrorFallback from "@/lib/result/ResultErrorFallback";
import { RunResultViewProps } from "./types";

// Define an error type
interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

interface RunViewProps<VO = ViewOptionTypes> {
  isRunning?: boolean;
  run?: Run;
  error?: Error | null;
  progress?: Run["progress"];
  isAborting?: boolean;
  isCheckDetail?: boolean;
  onCancel?: () => void;
  onExecuteRun?: () => void;
  viewOptions?: VO;
  onViewOptionsChanged?: (viewOptions: VO) => void;
  RunResultView?: RegistryEntry["RunResultView"] | undefined;
  children?: (params: RunResultViewProps) => React.ReactNode;
}

export const RunView = forwardRef(
  (
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
      onExecuteRun,
    }: RunViewProps,
    ref: React.Ref<RefTypes>,
  ) => {
    const isDark = useIsDark();
    const errorMessage =
      (error as ApiError | undefined)?.response?.data?.detail ?? run?.error;

    if (errorMessage) {
      return (
        <MuiAlert severity="error">
          Error: <span className="no-track-pii-safe">{errorMessage}</span>
        </MuiAlert>
      );
    }

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

    return (
      <Box
        sx={{
          height: "100%",
          contain: "layout",
          overflow: "auto",
        }}
        className="no-track-pii-safe"
      >
        {RunResultView && (run.error ?? run.result) && (
          <ErrorBoundary fallback={ResultErrorFallback}>
            <RunResultView
              ref={ref}
              run={run}
              viewOptions={viewOptions}
              onViewOptionsChanged={onViewOptionsChanged}
            />
          </ErrorBoundary>
        )}
        {children?.({ run, viewOptions, onViewOptionsChanged })}
      </Box>
    );
  },
);
