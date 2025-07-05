import { Run } from "@/lib/api/types";
import { Alert, Box, Button, Center, Flex, ProgressCircle, VStack } from "@chakra-ui/react";
import { RunResultViewProps } from "./types";
import { ErrorBoundary } from "@sentry/react";
import React, { forwardRef, ForwardRefExoticComponent, RefAttributes } from "react";

interface RunViewProps<PT, RT, VO = any> {
  isRunning?: boolean;
  run?: Run<PT, RT>;
  error?: Error | null;
  progress?: Run["progress"];
  isAborting?: boolean;
  isCheckDetail?: boolean;
  onCancel?: () => void;
  onExecuteRun?: () => void;
  viewOptions?: VO;
  onViewOptionsChanged?: (viewOptions: VO) => void;
  RunResultView?: ForwardRefExoticComponent<
    RunResultViewProps<PT, RT, VO> & RefAttributes<unknown>
  >;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  children?: <T extends RunResultViewProps<PT, RT, VO>>(params: T) => React.ReactNode;
}

export const RunView = forwardRef(
  <PT, RT>(
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
    }: RunViewProps<PT, RT>,
    ref: any,
  ) => {
    const errorMessage = (error as any)?.response?.data?.detail ?? run?.error;

    if (errorMessage) {
      return (
        <Alert.Root status="error" title={`Error: ${errorMessage}`}>
          <Alert.Indicator />
          <Alert.Title>Error: {errorMessage}</Alert.Title>
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
        <Center p="16px" height="100%" bg="rgb(249,249,249)">
          <VStack>
            <Flex alignItems="center">
              {progress?.percentage == null ? (
                <ProgressCircle.Root value={null} size="md" mr="8px">
                  <ProgressCircle.Circle />
                </ProgressCircle.Root>
              ) : (
                <ProgressCircle.Root value={progress.percentage * 100} size="md" mr="8px">
                  <ProgressCircle.Circle />
                </ProgressCircle.Root>
              )}

              {isAborting ? <>Aborting...</> : <>{loadingMessage}</>}
            </Flex>
            {!isAborting && (
              <Button onClick={onCancel} colorScheme="blue" size="sm">
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
      throw new Error("RunView requires either a children or a RunResultView prop, but not both.");
    }
    if (!children && !RunResultView) {
      throw new Error("RunView requires at least one of children or RunResultView prop.");
    }

    return (
      <Box
        h="100%"
        style={{ contain: "size layout" }}
        overflow="auto"
        className="no-track-pii-safe">
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
