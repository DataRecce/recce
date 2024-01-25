import { cacheKeys } from "@/lib/api/cacheKeys";
import { createCheckByRun } from "@/lib/api/checks";
import { cancelRun, submitRun, waitRun } from "@/lib/api/runs";
import { Run, RunType } from "@/lib/api/types";

import {
  Box,
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { RunView } from "./RunView";
import { RunEditViewProps, RunResultViewProps } from "./types";

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
    error,
    isPending,
  } = useMutation({
    mutationFn: submitRunFn,
  });

  useEffect(() => {
    if (isOpen && RunEditView === undefined) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
            {!isPending && !run && !error ? (
              <Box style={{ contain: "size layout" }}>
                {RunEditView && (
                  <RunEditView params={params} onParamsChanged={setParams} />
                )}
              </Box>
            ) : (
              <RunView
                isPending={isPending}
                isAborting={isAborting}
                run={run}
                error={error}
                progress={progress}
                onCancel={handleCancel}
                RunResultView={RunResultView}
              />
            )}
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
