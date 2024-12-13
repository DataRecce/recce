import { cacheKeys } from "@/lib/api/cacheKeys";
import { rename, saveAs } from "@/lib/api/state";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import {
  Flex,
  Box,
  Icon,
  Modal,
  useDisclosure,
  ModalBody,
  ModalContent,
  ModalOverlay,
  Text,
  ModalHeader,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  ModalFooter,
  Button,
  InputRightAddon,
  InputGroup,
  useToast,
  IconButton,
  FormErrorMessage,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AiOutlineSave } from "react-icons/ai";
import { IconEdit } from "../icons";
import { AxiosError } from "axios";

export const Filename = () => {
  const { fileName, cloudMode, isLoading } = useLineageGraphContext();
  const modalDisclosure = useDisclosure();

  const [newFileName, setNewFileName] = useState(fileName);
  const [errorMessage, setErrorMessage] = useState("");
  const [modified, setModified] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  useLayoutEffect(() => {
    if (modalDisclosure.isOpen) {
      setNewFileName(fileName ? fileName : "recce_state.json");
      setErrorMessage("");
      setModified(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [modalDisclosure.isOpen]);

  const handleSaveAs = async () => {
    if (!newFileName) {
      return;
    }

    try {
      await saveAs({ filename: newFileName });
      toast({
        description: "Save file successfully",
        status: "info",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
      queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? error?.response?.data?.detail
          : `${error}`;
      toast({
        description: "Save file failed. ${error.message}",
        status: "error",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      modalDisclosure.onClose();
    }
  };

  const handleRename = async () => {
    if (!newFileName) {
      return;
    }

    try {
      await rename({ filename: newFileName });
      toast({
        description: "Save file successfully",
        status: "info",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
      queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? error?.response?.data?.detail
          : `${error}`;

      toast({
        description: `Save file failed. ${message}`,
        status: "error",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      modalDisclosure.onClose();
    }
  };

  if (isLoading) {
    return <></>;
  }

  return (
    <>
      <Flex flex="1" justifyContent="center" alignItems="center">
        <Box>{fileName ? fileName : cloudMode ? "cloud" : "New Instance"}</Box>
        <IconButton
          padding="6px 0px 0px 0px"
          onClick={() => modalDisclosure.onOpen()}
          aria-label={""}
          variant="unstyled"
        >
          <Icon as={fileName ? IconEdit : AiOutlineSave} boxSize={"1em"} />
        </IconButton>
      </Flex>
      <Modal
        isOpen={modalDisclosure.isOpen}
        onClose={modalDisclosure.onClose}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {fileName ? "Change Filename" : "Save File"}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
          >
            <FormControl isInvalid={!!errorMessage}>
              <FormLabel>File name:</FormLabel>
              <Input
                ref={inputRef}
                value={newFileName}
                placeholder="Enter filename"
                onChange={(e) => {
                  const value = e.target.value;
                  setModified(true);
                  setNewFileName(value);

                  if (!value) {
                    setErrorMessage("Filename cannot be empty.");
                  } else if (!value.endsWith(".json")) {
                    setErrorMessage("Filename must end with .json.");
                  } else if (!/^[a-zA-Z0-9 _-]+\.json$/.test(value)) {
                    setErrorMessage(
                      "Invalid filename. Only alphanumeric, space, _ and - are allowed."
                    );
                  } else if (fileName && value === fileName) {
                    setErrorMessage("Filename is the same as the current one.");
                  } else {
                    setErrorMessage("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (errorMessage) {
                      return;
                    }

                    if (!fileName) {
                      handleSaveAs();
                    } else {
                      handleRename();
                    }
                  } else if (e.key === "Escape") {
                    modalDisclosure.onClose();
                  }
                }}
              />
              <FormErrorMessage>{errorMessage}</FormErrorMessage>
            </FormControl>
          </ModalBody>
          <ModalFooter gap="5px">
            <Button
              colorScheme={fileName ? undefined : "blue"}
              onClick={handleSaveAs}
              isDisabled={!newFileName || !!errorMessage || !modified}
            >
              {fileName ? "Save as New File" : "Confirm"}
            </Button>
            {fileName && (
              <Button
                colorScheme="blue"
                onClick={handleRename}
                isDisabled={!newFileName || !!errorMessage || !modified}
              >
                Rename
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
