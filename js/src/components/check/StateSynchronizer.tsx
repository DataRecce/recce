import {
  Box,
  Button,
  Icon,
  IconButton,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Spinner,
  Stack,
  Tooltip,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { TfiCloudDown, TfiCloudUp, TfiReload } from "react-icons/tfi";
import { syncState, isStateSyncing, SyncStateInput } from "@/lib/api/state";
import { useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useLocation } from "wouter";
import { InfoIcon, InfoOutlineIcon } from "@chakra-ui/icons";

function isCheckDetailPage(href: string): boolean {
  const pattern =
    /^\/checks\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
  return pattern.test(href);
}

export function StateSpinner() {
  return (
    <Tooltip label="Loading">
      <Button pt="6px" variant="unstyled" boxSize={"1.2em"}>
        <Spinner />
      </Button>
    </Tooltip>
  );
}

export function StateSynchronizer() {
  const [isSyncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [syncOption, setSyncOption] = useState("");
  const toast = useToast();

  const checkSyncStatus = useCallback(async () => {
    if (await isStateSyncing()) {
      return;
    }

    toast({
      description: "Sync Completed",
      status: "success",
      variant: "left-accent",
      position: "bottom",
      duration: 5000,
      isClosable: true,
    });

    setSyncing(false);
    setSyncOption("");

    // Refresh the lineage graph and checks
    queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
  }, [setSyncing, queryClient, toast]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isSyncing) {
      intervalId = setInterval(checkSyncStatus, 500);
    }

    return () => {
      if (intervalId) {
        if (isCheckDetailPage(location)) {
          setLocation("/checks");
        }
        clearInterval(intervalId);
      }
    };
  }, [isSyncing, checkSyncStatus, setLocation, location]);

  const requestSyncStatus = useCallback(
    async (input: SyncStateInput) => {
      setSyncing(true);
      onClose();
      if ((await isStateSyncing()) === false) {
        const response = await syncState(input);
        if (response.status === "conflict") {
          onOpen();
        } else {
          setSyncing(true);
        }
      }
    },
    [onClose, onOpen, setSyncing]
  );

  if (isSyncing) return <StateSpinner />;
  return (
    <>
      <Tooltip label="Sync with Cloud">
        <IconButton
          pt="6px"
          variant="unstyled"
          aria-label="Sync state"
          onClick={() => requestSyncStatus({})}
          icon={<Icon as={TfiReload} boxSize={"1.2em"} />}
        />
      </Tooltip>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="lg" fontWeight="bold">
            Sync with Cloud
          </ModalHeader>
          <ModalBody>
            <Box>
              New changes have been detected in the cloud. Please choose a
              method to sync your state
            </Box>
            <Box mt="5px">
              <RadioGroup onChange={setSyncOption} value={syncOption}>
                <Stack direction="column">
                  {/* Merge */}
                  <Radio value="merge">
                    Merge
                    <Tooltip label="This will merge the local and remote states.">
                      <span>
                        <Icon as={InfoOutlineIcon} ml={2} cursor="pointer" />
                      </span>
                    </Tooltip>
                  </Radio>

                  {/* Overwrite */}
                  <Radio value="overwrite">
                    Overwrite
                    <Tooltip label="This will overwrite the remote state file with the local state.">
                      <span>
                        <Icon as={InfoOutlineIcon} ml={2} cursor="pointer" />
                      </span>
                    </Tooltip>
                  </Radio>

                  {/* Revert */}
                  <Radio value="revert">
                    Revert
                    <Tooltip label="This will discard local changes and revert to the cloud state.">
                      <span>
                        <Icon as={InfoOutlineIcon} ml={2} cursor="pointer" />
                      </span>
                    </Tooltip>
                  </Radio>
                </Stack>
              </RadioGroup>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} mr={3}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => requestSyncStatus({ method: syncOption as any })}
              isDisabled={!syncOption} // Disable button until an option is selected
            >
              Sync
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export function StateCloudUploader() {
  return (
    <Tooltip label="Upload to Cloud">
      <IconButton
        pt="6px"
        variant="unstyled"
        aria-label="Upload state"
        icon={<Icon as={TfiCloudUp} boxSize={"1.2em"} />}
      />
    </Tooltip>
  );
}

export function StateCloudDownloader() {
  return (
    <Tooltip label="Download from Cloud">
      <IconButton
        pt="6px"
        variant="unstyled"
        aria-label="Download state"
        icon={<Icon as={TfiCloudDown} boxSize={"1.2em"} />}
      />
    </Tooltip>
  );
}
