import "react-data-grid/lib/styles.css";
import React, { useCallback } from "react";
import { Check, updateCheck } from "@/lib/api/checks";
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
} from "@chakra-ui/react";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import { FaCheckCircle, FaRegCheckCircle } from "react-icons/fa";
import { TbChecklist } from "react-icons/tb";
import { IconType } from "react-icons";
import { findByRunType } from "../run/registry";
import { Run } from "@/lib/api/types";
import { listRuns } from "@/lib/api/runs";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { format, formatDistanceToNow } from "date-fns";
import { RepeatIcon } from "@chakra-ui/icons";
import { useLocation } from "wouter";

const RunListItemStatus = ({ run }: { run: Run }) => {
  let status: string | undefined = run.status;
  if (!status) {
    if (run.result) {
      status = "successful";
    } else if (run.error) {
      status = "failed";
    }
  }

  let color = "";
  let message = "";
  if (status === "successful") {
    color = "green";
    message = "Successful";
  } else if (status === "failed") {
    color = "red";
    message = "Failed";
  } else if (status === "cancelled") {
    color = "gray";
    message = "Cancelled";
  } else {
    color = "gray";
    message = "Unknown";
  }

  status === "successful" ? "green" : status === "failed" ? "red" : "gray";
  return (
    <Text fontWeight={500} color={`${color}.400`}>
      {message}
    </Text>
  );
};

const RunListItem = ({
  run,
  isSelected,
  onSelectRun,
  onGoToCheck,
}: {
  run: Run;
  isSelected: boolean;
  onSelectRun: (runId: string) => void;
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
          fontSize="11pt"
          fontWeight="500"
        >
          {run.name}
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
              }}
            >
              <Icon as={FaRegCheckCircle} />
            </Text>
          </Tooltip>
        )}
      </Flex>
      <Flex
        justifyContent="start"
        fontSize="10pt"
        color="gray.500"
        gap="3px"
        alignItems={"center"}
      >
        <Text fontWeight={500} color="green.400">
          <RunListItemStatus run={run} />
        </Text>
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
      // wait 2 sec
      // await new Promise((resolve) => setTimeout(resolve, 2000));
      return await listRuns();
    },
  });
  const { showRunId, runId } = useRecceActionContext();
  const handleSelectRun = (runId: string) => {
    showRunId(runId, false);
  };
  const [, setLocation] = useLocation();

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
        height={"54px"}
        paddingInline="24px 20px"
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
      <Box
        overflowY="scroll"
        flex="1"
        style={{
          scrollbarColor: "lightgray rgba(0, 0, 0, 0)",
          scrollbarGutter: "auto",
          scrollbarWidth: "thin",
        }}
      >
        {isLoading ? (
          "Loading..."
        ) : runs?.length === 0 ? (
          "No run"
        ) : (
          <Flex direction="column" overflowY="auto" flex="1">
            {(runs || []).map((run, index) => {
              return (
                <RunListItem
                  key={run.run_id}
                  run={run}
                  isSelected={run.run_id === runId}
                  onSelectRun={handleSelectRun}
                  onGoToCheck={handleGoToCheck}
                />
              );
            })}
          </Flex>
        )}
      </Box>
    </Flex>
  );
};
