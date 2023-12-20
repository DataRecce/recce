import "react-data-grid/lib/styles.css";
import React, { useCallback, useEffect, useState } from "react";
import { Check, createCheck, listChecks, updateCheck } from "@/lib/api/checks";
import {
  Box,
  Flex,
  VStack,
  Center,
  Checkbox,
  Button,
  Spacer,
  Icon,
  Divider,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import { CheckDetail } from "./CheckDetail";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import { Redirect, Route, Switch, useLocation, useRoute } from "wouter";
import { FaCheckCircle } from "react-icons/fa";
import { TbChecklist, TbSql } from "react-icons/tb";
import { IconType } from "react-icons";
import { AddIcon } from "@chakra-ui/icons";

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

  const icon: IconType = check.type === "query_diff" ? TbSql : TbChecklist;

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
  const selectedItem = params?.checkId;

  const {
    isLoading,
    error,
    data: checks,
  } = useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: listChecks,
    refetchOnMount: false,
  });

  const handleSelectItem = (checkId: string) => {
    setLocation(`/checks/${checkId}`);
  };

  const addToChecklist = useCallback(async () => {
    const check = await createCheck();
    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });

    handleSelectItem(check.check_id);
  }, [queryClient]);

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
          <Tooltip label="Create a simple check">
            <IconButton
              mr="10px"
              variant="unstyled"
              aria-label="Create a simple check"
              onClick={addToChecklist}
              icon={<AddIcon />}
            />
          </Tooltip>

          <Divider mb="8px" />
          {checks.map((check) => (
            <ChecklistItem
              key={check.check_id}
              check={check}
              selected={check.check_id === selectedItem}
              onSelect={handleSelectItem}
            />
          ))}
        </VStack>
      </Box>
      <Box flex="1" height="100%" width="calc(100% - 400px)">
        <Switch>
          <Route path="/checks/:checkId">
            {(params) => {
              return <CheckDetail checkId={params.checkId} />;
            }}
          </Route>
          <Route>
            <Redirect to={`/checks/${checks[0].check_id}`} />
          </Route>
        </Switch>
      </Box>
    </Flex>
  );
};
