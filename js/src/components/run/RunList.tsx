import "react-data-grid/lib/styles.css";
import {
  Box,
  Center,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Spacer,
  Text,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { ReactNode, useCallback } from "react";
import { IconType } from "react-icons";
import { FaCheckCircle, FaRegCheckCircle } from "react-icons/fa";
import SimpleBar from "simplebar-react";
import { useLocation } from "wouter";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { createCheckByRun } from "@/lib/api/checks";
import { listRuns, waitRun } from "@/lib/api/runs";
import { Run } from "@/lib/api/types";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { findByRunType } from "../run/registry";
import "simplebar/dist/simplebar.min.css";
import { PiX } from "react-icons/pi";
import { Tooltip } from "@/components/ui/tooltip";
import { trackHistoryAction } from "@/lib/api/track";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { formatRunDate, RunStatusAndDate } from "./RunStatusAndDate";

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
  const { featureToggles } = useRecceInstanceContext();
  const { data: fetchedRun } = useQuery({
    queryKey: cacheKeys.run(run.run_id),
    queryFn: async () => {
      return await waitRun(run.run_id);
    },
    enabled: run.status === "running",
    retry: false,
  });

  const icon: IconType = findByRunType(run.type).icon;
  const checkId = run.check_id;
  const hideAddToChecklist = featureToggles.disableUpdateChecklist;

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
      <Flex
        onClick={() => {
          return void 0;
        }}
        alignItems="center"
        gap="12px"
      >
        <Icon as={icon} />
        <Box
          className="no-track-pii-safe"
          flex="1"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          overflow="hidden"
          color={run.name ? "inherit" : "gray.500"}
          fontSize="11pt"
          fontWeight="500"
        >
          {(run.name ?? "").trim() || "<no name>"}
        </Box>
        {checkId ? (
          <Tooltip content="Go to Check" aria-label="Go to Check">
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
        ) : !hideAddToChecklist ? (
          <Tooltip content="Add to Checklist" aria-label="Add to Checklist">
            <Text
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                trackHistoryAction({ name: "add_to_checklist" });
                onAddToChecklist(run.run_id);
              }}
            >
              <Icon as={FaRegCheckCircle} />
            </Text>
          </Tooltip>
        ) : null}
      </Flex>
      <Flex
        justifyContent="start"
        fontSize="11pt"
        color="gray.500"
        gap="3px"
        alignItems={"center"}
      >
        <RunStatusAndDate run={fetchedRun ?? run} />
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
      fontSize={"11pt"}
    >
      {dateTime}
    </Flex>
  );
};

export const RunList = () => {
  const { closeHistory } = useRecceActionContext();
  const { data: runs, isLoading } = useQuery({
    queryKey: cacheKeys.runs(),
    queryFn: async () => {
      return await listRuns();
    },
    retry: false,
  });

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
          variant="ghost"
          aria-label="Close History"
          onClick={() => {
            trackHistoryAction({ name: "hide" });
            closeHistory();
          }}
        >
          <PiX />
        </IconButton>
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
            {(runs ?? []).map((run, idx) => {
              if (runs != null) {
                const previousDate =
                  idx === 0
                    ? null
                    : new Date(runs[idx - 1].run_at).toDateString();
                return (
                  <DateDividedRunHistoryItem
                    key={run.run_id}
                    run={run}
                    previousDate={previousDate}
                  />
                );
              }
            })}
          </SimpleBar>
        )}
      </Box>
    </Flex>
  );
};

interface DateDividedRunHistoryItemProps {
  run: Run;
  previousDate: string | null;
}

function DateDividedRunHistoryItem({
  run,
  previousDate,
}: DateDividedRunHistoryItemProps): ReactNode {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { showRunId, runId } = useRecceActionContext();

  const currentDate = new Date(run.run_at).toDateString();
  const shouldRenderDateSegment =
    previousDate != null && previousDate !== currentDate;

  const handleSelectRun = (runId: string) => {
    trackHistoryAction({ name: "click_run" });
    showRunId(runId, false);
  };

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
  return (
    <React.Fragment>
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
    </React.Fragment>
  );
}
