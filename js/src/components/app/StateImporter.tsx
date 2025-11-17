import {
  Button,
  CloseButton,
  Dialog,
  Flex,
  Icon,
  IconButton,
  Portal,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import React, { ChangeEvent, useCallback, useRef, useState } from "react";
import { PiInfo } from "react-icons/pi";
import { useLocation } from "wouter";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { importState } from "@/lib/api/state";
import { trackStateAction } from "@/lib/api/track";
import {
  useLineageGraphContext,
  useRunsAggregated,
} from "@/lib/hooks/LineageGraphContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { IconImport } from "../icons";

export function StateImporter({ checksOnly = true }: { checksOnly?: boolean }) {
  const { featureToggles } = useRecceInstanceContext();
  const queryClient = useQueryClient();
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { open, onOpen, onClose } = useDisclosure();
  const [location, setLocation] = useLocation();
  const [, refetchRunsAggregated] = useRunsAggregated();

  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      return;
    }

    try {
      const { runs, checks } = await importState(selectedFile, checksOnly);
      refetchRunsAggregated();
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.runs() });
      if (location.includes("/checks")) {
        setLocation("/checks");
      }
      const description = checksOnly
        ? `${checks} checks imported successfully`
        : `${runs} runs and ${checks} checks imported successfully`;
      toaster.create({
        description: description,
        type: "info",
        duration: 5000,
        closable: true,
      });
    } catch (error) {
      console.error("Import failed", error);
      toaster.create({
        title: "Import failed",
        description: String(error),
        type: "error",
        duration: 5000,
        closable: true,
      });
    }

    onClose();
  }, [
    queryClient,
    selectedFile,
    onClose,
    location,
    setLocation,
    refetchRunsAggregated,
    checksOnly,
  ]);

  const handleClick = () => {
    if (hiddenFileInput.current) {
      hiddenFileInput.current.click();
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length === 1) {
      setSelectedFile(event.target.files[0]);
      onOpen();
    }

    if (hiddenFileInput.current) {
      hiddenFileInput.current.value = "";
    }
  };

  const warningSubject = checksOnly ? "checks" : "runs and checks";
  const { isDemoSite } = useLineageGraphContext();
  return (
    <>
      <Tooltip
        content={
          "Import Checklist from State File" +
          (isDemoSite ? " (Disabled in the demo site)" : "")
        }
      >
        <IconButton
          pt="6px"
          variant="plain"
          aria-label="Import state"
          onClick={() => {
            handleClick();
            trackStateAction({ name: "import" });
          }}
          disabled={featureToggles.disableImportStateFile || isDemoSite}
        >
          <Icon as={IconImport} />
        </IconButton>
      </Tooltip>
      <input
        type="file"
        style={{ display: "none" }}
        ref={hiddenFileInput}
        onChange={handleFileSelect}
      />
      <Dialog.Root
        open={open}
        role="alertdialog"
        initialFocusEl={() => {
          return cancelRef.current;
        }}
        onOpenChange={onClose}
        size="xl"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header fontSize="lg" fontWeight="bold">
                <Dialog.Title>Import state</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Flex px="5px" gap="5px" rounded="md" direction="column">
                  <Flex alignItems="center" gap="5px">
                    <PiInfo color="red.600" />
                    <Text as="span" fontWeight="500" color="red.600">
                      Caution!
                    </Text>
                  </Flex>
                  <Flex>
                    <Text>
                      The current {warningSubject} will be{" "}
                      <Text as="span" fontWeight="600">
                        merged
                      </Text>{" "}
                      with the imported state
                    </Text>
                  </Flex>
                </Flex>
              </Dialog.Body>
              <Dialog.Footer>
                <Button ref={cancelRef} onClick={onClose}>
                  Cancel
                </Button>
                <Button colorPalette="blue" onClick={handleImport} ml="5px">
                  Import
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
