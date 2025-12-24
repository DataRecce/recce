import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { ReactNode, useCallback } from "react";
import { IconType } from "react-icons";
import { FaCheckCircle, FaRegCheckCircle } from "react-icons/fa";
import SimpleBar from "simplebar-react";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { createCheckByRun } from "@/lib/api/checks";
import { listRuns, waitRun } from "@/lib/api/runs";
import { Run } from "@/lib/api/types";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { findByRunType } from "../run/registry";
import "simplebar/dist/simplebar.min.css";
import MuiTooltip from "@mui/material/Tooltip";
import { PiX } from "react-icons/pi";
import { trackHistoryAction } from "@/lib/api/track";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useAppLocation } from "@/lib/hooks/useAppRouter";
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

  const IconComponent: IconType = findByRunType(run.type).icon;
  const checkId = run.check_id;
  const hideAddToChecklist = featureToggles.disableUpdateChecklist;

  return (
    <Box
      sx={(theme) => ({
        minWidth: "200px",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        p: "5px 20px",
        cursor: "pointer",
        borderBottom: "solid 1px",
        borderBottomColor: "divider",
        borderLeft: "4px solid",
        borderLeftColor: isSelected ? "amber.400" : "transparent",
        backgroundColor: isSelected
          ? theme.palette.mode === "dark"
            ? "amber.900"
            : "amber.50"
          : "transparent",
        "&:hover": {
          bgcolor: isSelected
            ? theme.palette.mode === "dark"
              ? "amber.800"
              : "orange.50"
            : theme.palette.mode === "dark"
              ? "grey.800"
              : "grey.200",
        },
      })}
      onClick={() => {
        onSelectRun(run.run_id);
      }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: "12px" }}
        onClick={() => {
          return void 0;
        }}
      >
        <IconComponent />
        <Box
          className="no-track-pii-safe"
          sx={{
            flex: 1,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            overflow: "hidden",
            color: run.name ? "inherit" : "grey.500",
            fontSize: "11pt",
            fontWeight: 500,
          }}
        >
          {(run.name ?? "").trim() || "<no name>"}
        </Box>
        {checkId ? (
          <MuiTooltip title="Go to Check">
            <Typography
              component="span"
              aria-label="Go to Check"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onGoToCheck(checkId);
              }}
            >
              <FaCheckCircle color="green" />
            </Typography>
          </MuiTooltip>
        ) : !hideAddToChecklist ? (
          <MuiTooltip title="Add to Checklist">
            <Typography
              component="span"
              aria-label="Add to Checklist"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                trackHistoryAction({ name: "add_to_checklist" });
                onAddToChecklist(run.run_id);
              }}
            >
              <FaRegCheckCircle />
            </Typography>
          </MuiTooltip>
        ) : null}
      </Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "start",
          fontSize: "11pt",
          color: "grey.500",
          gap: "3px",
          alignItems: "center",
        }}
      >
        <RunStatusAndDate run={fetchedRun ?? run} />
      </Box>
    </Box>
  );
};

const DateSegmentItem = ({ runAt }: { runAt?: string }) => {
  const dateTime = runAt ? formatRunDate(new Date(runAt)) : null;

  return (
    <Box
      sx={{
        minWidth: "200px",
        width: "100%",
        p: "5px 20px",
        borderBottom: "solid 1px",
        borderBottomColor: "divider",
        color: "grey.500",
        fontSize: "11pt",
      }}
    >
      {dateTime}
    </Box>
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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          width: "100%",
          flex: "0 0 54px",
          px: "24px 8px",
          borderBottom: "solid 1px",
          borderBottomColor: "divider",
        }}
      >
        <Typography variant="h6">History</Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton
          aria-label="Close History"
          onClick={() => {
            trackHistoryAction({ name: "hide" });
            closeHistory();
          }}
        >
          <PiX />
        </IconButton>
      </Stack>
      <Box sx={{ flex: "1 1 auto" }}>
        {isLoading ? (
          "Loading..."
        ) : runs?.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              color: "grey.400",
            }}
          >
            No runs
          </Box>
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
    </Box>
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
  const [, setLocation] = useAppLocation();
  const queryClient = useQueryClient();
  const { showRunId, runId } = useRecceActionContext();

  const currentDate = new Date(run.run_at).toDateString();
  const shouldRenderDateSegment =
    previousDate != null && previousDate !== currentDate;

  const handleSelectRun = (runId: string) => {
    trackHistoryAction({ name: "click_run" });
    showRunId(runId, false);
  };

  const handleAddToChecklist = useCallback(
    async (clickedRunId: string) => {
      const check = await createCheckByRun(clickedRunId);

      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      setLocation(`/checks/?id=${check.check_id}`);
    },
    [setLocation, queryClient],
  );

  const handleGoToCheck = useCallback(
    (checkId: string) => {
      trackHistoryAction({ name: "go_to_check" });
      setLocation(`/checks/?id=${checkId}`);
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
