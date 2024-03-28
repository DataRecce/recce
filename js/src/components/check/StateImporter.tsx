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
import { useRunsAggregated } from "@/lib/hooks/LineageGraphContext";
import { TfiImport } from "react-icons/tfi";

export function StateImporter() {
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
      const { runs, checks } = await importState(selectedFile);
      refetchRunsAggregated();
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      if (location.includes("/checks")) {
        setLocation("/checks");
      }
      toast({
        description: `${runs} runs and ${checks} checks imported successfully`,
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
        description: `${error}`,
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
  };

  return (
    <>
      <Tooltip label="Import">
        <IconButton
          variant="unstyled"
          aria-label="Import state"
          onClick={handleClick}
          icon={<Icon as={TfiImport} boxSize={"1.2em"} />}
        />
      </Tooltip>
      <input
        type="file"
        style={{ display: "none" }}
        ref={hiddenFileInput}
        onChange={handleFileSelect}
      />
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
        size={"xl"}
      >
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
                    The current runs and checks will be{" "}
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
