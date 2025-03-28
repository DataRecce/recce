import "react-data-grid/lib/styles.css";
import React, { useCallback } from "react";
import { createCheckByRun } from "@/lib/api/checks";
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
} from "@chakra-ui/react";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import { FaCheckCircle, FaRegCheckCircle } from "react-icons/fa";
import { TbChecklist } from "react-icons/tb";
import { IconType } from "react-icons";
import { findByRunType } from "../run/registry";
import { Run } from "@/lib/api/types";
import { listRuns, waitRun } from "@/lib/api/runs";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { RepeatIcon } from "@chakra-ui/icons";
import { useLocation } from "wouter";
import SimpleBar from "simplebar-react";
import "simplebar/dist/simplebar.min.css";
import { formatRunDate, RunStatusAndDate } from "./RunStatusAndDate";
import { trackHistoryAction } from "@/lib/api/track";
import { useRecceModeContext } from "@/lib/hooks/RecceModeContext";

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
  const { readOnly } = useRecceModeContext();
  const { data: fetchedRun } = useQuery({
    queryKey: cacheKeys.run(run.run_id),
    queryFn: async () => {
      return await waitRun(run.run_id);
    },
    enabled: run.status === "running",
    retry: false,
  });

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
      _hover={{ bg: isSelected ? "orange.50" : "gray.200" }}>
      <Flex onClick={() => {}} alignItems="center" gap="12px">
        <Icon as={icon} />
        <Box
          flex="1"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          overflow="hidden"
          color={run.name ? "inherit" : "gray.500"}
          fontSize="11pt"
          fontWeight="500">
          {run.name || "<no name>"}
        </Box>
        {checkId ? (
          <Tooltip label="Go to Check" aria-label="Go to Check">
            <Text
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onGoToCheck(checkId);
              }}>
              <Icon color="green" as={FaCheckCircle} />
            </Text>
          </Tooltip>
        ) : !readOnly ? (
          <Tooltip label="Add to Checklist" aria-label="Add to Checklist">
            <Text
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                trackHistoryAction({ name: "add_to_checklist" });
                onAddToChecklist(run.run_id);
              }}>
              <Icon as={FaRegCheckCircle} />
            </Text>
          </Tooltip>
        ) : null}
      </Flex>
      <Flex justifyContent="start" fontSize="11pt" color="gray.500" gap="3px" alignItems={"center"}>
        <RunStatusAndDate run={fetchedRun || run} />
      </Flex>
    </Flex>
  );
};

const DateSegmentItem = ({ runAt }: { runAt?: string }) => {
  const dateTime = runAt ? formatRunDate(new Date(runAt)) : null;

  return (
    <Flex
      minWidth="200px"
      width="100%"
      p="5px 20px"
      borderBottom={"solid 1px lightgray"}
      color="gray.500"
      fontSize={"11pt"}>
      {dateTime}
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
    trackHistoryAction({ name: "click_run" });
    showRunId(runId, false);
  };
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const handleAddToChecklist = useCallback(async () => {
    if (!runId) {
      return;
    }
    const check = await createCheckByRun(runId);

    await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [runId, setLocation, queryClient]);

  const handleGoToCheck = useCallback(
    (checkId: string) => {
      trackHistoryAction({ name: "go_to_check" });
      setLocation(`/checks/${checkId}`);
    },
    [setLocation],
  );

  let previousDate: string | null = null;

  return (
    <Flex direction="column" height="100%">
      <HStack
        width="100%"
        flex="0 0 54px"
        paddingInline="24px 8px"
        borderBottom="solid 1px lightgray">
        <Heading size="md">History</Heading>
        <Spacer />
        <IconButton
          variant={"unstyled"}
          icon={<RepeatIcon />}
          aria-label="Search database"
          onClick={async () => {
            await refetch();
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
              const currentDate = new Date(run.run_at).toDateString();
              const shouldRenderDateSegment = previousDate != null && previousDate !== currentDate;
              previousDate = currentDate;

              return (
                <>
                  {shouldRenderDateSegment && (
                    <DateSegmentItem key={currentDate} runAt={run.run_at} />
                  )}
                  <RunListItem
                    key={run.run_id}
                    run={run}
                    isSelected={run.run_id === runId}
                    onSelectRun={handleSelectRun}
                    onGoToCheck={handleGoToCheck}
                    onAddToChecklist={handleAddToChecklist}
                  />
                </>
              );
            })}
          </SimpleBar>
        )}
      </Box>
    </Flex>
  );
};
