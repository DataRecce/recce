"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { stripIndents } from "common-tags";
import { formatDistanceToNow } from "date-fns";
import React, {
  type MouseEvent,
  ReactNode,
  Ref,
  useCallback,
  useRef,
  useState,
} from "react";
import { IconType } from "react-icons";
import { CiBookmark } from "react-icons/ci";
import { IoMdCodeWorking } from "react-icons/io";
import { IoBookmarksOutline, IoClose } from "react-icons/io5";
import { PiCheckCircle, PiCopy, PiRepeat, PiTrashFill } from "react-icons/pi";
import { VscCircleLarge, VscKebabVertical } from "react-icons/vsc";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import { CheckTimeline } from "@/components/check/timeline";
import { isDisabledByNoResult } from "@/components/check/utils";
import {
  QueryDiffParams,
  QueryParams,
  QueryRunParams,
} from "@/lib/api/adhocQuery";
import { cacheKeys } from "@/lib/api/cacheKeys";
import {
  Check,
  deleteCheck,
  getCheck,
  markAsPresetCheck,
  updateCheck,
} from "@/lib/api/checks";
import { cancelRun, submitRunFromCheck } from "@/lib/api/runs";
import { trackCopyToClipboard } from "@/lib/api/track";
import { Run, RunParamTypes } from "@/lib/api/types";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceCheckContext } from "@/lib/hooks/RecceCheckContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";
import { useAppLocation } from "@/lib/hooks/useAppRouter";
import { useCheckToast } from "@/lib/hooks/useCheckToast";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";
import { useRun } from "@/lib/hooks/useRun";
import { LineageViewRef } from "../lineage/LineageView";
import SqlEditor, { DualSqlEditor } from "../query/SqlEditor";
import { RunView } from "../run/RunView";
import {
  findByRunType,
  RefTypes,
  RegistryEntry,
  ViewOptionTypes,
} from "../run/registry";
import { VSplit } from "../split/Split";
import { CheckBreadcrumb } from "./CheckBreadcrumb";
import { CheckDescription } from "./CheckDescription";
import { buildDescription, buildQuery, buildTitle } from "./check";
import { LineageDiffView } from "./LineageDiffView";
import {
  generateCheckTemplate,
  PresetCheckTemplateView,
} from "./PresetCheckTemplateView";
import { SchemaDiffView } from "./SchemaDiffView";

interface CheckDetailProps {
  checkId: string;
  refreshCheckList?: () => void;
}

type TabValueList = "result" | "query";

