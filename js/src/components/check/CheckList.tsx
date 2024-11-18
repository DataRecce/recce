import "react-data-grid/lib/styles.css";
import React, { useState } from "react";
import { Check, updateCheck } from "@/lib/api/checks";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  Icon,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Tooltip,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import { FaCheckCircle } from "react-icons/fa";
import { TbChecklist } from "react-icons/tb";
import { IconType } from "react-icons";
import {
  DragDropContext,
  Draggable,
  DropResult,
  Droppable,
} from "@hello-pangea/dnd";
import { findByRunType } from "../run/registry";
import { useCheckToast } from "@/lib/hooks/useCheckToast";

const ChecklistItem = ({
  check,
  selected,
  onSelect,
  onMarkAsChecked,
}: {
  check: Check;
  selected: boolean;
  onSelect: (checkId: string) => void;
  onMarkAsChecked: () => void;
}) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const checkId = check.check_id!;
  const { mutate } = useMutation({
    mutationFn: (check: Partial<Check>) => updateCheck(checkId, check),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.check(checkId) });
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  const handleChange: React.ChangeEventHandler = (event) => {
    const isChecked: boolean = (event.target as any).checked;
    if (isChecked === false) {
      // If unchecking, just update the check
      mutate({ is_checked: isChecked });
    } else {
      // Show Mark as checked warning modal
      onMarkAsChecked();
    }
  };

  const icon: IconType = findByRunType(check.type)?.icon || TbChecklist;

  return (
    <>
      <Flex
        width="100%"
        p="10px 20px"
        cursor="pointer"
        _hover={{ bg: "Cornsilk" }}
        bg={selected ? "Floralwhite" : "inherit"}
        borderBlockEndWidth={"1px"}
        borderLeftWidth={"3px"}
        borderLeftColor={selected ? "orange" : "transparent"}
        onClick={() => onSelect(check.check_id)}
        alignItems="center"
        gap="5px"
      >
        <Icon as={icon} />
        <Box
          flex="1"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          overflow="hidden"
        >
          {check.name}
        </Box>

        {/* {check.is_checked && <Icon color="green" as={FaCheckCircle} />} */}
        <Tooltip label="Click to mark as checked" placement="top" hasArrow>
          <Flex>
            <Checkbox
              isChecked={check.is_checked}
              variant="circular"
              colorScheme="green"
              size="xs"
              onChange={handleChange}
            />
          </Flex>
        </Tooltip>
      </Flex>
    </>
  );
};

export const CheckList = ({
  checks,
  selectedItem,
  onCheckSelected,
  onChecksReordered,
}: {
  checks: Check[];
  selectedItem?: string;
  onCheckSelected: (checkId: string) => void;
  onChecksReordered: (source: number, destination: number) => void;
}) => {
  const [bypassModal, setBypassModal] = useState(false);
  const queryClient = useQueryClient();
  const { mutate: markCheckedByID } = useMutation({
    mutationFn: (checkId: string) => updateCheck(checkId, { is_checked: true }),
    onSuccess: (_, checkId: string) => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.check(checkId) });
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    onChecksReordered(result.source.index, result.destination.index);
  };
  const {
    isOpen: isMarkAsCheckedOpen,
    onOpen: onMarkAsCheckedOpen,
    onClose: onMarkAsCheckedClosed,
  } = useDisclosure();

  const { markedAsCheckedToast } = useCheckToast();
  const handleOnMarkAsChecked = () => {
    const bypassMarkAsCheckedWarning = localStorage.getItem(
      "bypassMarkAsCheckedWarning"
    );
    if (bypassMarkAsCheckedWarning === "true") {
      markCheckedByID(selectedItem!);
      markedAsCheckedToast();
    } else {
      onMarkAsCheckedOpen();
    }
  };

  const handleMarkAsCheckedConfirmed = () => {
    markCheckedByID(selectedItem!);
    if (bypassModal === true) {
      localStorage.setItem("bypassMarkAsCheckedWarning", "true");
    }
    onMarkAsCheckedClosed();
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="checklist">
          {(provided) => (
            <VStack
              {...provided.droppableProps}
              ref={provided.innerRef}
              w="full"
              spacing="0"
              flex="1"
              overflow={"auto"}
            >
              {checks.map((check, index) => (
                <Draggable
                  key={check.check_id}
                  draggableId={check.check_id}
                  index={index}
                >
                  {(provided, snapshot) => {
                    // see https://github.com/atlassian/react-beautiful-dnd/issues/1881#issuecomment-691237307
                    if (snapshot.isDragging) {
                      const props = provided.draggableProps as any;
                      const offset = { x: 0, y: 80 };
                      const x = props.style.left - offset.x;
                      const y = props.style.top - offset.y;
                      props.style.left = x;
                      props.style.top = y;
                    }

                    return (
                      <Flex
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        w="full"
                      >
                        <ChecklistItem
                          key={check.check_id}
                          check={check}
                          selected={check.check_id === selectedItem}
                          onSelect={onCheckSelected}
                          onMarkAsChecked={handleOnMarkAsChecked}
                        />
                      </Flex>
                    );
                  }}
                </Draggable>
              ))}
              {provided.placeholder}
            </VStack>
          )}
        </Droppable>
      </DragDropContext>
      <Modal
        isOpen={isMarkAsCheckedOpen}
        onClose={onMarkAsCheckedClosed}
        isCentered
      >
        <ModalOverlay />
        <ModalContent width={"400px"}>
          <ModalHeader>Mark as checked?</ModalHeader>
          <ModalCloseButton />
          <Divider />
          <Box p={"16px"} fontSize="sm" gap="16px">
            <p>
              Marking an item which&apos;s contents your haven&apos;t seen could
              result in unwanted results being passwd on as ok.
            </p>
            <Checkbox
              isChecked={bypassModal}
              onChange={(e) => setBypassModal(e.target.checked)}
              fontWeight="bold"
              size="sm"
              pt="8px"
            >
              Don&apos;t show this again
            </Checkbox>
          </Box>
          <Divider />
          <ModalFooter>
            <Button
              variant="outline"
              size="xs"
              mr={2}
              onClick={onMarkAsCheckedClosed}
            >
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              size="xs"
              onClick={handleMarkAsCheckedConfirmed}
            >
              Mark as checked
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
