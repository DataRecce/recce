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

interface RunViewProps<PT, RT, VO = any> {
  isPending?: boolean;
  run?: Run<PT, RT>;
  error?: Error;
  progress?: Run["progress"];
  isAborting?: boolean;
  onCancel: () => void;
  viewOptions?: VO;
  onViewOptionsChanged?: (viewOptions: VO) => void;
  RunResultView: React.ComponentType<RunResultViewProps<PT, RT, VO>>;
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
}: RunViewProps<PT, RT>) => {
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
      <Center p="16px" height="100%">
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
    return <>No data</>;
  }

  return (
    <Box h="100%" style={{ contain: "size layout" }}>
      <RunResultView
        run={run}
        viewOptions={viewOptions}
        onViewOptionsChanged={onViewOptionsChanged}
      />
    </Box>
  );
};
