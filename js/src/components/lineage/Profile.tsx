import React from "react";
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
import { LineageGraphNode, NodeData } from "./lineage";
import { ValueDiffSummary } from "@/components/check/ValueDiffView";
import { useLocation } from "wouter";
import { createCheckByRun } from "@/lib/api/checks";
import { useMutation } from "@tanstack/react-query";
import { ProfileResult, submitProfile } from "@/lib/api/profile";
import { ProfileDataGrid } from "./ProfileDataGrid";

interface ProfileProp {
  node: LineageGraphNode;
}

async function handleAddToCheck(valueDiff: ValueDiffSummary) {
  if (!valueDiff.runId) {
    return null;
  }
  const check = await createCheckByRun(valueDiff.runId);
  return check.check_id;
}

export const ProfileModal = ({ node }: ProfileProp) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [, setLocation] = useLocation();

  const {
    data: profileResult,
    mutate: runProfile,
    error: error,
    isPending,
  } = useMutation({
    mutationFn: submitProfile,
  });

  // useEffect(() => {
  //   if (mismatchSummary?.params?.model != node.name) {
  //     setMismatchSummary(null);
  //   }
  // }, [node.name]);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent overflowY="auto" height="75%">
          <ModalHeader>Model Profile</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <ProfileDataGrid
              isFetching={isPending}
              result={profileResult?.result as ProfileResult}
              error={error}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              mr={3}
              colorScheme="blue"
              // onClick={async () => {
              //   const checkId = await handleAddToCheck(mismatchSummary);
              //   if (checkId) {
              //     setLocation(`/checks/${checkId}`);
              //   }
              // }}
            >
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
          runProfile({ model: node.name });
        }}
      >
        Model Profile
      </Button>
    </>
  );
};
