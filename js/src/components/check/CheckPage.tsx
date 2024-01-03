import "react-data-grid/lib/styles.css";
import React, { useCallback, useEffect } from "react";
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
  Spacer,
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
  const exportChecksToast = useToast();
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

  useEffect(() => {
    if (status !== "success") {
      return;
    }

    if (!selectedItem && checks.length > 0) {
      setLocation(`/checks/${checks[0].check_id}`);
    }
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
            <Button
              colorScheme="green"
              size="sm"
              mr="10px"
              onClick={() => {
                const markdown = exportChecks(checks);
                navigator.clipboard.writeText(markdown);
                exportChecksToast({
                  description: `Copied ${checks.length} checks to clipboard`,
                  status: "info",
                  variant: "left-accent",
                  position: "bottom",
                  duration: 5000,
                  isClosable: true,
                });
              }}
            >
              Export
            </Button>
          </HStack>

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
        </Switch>
      </Box>
    </Flex>
  );
};

function exportChecks(checks: Check[]) {
  const checkItems = checks.map((check) => {
    return `<details><summary>${check.is_checked ? "✅ " : ""}${
      check.name
    }</summary>${check.description}</details>`;
  });

  return checkItems.join("\n\n");
}
