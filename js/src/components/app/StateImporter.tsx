import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Flex,
  Icon,
  IconButton,
  Text,
  Tooltip,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { InfoIcon } from "@chakra-ui/icons";
import { importState } from "@/lib/api/state";
import { useLocation } from "wouter";
import { useLineageGraphContext, useRunsAggregated } from "@/lib/hooks/LineageGraphContext";
import { IconImport } from "../icons";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

export function StateImporter({ checksOnly = true }: { checksOnly?: boolean }) {
  const { readOnly } = useRecceInstanceContext();
  const toast = useToast();
  const queryClient = useQueryClient();
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
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
      toast({
        description: description,
        status: "info",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Import failed", error);
      toast({
        title: "Import failed",
        description: String(error),
        status: "error",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
    }

    onClose();
  }, [
    queryClient,
    selectedFile,
    toast,
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
        label={
          "Import Checklist from State File" + (isDemoSite ? " (Disabled in the demo site)" : "")
        }>
        <IconButton
          pt="6px"
          variant="unstyled"
          aria-label="Import state"
          onClick={handleClick}
          icon={<Icon as={IconImport} />}
          isDisabled={readOnly || isDemoSite}
        />
      </Tooltip>
      <input
        type="file"
        style={{ display: "none" }}
        ref={hiddenFileInput}
        onChange={handleFileSelect}
      />
      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} size={"xl"}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Import state
            </AlertDialogHeader>

            <AlertDialogBody>
              <Flex px="5px" gap="5px" rounded="md" direction="column">
                <Flex alignItems="center" gap="5px">
                  <InfoIcon color="red.600" />
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
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={handleImport} ml="5px">
                Import
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
