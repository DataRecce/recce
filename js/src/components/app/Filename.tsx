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
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AiOutlineSave } from "react-icons/ai";
import { IconEdit } from "../icons";
import { AxiosError } from "axios";

export const Filename = () => {
  const { fileName, cloudMode, isLoading } = useLineageGraphContext();
  const modalDisclosure = useDisclosure();

  const [newFileName, setNewFileName] = useState(fileName);
  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (modalDisclosure.isOpen) {
      setNewFileName(fileName ? fileName : "recce_state.json");
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
            <FormControl>
              <FormLabel>File name:</FormLabel>
              <Input
                value={newFileName}
                placeholder="Enter filename"
                onChange={(e) => {
                  setNewFileName(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveAs();
                  }
                }}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter gap="5px">
            <Button
              colorScheme={fileName ? undefined : "blue"}
              onClick={handleSaveAs}
              isDisabled={!newFileName}
            >
              {fileName ? "Save as New File" : "Confirm"}
            </Button>
            {fileName && (
              <Button
                colorScheme="blue"
                onClick={handleRename}
                isDisabled={!newFileName}
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
