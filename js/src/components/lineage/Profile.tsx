import React, { useCallback, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from "@chakra-ui/react";
import { LineageGraphNode } from "./lineage";
import { useLocation } from "wouter";
import { createCheckByRun } from "@/lib/api/checks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProfileDiffResult, submitProfileDiff } from "@/lib/api/profile";
import { ProfileDiffDataGrid } from "./ProfileDiffGrid";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { cancelRun, waitRun } from "@/lib/api/runs";

interface ProfileDiffProp {
  node: LineageGraphNode;
}

export const ProfileDiffModal = ({ node }: ProfileDiffProp) => {
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [, setLocation] = useLocation();
  const [runId, setRunId] = useState<string>();

  const profileDiffFn = async (model: string) => {
    const { run_id } = await submitProfileDiff({ model }, { nowait: true });
    setRunId(run_id);

    return await waitRun(run_id);
  };

  const {
    data: profileResult,
    mutate: runProfileDiff,
    error: error,
    isPending,
  } = useMutation({
    mutationFn: profileDiffFn,
  });

  const handleCancel = useCallback(async () => {
    if (!runId) {
      return;
    }

    return await cancelRun(runId);
  }, [runId]);

  const addToChecklist = useCallback(async () => {
    if (!profileResult?.run_id) {
      return;
    }

    const check = await createCheckByRun(profileResult.run_id);
    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [profileResult?.run_id, setLocation, queryClient]);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent overflowY="auto" height="75%">
          <ModalHeader>Model Profile Diff</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <ProfileDiffDataGrid
              isFetching={isPending}
              result={profileResult?.result as ProfileDiffResult}
              error={error}
              onCancel={handleCancel}
            />
          </ModalBody>
          <ModalFooter>
            <Button mr={3} colorScheme="blue" onClick={addToChecklist}>
              Add to check
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Button
        colorScheme="blue"
        size="sm"
        onClick={() => {
          onOpen();
          runProfileDiff(node.name);
        }}
      >
        Profile Diff
      </Button>
    </>
  );
};
