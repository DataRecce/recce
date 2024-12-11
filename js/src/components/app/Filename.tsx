import { cacheKeys } from "@/lib/api/cacheKeys";
import { saveState } from "@/lib/api/state";
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

  const handleConfirm = async () => {
    if (!newFileName) {
      return;
    }

    try {
      await saveState({ filename: newFileName });
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
        description: "Save file failed",
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
          <Icon as={AiOutlineSave} boxSize={"1em"} />
        </IconButton>
      </Flex>
      <Modal
        isOpen={modalDisclosure.isOpen}
        onClose={modalDisclosure.onClose}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Save to file</ModalHeader>
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
                    handleConfirm();
                  }
                }}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter gap="5px">
            <Button
              colorScheme="blue"
              onClick={handleConfirm}
              isDisabled={!newFileName}
            >
              Confirm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
