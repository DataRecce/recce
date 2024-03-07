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
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { RunView } from "./RunView";
import { RunFormProps, RunResultViewProps } from "./types";
import { formatDistanceToNow } from "date-fns";

interface RunModalProps<PT, RT, VO> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: RunType;
  params: PT;
  initialRun?: Run;
  RunForm?: React.ComponentType<RunFormProps<PT>>;
  RunResultView: React.ComponentType<RunResultViewProps<PT, RT, VO>>;
}

export const RunModal = <PT, RT, VO>({
  isOpen,
  onClose,
  type,
  title,
  params: defaultParams,
  initialRun,
  RunForm,
  RunResultView,
}: RunModalProps<PT, RT, VO>) => {
  const [, setLocation] = useLocation();
  const [runId, setRunId] = useState<string>();
  const [params, setParams] = useState<PT>(defaultParams);
  const [isAborting, setAborting] = useState(false);
  const [isReadyToExecute, setIsReadyToExecute] = useState(false);
  const [progress, setProgress] = useState<Run["progress"]>();
  const [viewOptions, setViewOptions] = useState<VO>();
  const [lastRun, setLastRun] = useState<Run | undefined>(initialRun);

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
    if (isOpen && RunForm === undefined && lastRun === undefined) {
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
    setLastRun(undefined);
  }, [execute]);

  const handleReset = () => {
    setAborting(false);
    setParams(defaultParams);
    setProgress(undefined);
    setLastRun(undefined);
    reset();
  };

  const handleAddToChecklist = useCallback(async () => {
    const runID = lastRun ? lastRun.run_id : run?.run_id;
    if (runID === undefined) {
      return;
    }

    const check = await createCheckByRun(runID, viewOptions);

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [run?.run_id, lastRun, setLocation, queryClient, viewOptions]);

  const handleClose = async () => {
    onClose();
    if (isPending && runId) {
      await cancelRun(runId);
    }
    handleReset();
  };

  const hasResult = !!lastRun?.result || !!run?.result;
  const relativeTime = lastRun?.run_at
    ? formatDistanceToNow(new Date(lastRun.run_at), { addSuffix: true })
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="6xl"
      scrollBehavior="inside"
    >
      <ModalOverlay />
      <ModalContent overflowY="auto" height="75%">
        <ModalHeader>
          {title}
          {!run && !isPending && relativeTime && (
            <Box
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              overflow="hidden"
              fontSize="10pt"
            >
              {relativeTime}
            </Box>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody
          p="0px"
          h="100%"
          overflow="auto"
          borderY="1px solid lightgray"
        >
          {!isPending && !run && !error && !lastRun ? (
            <Box style={{ contain: "layout" }}>
              {RunForm && (
                <RunForm
                  params={params}
                  onParamsChanged={setParams}
                  setIsReadyToExecute={setIsReadyToExecute}
                />
              )}
            </Box>
          ) : (
            <RunView
              isPending={isPending}
              isAborting={isAborting}
              run={lastRun ? lastRun : run}
              error={error}
              progress={progress}
              onCancel={handleCancel}
              viewOptions={viewOptions}
              onViewOptionsChanged={setViewOptions}
              RunResultView={RunResultView}
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Flex gap="10px">
            {hasResult && RunForm && (
              <Button colorScheme="blue" onClick={handleReset}>
                Reset
              </Button>
            )}

            {hasResult && (
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

            {!hasResult && !isPending && (
              <Button
                isDisabled={isPending || !isReadyToExecute}
                colorScheme="blue"
                onClick={handleExecute}
              >
                Execute
              </Button>
            )}

            {hasResult && !RunForm && (
              <Button colorScheme="blue" onClick={handleRerun}>
                Rerun
              </Button>
            )}
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
