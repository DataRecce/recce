import "react-data-grid/lib/styles.css";
import React, { useCallback } from "react";
import { Check, createCheckByRun, updateCheck } from "@/lib/api/checks";
import {
  Box,
  Flex,
  HStack,
  Icon,
  Text,
  IconButton,
  Spacer,
  Tooltip,
  Heading,
  Center,
  Spinner,
} from "@chakra-ui/react";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import { FaCheckCircle, FaRegCheckCircle } from "react-icons/fa";
import { TbChecklist } from "react-icons/tb";
import { IconType } from "react-icons";
import { findByRunType } from "../run/registry";
import { Run } from "@/lib/api/types";
import { listRuns, waitRun } from "@/lib/api/runs";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { format, formatDistanceToNow } from "date-fns";
import { RepeatIcon } from "@chakra-ui/icons";
import { useLocation } from "wouter";
import SimpleBar from "simplebar-react";
import "simplebar/dist/simplebar.min.css";

const RunListItemStatus = ({ run }: { run: Run }) => {
  const { data: fetchedRun } = useQuery({
    queryKey: cacheKeys.run(run.run_id),
    queryFn: async () => {
      return await waitRun(run.run_id);
    },
    enabled: run?.status === "running",
    retry: false,
  });
  const isRunning = fetchedRun
    ? fetchedRun.status === "running"
    : run?.status === "running";

  let status: string | undefined = fetchedRun?.status || run?.status;
  if (!status) {
    if (run.result) {
      status = "finished";
    } else if (run.error) {
      status = "failed";
    }
  }

  let color = "";
  let message = "";
  if (status === "successful" || status === "finished") {
    color = "green";
    message = "Finished";
  } else if (status === "failed") {
    color = "red";
    message = "Failed";
  } else if (status === "cancelled") {
    color = "gray";
    message = "Cancelled";
  } else if (status === "running") {
    color = "blue";
    message = "Running";
  } else {
    color = "green";
    message = "Finished";
  }

  return (
    <>
      {isRunning && <Spinner size="xs" color={`${color}.400`} />}
      <Text fontWeight={500} color={`${color}.400`}>
        {message}
      </Text>
    </>
  );
};

const RunListItem = ({
  run,
  isSelected,
  onSelectRun,
  onAddToChecklist,
  onGoToCheck,
}: {
  run: Run;
  isSelected: boolean;
  onSelectRun: (runId: string) => void;
  onAddToChecklist: (runId: string) => void;
  onGoToCheck: (checkId: string) => void;
}) => {
  const relativeTime = run?.run_at
    ? format(new Date(run.run_at), "MMM d, HH:mm")
    : null;

  const icon: IconType = findByRunType(run.type)?.icon || TbChecklist;
  const checkId = run.check_id;

  return (
    <Flex
      minWidth="200px"
      direction="column"
      width="100%"
      p="5px 20px"
      cursor="pointer"
      borderBottom={"solid 1px lightgray"}
      borderLeft={"4px"}
      borderLeftColor={isSelected ? "orange.400" : "transparent"}
      backgroundColor={isSelected ? "orange.50" : "transparent"}
      onClick={() => {
        onSelectRun(run.run_id);
      }}
      _hover={{ bg: isSelected ? "orange.50" : "gray.200" }}
    >
      <Flex onClick={() => {}} alignItems="center" gap="12px">
        <Icon as={icon} />
        <Box
          flex="1"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          overflow="hidden"
          color={run.name ? "inherit" : "gray.500"}
          fontSize="11pt"
          fontWeight="500"
        >
          {run.name || "<no name>"}
        </Box>
        {checkId ? (
          <Tooltip label="Go to Check" aria-label="Go to Check">
            <Text
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onGoToCheck(checkId);
              }}
            >
              <Icon color="green" as={FaCheckCircle} />
            </Text>
          </Tooltip>
        ) : (
          <Tooltip label="Add to Checklist" aria-label="Add to Checklist">
            <Text
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToChecklist(run.run_id);
              }}
            >
              <Icon as={FaRegCheckCircle} />
            </Text>
          </Tooltip>
        )}
      </Flex>
      <Flex
        justifyContent="start"
        fontSize="11pt"
        color="gray.500"
        gap="3px"
        alignItems={"center"}
      >
        <RunListItemStatus run={run} />
        <Text>•</Text>
        <Text>{relativeTime}</Text>
      </Flex>
    </Flex>
  );
};

export const RunList = () => {
  const {
    data: runs,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: cacheKeys.runs(),
    queryFn: async () => {
      return await listRuns();
    },
    retry: false,
  });
  const { showRunId, runId } = useRecceActionContext();
  const handleSelectRun = (runId: string) => {
    showRunId(runId, false);
  };
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const handleAddToChecklist = useCallback(async () => {
    if (!runId) {
      return;
    }
    const check = await createCheckByRun(runId);

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [runId, setLocation, queryClient]);

  const handleGoToCheck = useCallback(
    (checkId: string) => {
      setLocation(`/checks/${checkId}`);
    },
    [setLocation]
  );

  return (
    <Flex direction="column" height="100%">
      <HStack
        width="100%"
        flex="0 0 54px"
        paddingInline="24px 8px"
        borderBottom="solid 1px lightgray"
      >
        <Heading size="md">History</Heading>
        <Spacer />
        <IconButton
          variant={"unstyled"}
          icon={<RepeatIcon />}
          aria-label="Search database"
          onClick={() => {
            refetch();
          }}
        />
      </HStack>
      <Box flex="1 1 auto">
        {isLoading ? (
          "Loading..."
        ) : runs?.length === 0 ? (
          <Center height="100%" color="gray.400">
            No runs
          </Center>
        ) : (
          <SimpleBar style={{ minHeight: "100%", height: 0 }}>
            {(runs || []).map((run, index) => {
              return (
                <RunListItem
                  key={run.run_id}
                  run={run}
                  isSelected={run.run_id === runId}
                  onSelectRun={handleSelectRun}
                  onGoToCheck={handleGoToCheck}
                  onAddToChecklist={handleAddToChecklist}
                />
              );
            })}
          </SimpleBar>
        )}
      </Box>
    </Flex>
  );
};
