import "react-data-grid/lib/styles.css";
import React, { useEffect, useState } from "react";
import { Check, reorderChecks, updateCheck } from "@/lib/api/checks";
import { Box, Flex, Icon, VStack } from "@chakra-ui/react";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import { FaCheckCircle } from "react-icons/fa";
import {
  TbChecklist,
  TbSql,
  TbSchema,
  TbAlignBoxLeftStretch,
  TbChartHistogram,
} from "react-icons/tb";
import { IconType } from "react-icons";
import { FiAlignLeft } from "react-icons/fi";
import {
  DragDropContext,
  Draggable,
  DropResult,
  Droppable,
} from "@hello-pangea/dnd";

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

  const icon: IconType = ((type) => {
    switch (type) {
      case "schema_diff":
        return TbSchema;
      case "query":
      case "query_diff":
        return TbSql;
      case "value_diff":
        return TbAlignBoxLeftStretch;
      case "profile_diff":
        return TbChartHistogram;
      case "row_count_diff":
        return FiAlignLeft;
      default:
        return TbChecklist;
    }
  })(check.type);

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
  onSelectHandler,
}: {
  checks: Check[];
  selectedItem?: string;
  onSelectHandler: (checkId: string) => void;
}) => {
  const queryClient = useQueryClient();
  const [orderedChecks, setOrderedChecks] = useState<Check[]>(checks);
  const { mutate } = useMutation({
    mutationFn: (order: { source: number; destination: number }) =>
      reorderChecks(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  useEffect(() => {
    setOrderedChecks(checks);
  }, [checks, setOrderedChecks]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return; // Dragged outside the list
    }

    const updatedItems = [...orderedChecks];
    const [reorderedItem] = updatedItems.splice(result.source.index, 1);
    updatedItems.splice(result.destination.index, 0, reorderedItem);

    mutate({
      source: result.source.index,
      destination: result.destination.index,
    });

    setOrderedChecks(updatedItems);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="checklist">
        {(provided) => (
          <VStack
            {...provided.droppableProps}
            ref={provided.innerRef}
            w="full"
            spacing="0"
          >
            {orderedChecks.map((check, index) => (
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
                      onSelect={onSelectHandler}
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
