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
  ModalHeader,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  ModalFooter,
  Button,
  useToast,
  IconButton,
  FormErrorMessage,
  Checkbox,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AiOutlineSave } from "react-icons/ai";
import { IconEdit } from "../icons";
import { AxiosError } from "axios";
import { localStorageKeys } from "@/lib/api/localStorageKeys";

const useRecceToast = () => {
  const toast = useToast();
  const toastSuccess = (message: string) => {
    toast({
      description: message,
      status: "success",
      variant: "left-accent",
      position: "bottom-right",
      duration: 5000,
      isClosable: true,
    });
  };

  const toastError = (message: string, error?: Error) => {
    const errorMessage = !error
      ? `${message}`
      : error instanceof AxiosError
      ? `${message}. ${error?.response?.data?.detail}`
      : `${message}. ${error}`;

    toast({
      description: errorMessage,
      status: "error",
      variant: "left-accent",
      position: "bottom-right",
      duration: 5000,
      isClosable: true,
    });
  };

  return { toastSuccess, toastError };
};

interface FilenameState {
  newFileName: string;
  errorMessage?: string;
  modified?: boolean;
  overwriteWithMethod?: "save" | "rename";
  bypass?: boolean;
}

export const Filename = () => {
  const { fileName, cloudMode, isLoading } = useLineageGraphContext();
  const modalDisclosure = useDisclosure();
  const overwriteDisclosure = useDisclosure();

  const [
    { newFileName, errorMessage, modified, overwriteWithMethod, bypass },
    setState,
  ] = useState<FilenameState>({
    newFileName: fileName || "recce_state.json",
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const { toastSuccess, toastError } = useRecceToast();
  const queryClient = useQueryClient();

  const handleOpen = () => {
    setState({
      newFileName: fileName || "recce_state.json",
      modified: !!fileName ? false : true,
    });

    modalDisclosure.onOpen();
  };

  const handleAction = async (
    method: "save" | "rename",
    overwrite?: boolean
  ) => {
    if (!newFileName) {
      return;
    }

    const bypassOverwrite =
      localStorage.getItem(localStorageKeys.bypassSaveOverwrite) === "true";

    try {
      if (method === "save") {
        await saveAs({
          filename: newFileName,
          overwrite: overwrite || bypassOverwrite,
        });
      } else {
        await rename({
          filename: newFileName,
          overwrite: overwrite || bypassOverwrite,
        });
      }
      toastSuccess(
        method === "save"
          ? "Save file successfully"
          : "Rename file successfully"
      );
      queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
      if (bypass) {
        localStorage.setItem(localStorageKeys.bypassSaveOverwrite, "true");
      }
    } catch (error: any) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 409) {
          setState((s) => ({
            ...s,
            overwriteWithMethod: method,
          }));

          overwriteDisclosure.onOpen();
          return;
        }
      }
      toastError(
        method === "save" ? "Save file failed" : "Rename file failed",
        error
      );
    } finally {
      modalDisclosure.onClose();
    }
  };

  const handleOvewriteBack = () => {
    overwriteDisclosure.onClose();
    modalDisclosure.onOpen();
    setState((s) => {
      return {
        ...s,
        overwriteWithMethod: undefined,
      };
    });
  };

  return (
    <>
      <Flex flex="1" justifyContent="center" alignItems="center">
        <Box>{fileName ? fileName : cloudMode ? "cloud" : "New Instance"}</Box>
        <IconButton
          padding="6px 0px 0px 0px"
          onClick={handleOpen}
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
                  let newErrorMessage: string | undefined = undefined;

                  if (!value) {
                    newErrorMessage = "Filename cannot be empty.";
                  } else if (!value.endsWith(".json")) {
                    newErrorMessage = "Filename must end with .json.";
                  } else if (!/^[a-zA-Z0-9 _-]+\.json$/.test(value)) {
                    newErrorMessage =
                      "Invalid filename. Only alphanumeric, space, _ and - are allowed.";
                  } else if (fileName && value === fileName) {
                    newErrorMessage =
                      "Filename is the same as the current one.";
                  }

                  setState((s) => {
                    return {
                      ...s,
                      modified: true,
                      newFileName: value,
                      errorMessage: newErrorMessage,
                    };
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (errorMessage) {
                      return;
                    }

                    if (!fileName) {
                      handleAction("save");
                    } else {
                      handleAction("rename");
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
              size="sm"
              colorScheme={fileName ? undefined : "blue"}
              onClick={() => {
                handleAction("save");
              }}
              isDisabled={!newFileName || !!errorMessage || !modified}
            >
              {fileName ? "Save as New File" : "Confirm"}
            </Button>
            {fileName && (
              <Button
                size="sm"
                colorScheme="blue"
                onClick={() => {
                  handleAction("rename");
                }}
                isDisabled={!newFileName || !!errorMessage || !modified}
              >
                Rename
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        isOpen={overwriteDisclosure.isOpen}
        onClose={overwriteDisclosure.onClose}
        initialFocusRef={inputRef}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Overwrite File?</ModalHeader>
          <ModalCloseButton />
          <ModalBody
            borderTop="solid 1px lightgray"
            borderBottom="solid 1px lightgray"
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
          >
            <Box fontSize="12pt">
              {overwriteWithMethod === "save"
                ? "Saving a file with this name will overwrite the existing file. Are you sure you wish to continue?"
                : "Renaming the file with this name will overwrite the existing file. Are you sure you wish to continue?"}
            </Box>

            <Checkbox
              isChecked={bypass}
              onChange={(e) =>
                setState((s) => ({ ...s, bypass: e.target.checked }))
              }
              fontWeight="bold"
              size="sm"
              pt="8px"
            >
              Don&apos;t show this again
            </Checkbox>
          </ModalBody>
          <ModalFooter gap="5px">
            <Button variant="outline" onClick={handleOvewriteBack} size="sm">
              Back
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={() => {
                if (!overwriteWithMethod) {
                  return;
                }

                handleAction(overwriteWithMethod, true);
                overwriteDisclosure.onClose();
              }}
            >
              Overwrite
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
