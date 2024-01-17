import { cacheKeys } from "@/lib/api/cacheKeys";
import { createCheckByRun } from "@/lib/api/checks";
import { cancelRun, submitRun, waitRun } from "@/lib/api/runs";
import { Run, RunType } from "@/lib/api/types";
import { AddIcon } from "@chakra-ui/icons";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  CircularProgress,
  Flex,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Spinner,
  Tooltip,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { set } from "lodash";
import { useCallback, useEffect, useState } from "react";
import { useEdges } from "reactflow";
import { useLocation } from "wouter";

export interface RunEditViewProps<PT> {
  params: PT;
  onParamsChanged: (params: PT) => void;
}

export interface RunResultViewProps<PT, RT> {
  run: Run<PT, RT>;
}

interface RunModalProps<PT, RT> {
  title: string;
  type: RunType;
  params: PT;
  RunEditView?: React.ComponentType<RunEditViewProps<PT>>;
  RunResultView: React.ComponentType<RunResultViewProps<PT, RT>>;
}

export const RunModal = <PT, RT>({
  type,
  title,
  params: defaultParams,
  RunEditView,
  RunResultView,
}: RunModalProps<PT, RT>) => {
  const [, setLocation] = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [runId, setRunId] = useState<string>();
  const [params, setParams] = useState<PT>(defaultParams);
  const [isAborting, setAborting] = useState(false);
  const [progress, setProgress] = useState<Run["progress"]>();

  const submitRunFn = async () => {
    const { run_id } = await submitRun<PT, RT>(type, params, { nowait: true });

    setRunId(run_id);

    while (true) {
      const run = await waitRun(run_id, 2);
      setProgress(run.progress);
      if (run.result || run.error) {
        setAborting(false);
        setProgress(undefined);
        return run;
      }
    }
  };

  const {
    data: run,
    mutate: execute,
    reset,
    error: error,
    isPending,
  } = useMutation({
    mutationFn: submitRunFn,
  });

  useEffect(() => {
    if (isOpen && RunEditView === undefined) {
      execute();
    }
  }, [isOpen, RunEditView]);

  const queryClient = useQueryClient();

  const handleCancel = useCallback(async () => {
    setAborting(true);
    if (!runId) {
      return;
    }

    return await cancelRun(runId);
  }, [runId]);

  const handleExecute = useCallback(() => {
    execute();
  }, [execute]);

  const handleRerun = useCallback(() => {
    execute();
  }, [execute]);

  const handleReset = () => {
    setAborting(false);
    setParams(defaultParams);
    setProgress(undefined);
    reset();
  };

  const handleAddToChecklist = useCallback(async () => {
    if (!run?.run_id) {
      return;
    }

    const check = await createCheckByRun(run.run_id);

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [run?.run_id, setLocation, queryClient]);

  const handleClose = async () => {
    onClose();
    if (isPending && runId) {
      await cancelRun(runId);
    }
    handleReset();
  };

  const RunModalBody = () => {
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
              <Button onClick={handleCancel} colorScheme="blue" size="sm">
                Cancel
              </Button>
            )}
          </VStack>
        </Center>
      );
    }

    if (!run) {
      return (
        <Box style={{ contain: "size layout" }}>
          {RunEditView && (
            <RunEditView params={params} onParamsChanged={setParams} />
          )}
        </Box>
      );
    }

    return (
      <Box h="100%" style={{ contain: "size layout" }}>
        <RunResultView run={run} />
      </Box>
    );
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} size="6xl">
        <ModalOverlay />
        <ModalContent overflowY="auto" height="75%">
          <ModalHeader>{title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody
            p="0px"
            h="100%"
            overflow="auto"
            borderY="1px solid lightgray"
          >
            <RunModalBody />
          </ModalBody>
          <ModalFooter>
            <Flex gap="10px">
              {run && RunEditView && (
                <Button colorScheme="blue" onClick={handleReset}>
                  Reset
                </Button>
              )}

              {run?.result && (
                <>
                  <Button colorScheme="blue" onClick={handleAddToChecklist}>
                    Add to checklist
                  </Button>
                </>
              )}

              {isPending && (
                <Button
                  onClick={handleCancel}
                  isDisabled={isAborting}
                  colorScheme="blue"
                >
                  Cancel
                </Button>
              )}

              {!run && !isPending && (
                <Button
                  isDisabled={isPending}
                  colorScheme="blue"
                  onClick={handleExecute}
                >
                  Execute
                </Button>
              )}

              {run && !RunEditView && (
                <Button colorScheme="blue" onClick={handleRerun}>
                  Rerun
                </Button>
              )}
            </Flex>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Button colorScheme="blue" size="sm" onClick={onOpen}>
        {title}
      </Button>
    </>
  );
};
