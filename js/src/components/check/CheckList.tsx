import "react-data-grid/lib/styles.css";
import React from "react";
import { Check, updateCheck } from "@/lib/api/checks";
import { Box, Flex, Icon, VStack } from "@chakra-ui/react";
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

const ChecklistItem = ({
  check,
  selected,
  onSelect,
}: {
  check: Check;
  selected: boolean;
  onSelect: (checkId: string) => void;
}) => {
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
    mutate({ is_checked: isChecked });
  };

  const icon: IconType = findByRunType(check.type)?.icon || TbChecklist;

  return (
    <Flex
      width="100%"
      p="10px 20px"
      cursor="pointer"
      _hover={{ bg: "gray.200" }}
      bg={selected ? "gray.100" : "inherit"}
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

      {check.is_checked && <Icon color="green" as={FaCheckCircle} />}
    </Flex>
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
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    onChecksReordered(result.source.index, result.destination.index);
  };

  return (
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
                {(provided) => (
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
                    />
                  </Flex>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </VStack>
        )}
      </Droppable>
    </DragDropContext>
  );
};
