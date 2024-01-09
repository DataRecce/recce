import "react-data-grid/lib/styles.css";
import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  createSimpleCheck,
  listChecks,
  updateCheck,
} from "@/lib/api/checks";
import {
  Box,
  Button,
  Center,
  Divider,
  Flex,
  HStack,
  Icon,
  IconButton,
  Tooltip,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { CheckDetail } from "./CheckDetail";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import { Route, Switch, useLocation, useRoute } from "wouter";
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
import { AddIcon, CopyIcon } from "@chakra-ui/icons";
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

export const CheckPage = () => {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/checks/:checkId");
  const queryClient = useQueryClient();
  const { successToast, failToast } = useClipBoardToast();
  const selectedItem = params?.checkId;

  const {
    isLoading,
    error,
    data: checks,
    status,
  } = useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: listChecks,
    refetchOnMount: true,
  });

  const handleSelectItem = useCallback(
    (checkId: string) => {
      setLocation(`/checks/${checkId}`);
    },
    [setLocation]
  );

  const addToChecklist = useCallback(async () => {
    const check = await createSimpleCheck();
    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });

    handleSelectItem(check.check_id);
  }, [queryClient, handleSelectItem]);

  const [orderedChecks, setOrderedChecks] = useState<Check[]>([]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return; // Dragged outside the list
    }

    const updatedItems = [...orderedChecks];
    const [reorderedItem] = updatedItems.splice(result.source.index, 1);
    updatedItems.splice(result.destination.index, 0, reorderedItem);

    setOrderedChecks(updatedItems);
  };

  useEffect(() => {
    if (status !== "success") {
      return;
    }

    if (!selectedItem && checks.length > 0) {
      setLocation(`/checks/${checks[0].check_id}`);
    }
    setOrderedChecks(checks);
  }, [status, selectedItem, checks, setLocation]);

  if (isLoading) {
    return <>Loading</>;
  }

  if (error) {
    return <>Error: {error.message}</>;
  }

  if (!checks?.length) {
    return (
      <Center h="100%">
        <VStack>
          <Box>No checks</Box>
          <Button colorScheme="blue" onClick={addToChecklist}>
            Create a simple check
          </Button>
        </VStack>
      </Center>
    );
  }

  return (
    <Flex height="100%">
      <Box
        flex="0 0 400px"
        borderRight="lightgray solid 1px"
        height="100%"
        style={{ contain: "size" }}
      >
        <VStack spacing={0} align="flex-end">
          <HStack>
            <Tooltip label="Create a simple check">
              <IconButton
                variant="unstyled"
                aria-label="Create a simple check"
                onClick={addToChecklist}
                icon={<AddIcon />}
              />
            </Tooltip>
            <Tooltip label="Copy checklist to the clipboard">
              <IconButton
                variant="unstyled"
                aria-label="Copy checklist to the clipboard"
                mr="10px"
                onClick={() => {
                  const markdown = buildMarkdown(checks);
                  if (!navigator.clipboard) {
                    failToast(
                      new Error(
                        "Copy to clipboard is available only in secure contexts (HTTPS)"
                      )
                    );
                    return;
                  }
                  navigator.clipboard
                    .writeText(markdown)
                    .then(() => {
                      successToast(
                        `Copied ${checks.length} checks to the clipboard`
                      );
                    })
                    .catch((err) => {
                      failToast(err);
                    });
                }}
                icon={<CopyIcon />}
              />
            </Tooltip>
          </HStack>

          <Divider mb="8px" />
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
                            onSelect={handleSelectItem}
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
        </VStack>
      </Box>
      <Box flex="1" height="100%" width="calc(100% - 400px)">
        <Switch>
          <Route path="/checks/:checkId">
            {(params) => {
              return <CheckDetail checkId={params.checkId} />;
            }}
          </Route>
        </Switch>
      </Box>
    </Flex>
  );
};

function buildMarkdown(checks: Check[]) {
  const checkItems = checks.map((check) => {
    return `<details><summary>${buildTitle(
      check
    )}</summary>\n\n${buildDescription(check)}\n\n</details>`;
  });

  return checkItems.join("\n\n");
}

function buildTitle(check: Check) {
  return `${check.is_checked ? "✅ " : ""}${check.name}`;
}

function buildDescription(check: Check) {
  return check.description ? check.description : "_(no description)_";
}

function useClipBoardToast() {
  const clipboardToast = useToast();

  function successToast(message: string) {
    clipboardToast({
      description: message,
      status: "info",
      variant: "left-accent",
      position: "bottom",
      duration: 5000,
      isClosable: true,
    });
  }

  function failToast(error: any) {
    clipboardToast({
      title: "Failed to copy checklist to clipboard",
      description: `${error}`,
      status: "error",
      variant: "left-accent",
      position: "bottom",
      duration: 5000,
      isClosable: true,
    });
  }

  return {
    successToast,
    failToast,
  };
}
