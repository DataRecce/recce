import { Run } from "@/lib/api/types";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  CircularProgress,
  ComponentWithAs,
  Flex,
  VStack,
  forwardRef,
} from "@chakra-ui/react";
import { RunResultViewProps } from "./types";
import { ErrorBoundary } from "@sentry/react";
import { ElementType } from "react";

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
  RunResultView?: ComponentWithAs<ElementType, RunResultViewProps<PT, RT, VO>>;
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
    const errorMessage = (error as any)?.response?.data?.detail || run?.error;

    if (errorMessage) {
      return (
        <Alert status="error">
          <AlertIcon />
          Error: {errorMessage}
        </Alert>
      );
    }

    if (isRunning !== undefined ? isRunning : run?.status === "running") {
      const loadingMessage = progress?.message
        ? progress.message
        : run?.progress?.message
          ? run.progress.message
          : "Loading...";

      return (
        <Center p="16px" height="100%" bg="rgb(249,249,249)">
          <VStack>
            <Flex alignItems="center">
              {progress?.percentage === undefined || progress.percentage === null ? (
                <CircularProgress isIndeterminate size="20px" mr="8px" />
              ) : (
                <CircularProgress size="20px" value={progress.percentage * 100} mr="8px" />
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
      <Box h="100%" style={{ contain: "size layout" }} overflow="auto">
        {RunResultView && (run.error || run.result) && (
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