export function CheckDetail({
  checkId,
  refreshCheckList,
}: CheckDetailProps): ReactNode {
  const { featureToggles, sessionId } = useRecceInstanceContext();
  const { setLatestSelectedCheckId } = useRecceCheckContext();
  const { cloudMode } = useLineageGraphContext();
  const queryClient = useQueryClient();
  const [, setLocation] = useAppLocation();
  const { successToast, failToast } = useClipBoardToast();
  const { markedAsApprovedToast } = useCheckToast();
  const [submittedRunId, setSubmittedRunId] = useState<string>();
  const [progress] = useState<Run["progress"]>();
  const [isAborting, setAborting] = useState(false);
  const [isPresetCheckTemplateOpen, setIsPresetCheckTemplateOpen] =
    useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchorEl);

  const {
    isLoading,
    error,
    data: check,
  } = useQuery({
    queryKey: cacheKeys.check(checkId),
    queryFn: async () => getCheck(checkId),
    refetchOnMount: true,
  });

  const trackedRunId = submittedRunId ?? check?.last_run?.run_id;
  const { run, error: rerunError } = useRun(trackedRunId);
  const isRunning = submittedRunId
    ? !run || run.status === "running"
    : run?.status === "running";

  const runTypeEntry = check?.type ? findByRunType(check.type) : undefined;

  let RunResultView: RegistryEntry["RunResultView"] | undefined;
  if (runTypeEntry) {
    RunResultView =
      runTypeEntry.RunResultView as RegistryEntry["RunResultView"];
  }

  const isPresetCheck = check?.is_preset ?? false;

  const lineageViewRef = useRef<LineageViewRef>(null);

  const { mutate } = useMutation({
    mutationFn: (check: Partial<Check>) => updateCheck(checkId, check),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: cacheKeys.check(checkId),
      });
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  const { mutate: handleDelete } = useMutation({
    mutationFn: () => deleteCheck(checkId),
    onSuccess: async () => {
      setLatestSelectedCheckId("");
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      setLocation("/checks");
    },
  });

  const { mutate: handleMarkAsPresetCheck, isPending: isMarkingAsPreset } =
    useMutation({
      mutationFn: async () => {
        if (!check) {
          throw new Error("Check not found");
        }

        return await markAsPresetCheck(checkId);
      },
      onSuccess: async () => {
        successToast("Check marked as preset successfully");
        // Invalidate queries to refresh the check data
        await queryClient.invalidateQueries({
          queryKey: cacheKeys.check(checkId),
        });
      },
      onError: (error) => {
        failToast("Failed to mark check as preset", error);
      },
    });

  const handleRerun = useCallback(async () => {
    const type = check?.type;
    if (!type) {
      return;
    }

    const submittedRun = await submitRunFromCheck(checkId, { nowait: true });
    setSubmittedRunId(submittedRun.run_id);
    await queryClient.invalidateQueries({ queryKey: cacheKeys.check(checkId) });
    if (refreshCheckList) refreshCheckList(); // refresh the checklist to fetch correct last run status
  }, [check, checkId, queryClient, refreshCheckList]);

  const handleCancel = useCallback(async () => {
    setAborting(true);
    if (!trackedRunId) {
      return;
    }

    return await cancelRun(trackedRunId);
  }, [trackedRunId]);

  const handleCopy = async () => {
    if (!check) {
      return;
    }

    const markdown = buildMarkdown(check);
    // @see https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
    if (!window.isSecureContext) {
      failToast(
        "Failed to copy the check to clipboard",
        new Error(
          "Copy to clipboard is available only in secure contexts (HTTPS)",
        ),
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      successToast("Copied the check to the clipboard");
    } catch (err) {
      failToast("Failed to copy the check to clipboard", err);
    }
  };

  const handleApproveCheck = useCallback(() => {
    const isChecked = check?.is_checked;
    mutate({ is_checked: !isChecked });
    if (!isChecked) {
      markedAsApprovedToast();
    }
  }, [check?.is_checked, mutate, markedAsApprovedToast]);

  const handelUpdateViewOptions = (viewOptions: ViewOptionTypes) => {
    mutate({ view_options: viewOptions });
  };

  const handleUpdateDescription = (description?: string) => {
    mutate({ description });
  };

  const handleMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const [tabValue, setTabValue] = useState<TabValueList>("result");
  const { ref, onCopyToClipboard, onMouseEnter, onMouseLeave } =
    useCopyToClipboardButton();

  // Calculate during render instead of effect
  const presetCheckTemplate = generateCheckTemplate({
    name: check?.name ?? "",
    description: check?.description ?? "",
    type: check?.type ?? "",
    params: check?.params as Record<string, unknown>,
    viewOptions: check?.view_options as Record<string, unknown>,
  });

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        Loading
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        Error: <span className="no-track-pii-safe">{error.message}</span>
      </Box>
    );
  }

  if (!check) {
    return (
      <VSplit
        minSize={100}
        sizes={[30, 70]}
        style={{ height: "100%", width: "100%", maxHeight: "100%" }}
      >
        <Box
          style={{ contain: "strict" }}
          sx={{ display: "flex", flexDirection: "column" }}
        >
          <Box
            sx={{
              display: "flex",
              p: "0px 16px",
              alignItems: "center",
              height: 40,
            }}
          >
            <CheckBreadcrumb
              name="Check not found"
              setName={() => {
                // do nothing
              }}
            />
          </Box>
        </Box>
      </VSplit>
    );
  }

  const relativeTime = run?.run_at
    ? formatDistanceToNow(new Date(run.run_at), { addSuffix: true })
    : null;

  // Get the icon for the check type
  const checkTypeIcon: IconType | undefined = runTypeEntry?.icon;

  return (
    <VSplit
      minSize={100}
      sizes={[40, 60]}
      style={{ height: "100%", width: "100%", maxHeight: "100%" }}
    >
      <Box
        sx={{
          height: "100%",
          contain: "strict",
          display: "flex",
          flexDirection: "row",
        }}
      >
        {/* Main content area - takes remaining space */}
        <Box
          sx={{
            flex: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {/* Title bar with icon, name, and actions */}
          <Box
            sx={{
              display: "flex",
              p: "0px 16px",
              alignItems: "center",
              height: 40,
              borderBottom: "2px solid",
              borderColor: "grey.300",
            }}
          >
            {/* Check type icon */}
            {checkTypeIcon && (
              <Box
                component={checkTypeIcon}
                sx={{ fontSize: 20, mr: 1, flexShrink: 0 }}
              />
            )}
            <CheckBreadcrumb
              name={check.name}
              setName={(name) => {
                mutate({ name });
              }}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Stack direction="row" spacing={1} sx={{ mr: "10px" }}>
              {relativeTime && (
                <Box
                  sx={{
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    fontSize: "10pt",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {relativeTime}
                </Box>
              )}

              {/* Preset label moved to the right */}
              {isPresetCheck && (
                <MuiTooltip title="This is a preset check">
                  <Chip
                    size="small"
                    icon={<CiBookmark size="14px" />}
                    label="Preset"
                    sx={{ flex: "0 0 auto" }}
                  />
                </MuiTooltip>
              )}

              <IconButton size="small" onClick={handleMenuClick}>
                <VscKebabVertical />
              </IconButton>
              <Menu
                anchorEl={menuAnchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
              >
                {sessionId && (
                  <MenuItem
                    onClick={() => {
                      handleMarkAsPresetCheck();
                      handleMenuClose();
                    }}
                    disabled={isMarkingAsPreset || isPresetCheck}
                  >
                    <ListItemIcon>
                      <IoBookmarksOutline />
                    </ListItemIcon>
                    <ListItemText>Mark as Preset Check</ListItemText>
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    setIsPresetCheckTemplateOpen(true);
                    handleMenuClose();
                  }}
                >
                  <ListItemIcon>
                    <IoMdCodeWorking />
                  </ListItemIcon>
                  <ListItemText>Get Preset Check Template</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleCopy();
                    handleMenuClose();
                  }}
                >
                  <ListItemIcon>
                    <PiCopy />
                  </ListItemIcon>
                  <ListItemText>Copy Markdown</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem
                  onClick={() => {
                    handleDelete();
                    handleMenuClose();
                  }}
                  disabled={featureToggles.disableUpdateChecklist}
                  sx={{ color: "error.main" }}
                >
                  <ListItemIcon sx={{ color: "error.main" }}>
                    <PiTrashFill />
                  </ListItemIcon>
                  <ListItemText>Delete</ListItemText>
                </MenuItem>
              </Menu>

              <MuiTooltip
                title={
                  isDisabledByNoResult(check.type, run)
                    ? "Run the check first"
                    : "Mark as Approved"
                }
                placement="bottom-end"
              >
                <Button
                  size="small"
                  color={check.is_checked ? "success" : "neutral"}
                  variant={check.is_checked ? "contained" : "outlined"}
                  onClick={() => {
                    handleApproveCheck();
                  }}
                  disabled={
                    isDisabledByNoResult(check.type, run) ||
                    featureToggles.disableUpdateChecklist
                  }
                  startIcon={
                    check.is_checked ? (
                      <PiCheckCircle />
                    ) : (
                      <VscCircleLarge style={{ color: "lightgray" }} />
                    )
                  }
                  sx={{ flex: "0 0 auto", textTransform: "none" }}
                >
                  {check.is_checked ? "Approved" : "Pending"}
                </Button>
              </MuiTooltip>
            </Stack>
          </Box>

          {/* Description area */}
          <Box sx={{ flex: 1, p: "8px 16px", minHeight: 100 }}>
            <CheckDescription
              key={check.check_id}
              value={check.description}
              onChange={handleUpdateDescription}
            />
          </Box>
        </Box>
        {/* Timeline/Activity panel - fixed 20% width, hidden on mobile */}
        {cloudMode && (
          <Box
            sx={{
              width: "20%",
              minWidth: 250,
              maxWidth: 350,
              height: "100%",
              overflow: "hidden",
              flexShrink: 0,
              display: { xs: "none", md: "block" },
            }}
          >
            <CheckTimeline checkId={checkId} />
          </Box>
        )}
      </Box>

      <Box style={{ contain: "strict" }}>
        <Box
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              borderBottom: 1,
              borderColor: "divider",
              height: 50,
            }}
          >
            <Tabs
              value={tabValue}
              onChange={(_, newValue) => setTabValue(newValue as TabValueList)}
            >
              <Tab
                label="Result"
                value="result"
                sx={{ fontSize: "0.75rem", textTransform: "none" }}
              />
              {(check.type === "query" || check.type === "query_diff") && (
                <Tab
                  label="Query"
                  value="query"
                  sx={{ fontSize: "0.75rem", textTransform: "none" }}
                />
              )}
            </Tabs>
            <Box sx={{ flexGrow: 1 }} />
            <Stack direction="row" spacing={1} sx={{ mr: "10px" }}>
              {RunResultView && (
                <MuiTooltip title="Rerun">
                  <Button
                    variant="outlined"
                    color="neutral"
                    size="small"
                    onClick={() => handleRerun()}
                    disabled={featureToggles.disableDatabaseQuery || isRunning}
                    startIcon={<PiRepeat />}
                    sx={{ textTransform: "none" }}
                  >
                    {isRunning ? "Running..." : "Rerun"}
                  </Button>
                </MuiTooltip>
              )}
              <Button
                variant="outlined"
                color="neutral"
                disabled={
                  isDisabledByNoResult(check.type, run) || tabValue !== "result"
                }
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                size="small"
                onClick={async () => {
                  if (check.type === "lineage_diff") {
                    lineageViewRef.current?.copyToClipboard();
                  } else {
                    await onCopyToClipboard();
                  }
                  trackCopyToClipboard({ type: check.type, from: "check" });
                }}
                startIcon={<PiCopy />}
                sx={{ textTransform: "none" }}
              >
                Copy to Clipboard
              </Button>
            </Stack>
          </Box>
          <Box sx={{ flex: 1, contain: "strict" }}>
            {tabValue === "result" && (
              <Box sx={{ width: "100%", height: "100%" }}>
                {RunResultView &&
                  (check.last_run || trackedRunId ? (
                    <RunView
                      ref={ref as unknown as Ref<RefTypes>}
                      isRunning={isRunning}
                      isAborting={isAborting}
                      run={trackedRunId ? run : check.last_run}
                      error={rerunError}
                      progress={progress}
                      RunResultView={RunResultView}
                      viewOptions={check.view_options as ViewOptionTypes}
                      onViewOptionsChanged={handelUpdateViewOptions}
                      onCancel={handleCancel}
                      onExecuteRun={handleRerun}
                    />
                  ) : (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "rgb(249,249,249)",
                        height: "100%",
                      }}
                    >
                      <Stack spacing={2} alignItems="center">
                        <Box>
                          This action is part of the initial preset and has not
                          been performed yet. Once performed, the result will be
                          shown here.
                        </Box>
                        <SetupConnectionPopover
                          display={featureToggles.mode === "metadata only"}
                        >
                          <Button
                            onClick={handleRerun}
                            variant="contained"
                            size="small"
                            disabled={featureToggles.disableDatabaseQuery}
                          >
                            Run Query
                          </Button>
                        </SetupConnectionPopover>
                      </Stack>
                    </Box>
                  ))}
                {check.type === "schema_diff" && (
                  <SchemaDiffView
                    key={check.check_id}
                    check={check}
                    ref={ref}
                  />
                )}
                {check.type === "lineage_diff" && (
                  <LineageDiffView
                    key={check.check_id}
                    check={check}
                    ref={lineageViewRef}
                  />
                )}
              </Box>
            )}
            {tabValue === "query" &&
              (check.type === "query" ||
                check.type === "query_diff" ||
                check.type === "query_base") && (
                <Box sx={{ height: "100%", width: "100%" }}>
                  {(check.params as QueryParams).base_sql_template ? (
                    <DualSqlEditor
                      value={
                        (check.params as QueryDiffParams).sql_template || ""
                      }
                      baseValue={
                        (check.params as QueryDiffParams).base_sql_template ??
                        ""
                      }
                      options={{ readOnly: true }}
                    />
                  ) : (
                    <SqlEditor
                      value={
                        (check.params as QueryRunParams).sql_template || ""
                      }
                      options={{ readOnly: true }}
                    />
                  )}
                </Box>
              )}
          </Box>
        </Box>
      </Box>
      <MuiDialog
        open={isPresetCheckTemplateOpen}
        onClose={() => setIsPresetCheckTemplateOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Preset Check Template</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
            Please{" "}
            <Typography
              component="span"
              sx={{
                cursor: "pointer",
                "&:hover": { textDecoration: "underline" },
                color: "primary.main",
              }}
              onClick={async () => {
                await navigator.clipboard.writeText(presetCheckTemplate);
                successToast("Copied the template to the clipboard");
              }}
            >
              copy
            </Typography>{" "}
            the following template and paste it into the{" "}
            <Box
              component="span"
              sx={{ px: 0.5, bgcolor: "error.light", borderRadius: 0.5 }}
            >
              recce.yml
            </Box>{" "}
            file.
          </Typography>
          <PresetCheckTemplateView yamlTemplate={presetCheckTemplate} />
        </DialogContent>
        <DialogActions>
          <IconButton
            size="small"
            onClick={() => setIsPresetCheckTemplateOpen(false)}
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            <IoClose />
          </IconButton>
        </DialogActions>
      </MuiDialog>
    </VSplit>
  );
}

function buildMarkdown(check: Check<RunParamTypes>) {
  return stripIndents`
  <details><summary>${buildTitle(check)}</summary>

  ${buildBody(check)}

  </details>`;
}

function buildBody(check: Check<RunParamTypes>) {
  if (check.type === "query" || check.type === "query_diff") {
    return `${buildDescription(check)}\n\n${buildQuery(check)}`;
  }

  return buildDescription(check);
}
