import { Run } from "@/lib/api/types";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  CircularProgress,
  Flex,
  VStack,
} from "@chakra-ui/react";
import { RunResultViewProps } from "./types";
import { Children } from "react";

interface RunViewProps<PT, RT, VO = any> {
  isPending?: boolean;
  run?: Run<PT, RT>;
  error?: Error | null;
  progress?: Run["progress"];
  isAborting?: boolean;
  onCancel?: () => void;
  viewOptions?: VO;
  onViewOptionsChanged?: (viewOptions: VO) => void;
  RunResultView?: React.ComponentType<RunResultViewProps<PT, RT, VO>>;
  children?: <T extends RunResultViewProps<PT, RT, VO>>(
    params: T
  ) => React.ReactNode;
}

export const RunView = <PT, RT>({
  isPending,
  isAborting,
  progress,
  error,
  run,
  onCancel,
  viewOptions,
  onViewOptionsChanged,
  RunResultView,
  children,
}: RunViewProps<PT, RT>) => {
  if (children && RunResultView) {
    throw new Error(
      "RunView requires either a children or a RunResultView prop, but not both."
    );
  }
  if (!children && !RunResultView) {
    throw new Error(
      "RunView requires at least one of children or RunResultView prop."
    );
  }

  const errorMessage = (error as any)?.response?.data?.detail || run?.error;

  if (errorMessage) {
    return (
      <Alert status="error">
        <AlertIcon />
        Error: {errorMessage}
      </Alert>
    );
  }

  if (isPending) {
    let loadingMessage = progress?.message ? progress?.message : "Loading...";

    return (
      <Center p="16px" height="100%" bg="rgb(249,249,249)">
        <VStack>
          <Flex alignItems="center">
            {progress?.percentage === undefined ||
            progress?.percentage === null ? (
              <CircularProgress isIndeterminate size="20px" mr="8px" />
            ) : (
              <CircularProgress
                size="20px"
                value={progress.percentage * 100}
                mr="8px"
              />
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
        No data
      </Center>
    );
  }

  return (
    <Box h="100%" style={{ contain: "size layout" }} overflow="auto">
      {RunResultView && (
        <RunResultView
          run={run}
          viewOptions={viewOptions}
          onViewOptionsChanged={onViewOptionsChanged}
        />
      )}
      {children && children({ run, viewOptions, onViewOptionsChanged })}
    </Box>
  );
};
