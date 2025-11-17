import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Icon,
  IconButton,
  Portal,
  RadioGroup,
  Spinner,
  Stack,
  useDisclosure,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import { PiInfo } from "react-icons/pi";
import { useLocation } from "wouter";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { isStateSyncing, SyncStateInput, syncState } from "@/lib/api/state";
import { useRecceInstanceInfo } from "@/lib/hooks/useRecceInstanceInfo";
import { IconSync } from "../icons";

function isCheckDetailPage(href: string): boolean {
  const pattern =
    /^\/checks\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
  return pattern.test(href);
}

export function StateSpinner() {
  return (
    <Tooltip content="Syncing">
      <Box mx="10px">
        <Spinner size="sm" />
      </Box>
    </Tooltip>
  );
}

export function StateSynchronizer() {
  const [isSyncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const { open, onOpen, onClose } = useDisclosure();
  const [syncOption, setSyncOption] = useState<
    "overwrite" | "revert" | "merge" | ""
  >("");
  const { data: instanceInfo } = useRecceInstanceInfo();

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

      toaster.create({
        description: "Sync Completed",
        type: "success",
        duration: 5000,
        closable: true,
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
    [queryClient, location, setLocation, onOpen, onClose],
  );

  if (isSyncing) return <StateSpinner />;
  return (
    <>
      <Tooltip content="Sync with Cloud">
        <IconButton
          size="sm"
          variant="plain"
          aria-label="Sync state"
          onClick={() =>
            handleSync(instanceInfo?.session_id ? { method: "merge" } : {})
          }
        >
          <Icon as={IconSync} verticalAlign="middle" boxSize={"16px"} />
        </IconButton>
      </Tooltip>
      <Dialog.Root open={open} onOpenChange={onClose}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header fontSize="lg" fontWeight="bold">
                <Dialog.Title>Sync with Cloud</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Box>
                  New changes have been detected in the cloud. Please choose a
                  method to sync your state
                </Box>
                <Box mt="5px">
                  <RadioGroup.Root
                    onValueChange={(e) => {
                      setSyncOption(
                        e.value as "merge" | "overwrite" | "revert",
                      );
                    }}
                    value={syncOption}
                  >
                    <Stack direction="column">
                      {/* Merge */}
                      <RadioGroup.Item value="merge">
                        <RadioGroup.ItemHiddenInput />
                        <RadioGroup.ItemIndicator />
                        <RadioGroup.ItemText>
                          Merge
                          <Tooltip content="This will merge the local and remote states.">
                            <span>
                              <Icon as={PiInfo} ml={2} cursor="pointer" />
                            </span>
                          </Tooltip>
                        </RadioGroup.ItemText>
                      </RadioGroup.Item>

                      {/* Overwrite */}
                      <RadioGroup.Item value="overwrite">
                        <RadioGroup.ItemHiddenInput />
                        <RadioGroup.ItemIndicator />
                        <RadioGroup.ItemText>
                          Overwrite
                          <Tooltip content="This will overwrite the remote state file with the local state.">
                            <span>
                              <Icon as={PiInfo} ml={2} cursor="pointer" />
                            </span>
                          </Tooltip>
                        </RadioGroup.ItemText>
                      </RadioGroup.Item>

                      {/* Revert */}
                      <RadioGroup.Item value="revert">
                        <RadioGroup.ItemHiddenInput />
                        <RadioGroup.ItemIndicator />
                        <RadioGroup.ItemText>
                          Revert
                          <Tooltip content="This will discard local changes and revert to the cloud state.">
                            <span>
                              <Icon as={PiInfo} ml={2} cursor="pointer" />
                            </span>
                          </Tooltip>
                        </RadioGroup.ItemText>
                      </RadioGroup.Item>
                    </Stack>
                  </RadioGroup.Root>
                </Box>
              </Dialog.Body>
              <Dialog.Footer>
                <Button onClick={onClose} mr={3}>
                  Cancel
                </Button>
                <Button
                  colorPalette="blue"
                  onClick={() =>
                    handleSync({ method: syncOption || undefined })
                  }
                  disabled={!syncOption} // Disable button until an option is selected
                >
                  Sync
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
