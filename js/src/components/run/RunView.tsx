import {
  Alert,
  Box,
  Button,
  Center,
  Flex,
  ProgressCircle,
  VStack,
} from "@chakra-ui/react";
import { ErrorBoundary } from "@sentry/react";
import React, {
  ForwardRefExoticComponent,
  forwardRef,
  RefAttributes,
} from "react";
import {
  RefTypes,
  RegistryEntry,
  ViewOptionTypes,
} from "@/components/run/registry";
import { Run } from "@/lib/api/types";
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
    const errorMessage =
      (error as ApiError | undefined)?.response?.data?.detail ?? run?.error;

    if (errorMessage) {
      return (
        <Alert.Root status="error" title={`Error: ${errorMessage}`}>
          <Alert.Indicator />
          <Alert.Title>
            Error: <span className="no-track-pii-safe">{errorMessage}</span>
          </Alert.Title>
        </Alert.Root>
      );
    }

    if (isRunning ?? run?.status === "running") {
      let loadingMessage = "Loading...";
      if (progress?.message) {
        loadingMessage = progress.message;
      } else if (run?.progress?.message) {
        loadingMessage = run.progress.message;
      }

      return (
        <Center p="1rem" height="100%" bg="rgb(249,249,249)">
          <VStack>
            <Flex alignItems="center">
              {progress?.percentage == null ? (
                <ProgressCircle.Root value={null} size="md" mr="0.5rem">
                  <ProgressCircle.Circle />
                </ProgressCircle.Root>
              ) : (
                <ProgressCircle.Root
                  value={progress.percentage * 100}
                  size="md"
                  mr="0.5rem"
                >
                  <ProgressCircle.Circle />
                </ProgressCircle.Root>
              )}

              {isAborting ? (
                <span>Aborting...</span>
              ) : (
                <span className="no-track-pii-safe">{loadingMessage}</span>
              )}
            </Flex>
            {!isAborting && (
              <Button onClick={onCancel} colorPalette="blue" size="sm">
                Cancel
              </Button>
            )}
          </VStack>
        </Center>
      );
    }

    if (!run) {
      return (
        <Center bg="rgb(249,249,249)" height="100%">
          Loading...
        </Center>
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
        h="100%"
        style={{ contain: "size layout" }}
        overflow="auto"
        className="no-track-pii-safe"
      >
        {RunResultView && (run.error ?? run.result) && (
          <ErrorBoundary>
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
