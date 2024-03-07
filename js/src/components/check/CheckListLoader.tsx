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
import { loadChecks } from "@/lib/api/checks";
import { IoFolderOpenOutline } from "react-icons/io5";
import { useLocation } from "wouter";

export function CheckListInitLoader() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleLoad = useCallback(async () => {
    if (!selectedFile) {
      return;
    }

    try {
      const { checks } = await loadChecks(selectedFile);
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      toast({
        description: `${checks} checks loaded successfully`,
        status: "info",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Load failed", error);
      toast({
        title: "Load failed",
        description: `${error}`,
        status: "error",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [queryClient, toast, selectedFile]);

  useEffect(() => {
    if (selectedFile) {
      handleLoad();
    }
  }, [selectedFile, handleLoad]);

  const handleClick = () => {
    if (hiddenFileInput.current) {
      hiddenFileInput.current.click();
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length === 1) {
      setSelectedFile(event.target.files[0]);
    }
  };

  return (
    <>
      <Button onClick={handleClick}>Load a checklist</Button>
      <input
        type="file"
        style={{ display: "none" }}
        ref={hiddenFileInput}
        onChange={handleFileSelect}
      />
    </>
  );
}

export function CheckListLoader() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [, setLocation] = useLocation();

  const handleLoad = useCallback(async () => {
    if (!selectedFile) {
      return;
    }

    try {
      const { checks } = await loadChecks(selectedFile);
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      setLocation("/checks");
      toast({
        description: `${checks} checks loaded successfully`,
        status: "info",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Load failed", error);
      toast({
        title: "Load failed",
        description: `${error}`,
        status: "error",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
    }

    onClose();
  }, [queryClient, selectedFile, toast, onClose]);

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
      <Tooltip label="Load checklist">
        <IconButton
          variant="unstyled"
          aria-label="Load checks"
          mr="10px"
          onClick={handleClick}
          icon={<Icon pt="10px" as={IoFolderOpenOutline} boxSize={"2em"} />}
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
        size={"lg"}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Load checklist
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
                    The checklist will be{" "}
                    <Text as="span" fontWeight="600">
                      overwritten
                    </Text>{" "}
                    by the loaded checklist
                  </Text>
                </Flex>
              </Flex>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={handleLoad} ml="5px">
                Load
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
