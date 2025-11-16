import "react-data-grid/lib/styles.css";
import {
  Box,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Flex,
  Icon,
  Portal,
  Separator,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { IconType } from "react-icons";
import { Tooltip } from "@/components/ui/tooltip";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check, updateCheck } from "@/lib/api/checks";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useCheckToast } from "@/lib/hooks/useCheckToast";
import { useRun } from "@/lib/hooks/useRun";
import { findByRunType } from "../run/registry";
import { isDisabledByNoResult } from "./CheckDetail";

const ChecklistItem = ({
  check,
  selected,
  onSelect,
  onMarkAsApproved,
}: {
  check: Check;
  selected: boolean;
  onSelect: (checkId: string) => void;
  onMarkAsApproved: () => void;
}) => {
  const { featureToggles } = useRecceInstanceContext();
  const queryClient = useQueryClient();
  const checkId = check.check_id;
  const { mutate } = useMutation({
    mutationFn: (check: Partial<Check>) => updateCheck(checkId, check),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: cacheKeys.check(checkId),
      });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });
  const trackedRunId = check.last_run?.run_id;
  const { run } = useRun(trackedRunId);

  const icon: IconType = findByRunType(check.type).icon;
  const isMarkAsApprovedDisabled =
    isDisabledByNoResult(check.type, run) ||
    featureToggles.disableUpdateChecklist;
  const isNoResult = isDisabledByNoResult(check.type, run);

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
        onClick={() => {
          onSelect(check.check_id);
        }}
        alignItems="center"
        gap="5px"
      >
        <Icon as={icon} />
        <Box
          flex="1"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          overflow="hidden"
          className="no-track-pii-safe"
        >
          {check.name}
        </Box>

        {/* {check.is_checked && <Icon color="green" as={FaCheckCircle} />} */}
        <Tooltip
          content={
            isNoResult ? "Run the check first" : "Click to mark as approved"
          }
          positioning={{ placement: "top" }}
          showArrow
        >
          <Flex>
            <Checkbox.Root
              checked={check.is_checked}
              colorPalette="green"
              variant="solid"
              size="sm"
              onCheckedChange={(details) => {
                if (!details.checked) {
                  // If unchecking, just update the check
                  mutate({ is_checked: details.checked });
                } else {
                  // Show Mark as Approved warning modal
                  onMarkAsApproved();
                }
              }}
              disabled={isMarkAsApprovedDisabled}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control
                borderColor="border.inverted"
                backgroundColor={
                  isMarkAsApprovedDisabled ? "bg.emphasized" : undefined
                }
              />
            </Checkbox.Root>
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
    onSuccess: async (_, checkId: string) => {
      await queryClient.invalidateQueries({
        queryKey: cacheKeys.check(checkId),
      });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    onChecksReordered(result.source.index, result.destination.index);
  };
  const {
    open: isMarkAsApprovedOpen,
    onOpen: onMarkAsApprovedOpen,
    onClose: onMarkAsApprovedClosed,
  } = useDisclosure();

  const { markedAsApprovedToast } = useCheckToast();
  const handleOnMarkAsApproved = () => {
    if (selectedItem) {
      const bypassMarkAsApprovedWarning = localStorage.getItem(
        "bypassMarkAsApprovedWarning",
      );
      if (bypassMarkAsApprovedWarning === "true") {
        markCheckedByID(selectedItem);
        markedAsApprovedToast();
      } else {
        onMarkAsApprovedOpen();
      }
    }
  };

  const handleMarkAsApprovedConfirmed = () => {
    if (selectedItem) {
      markCheckedByID(selectedItem);
      if (bypassModal) {
        localStorage.setItem("bypassMarkAsApprovedWarning", "true");
      }
      markedAsApprovedToast();
      onMarkAsApprovedClosed();
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="checklist">
          {(provided) => (
            <VStack
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="no-track-pii-safe"
              w="full"
              gap="0"
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
                      const props = provided.draggableProps;
                      if (props.style != null && "left" in props.style) {
                        const offset = { x: 0, y: 80 };
                        const x = props.style.left - offset.x;
                        const y = props.style.top - offset.y;
                        props.style.left = x;
                        props.style.top = y;
                      }
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
                          onMarkAsApproved={handleOnMarkAsApproved}
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
      <Dialog.Root
        open={isMarkAsApprovedOpen}
        onOpenChange={onMarkAsApprovedClosed}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content width={"400px"}>
              <Dialog.Header>
                <Dialog.Title>Mark as Approved?</Dialog.Title>
              </Dialog.Header>
              <Separator />
              <Box p={"16px"} fontSize="sm" gap="16px">
                <p>
                  Please ensure you have reviewed the contents of this check
                  before marking it as approved.
                </p>
                <Checkbox.Root
                  checked={bypassModal}
                  onCheckedChange={(e) => {
                    setBypassModal(Boolean(e.checked));
                  }}
                  fontWeight="bold"
                  size="sm"
                  pt="8px"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>Don&apos;t show this again</Checkbox.Label>
                </Checkbox.Root>
              </Box>
              <Separator />
              <Dialog.Footer gap={0}>
                <Button
                  variant="outline"
                  size="xs"
                  mr={2}
                  onClick={onMarkAsApprovedClosed}
                >
                  Cancel
                </Button>
                <Button
                  colorPalette="iochmara"
                  size="xs"
                  onClick={handleMarkAsApprovedConfirmed}
                >
                  Mark as approved
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
};
