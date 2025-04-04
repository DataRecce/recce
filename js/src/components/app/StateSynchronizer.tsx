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
import { useCallback, useState } from "react";
import { TfiCloudDown, TfiCloudUp, TfiReload } from "react-icons/tfi";
import { syncState, isStateSyncing, SyncStateInput } from "@/lib/api/state";
import { useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useLocation } from "wouter";
import { InfoOutlineIcon } from "@chakra-ui/icons";
import { IconSync } from "../icons";

function isCheckDetailPage(href: string): boolean {
  const pattern =
    /^\/checks\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
  return pattern.test(href);
}

export function StateSpinner() {
  return (
    <Tooltip label="Syncing">
      <Button pt="6px" variant="unstyled" boxSize={"1em"}>
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

  const handleSync = useCallback(
    async (input: SyncStateInput) => {
      onClose();
      setSyncing(true);

      const response = await syncState(input);
      if (response.status === "conflict") {
        onOpen();
        setSyncing(false);
        return;
      }

      while (await isStateSyncing()) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
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

      await queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });

      if (isCheckDetailPage(location)) {
        setLocation("/checks");
      }
    },
    [queryClient, location, setLocation, toast, onOpen, onClose],
  );

  if (isSyncing) return <StateSpinner />;
  return (
    <>
      <Tooltip label="Sync with Cloud">
        <IconButton
          size="sm"
          variant="unstyled"
          aria-label="Sync state"
          onClick={() => handleSync({})}
          icon={<Icon as={IconSync} verticalAlign="middle" boxSize={"16px"} />}
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
              New changes have been detected in the cloud. Please choose a method to sync your state
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
              onClick={() => handleSync({ method: syncOption as any })}
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
