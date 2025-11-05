import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  Highlight,
  HStack,
  Icon,
  IconButton,
  Menu,
  Spacer,
  Tabs,
  Tag,
  useDisclosure,
  Text,
  VStack,
  Dialog,
  Portal,
  MenuSeparator,
  CloseButton,
} from "@chakra-ui/react";
import { CiBookmark } from "react-icons/ci";
import { IoMdCodeWorking } from "react-icons/io";
import { CheckBreadcrumb } from "./CheckBreadcrumb";
import { VscCircleLarge, VscKebabVertical } from "react-icons/vsc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check, deleteCheck, getCheck, updateCheck } from "@/lib/api/checks";

import { SchemaDiffView } from "./SchemaDiffView";
import { useLocation } from "wouter";
import { CheckDescription } from "./CheckDescription";
import { stripIndents } from "common-tags";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";
import { buildTitle, buildDescription, buildQuery } from "./check";
import SqlEditor, { DualSqlEditor } from "../query/SqlEditor";
import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cancelRun, submitRunFromCheck } from "@/lib/api/runs";
import { Run } from "@/lib/api/types";
import { RunView } from "../run/RunView";
import { formatDistanceToNow } from "date-fns";
import { LineageDiffView } from "./LineageDiffView";
import { findByRunType } from "../run/registry";
import { generateCheckTemplate, PresetCheckTemplateView } from "./PresetCheckTemplateView";
import { VSplit } from "../split/Split";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";
import { useRun } from "@/lib/hooks/useRun";
import { useCheckToast } from "@/lib/hooks/useCheckToast";
import { LineageViewRef } from "../lineage/LineageView";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { trackCopyToClipboard } from "@/lib/api/track";
import { Tooltip } from "@/components/ui/tooltip";
import { PiCheckCircle, PiCopy, PiRepeat, PiTrashFill } from "react-icons/pi";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import { useRecceCheckContext } from "@/lib/hooks/RecceCheckContext";

export const isDisabledByNoResult = (type: string, run: Run | undefined): boolean => {
  if (type === "schema_diff" || type === "lineage_diff") {
    return false;
  }
  return !run?.result || !!run.error;
};

interface CheckDetailProps {
  checkId: string;
  refreshCheckList?: () => void;
}

type TabValueList = "result" | "query";

export const CheckDetail = ({ checkId, refreshCheckList }: CheckDetailProps) => {
  const { featureToggles } = useRecceInstanceContext();
  const { setLatestSelectedCheckId } = useRecceCheckContext();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { successToast, failToast } = useClipBoardToast();
  const { markedAsApprovedToast } = useCheckToast();
  const [submittedRunId, setSubmittedRunId] = useState<string>();
  const [progress] = useState<Run["progress"]>();
  const [isAborting, setAborting] = useState(false);
  const [presetCheckTemplate, setPresetCheckTemplate] = useState<string>("");
  const {
    open: isPresetCheckTemplateOpen,
    onOpen: onPresetCheckTemplateOpen,
    onClose: onPresetCheckTemplateClose,
  } = useDisclosure();
  const [overlay, setOverlay] = useState(<Overlay />);

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
  const isRunning = submittedRunId ? !run || run.status === "running" : run?.status === "running";

  const runTypeEntry = check?.type ? findByRunType(check.type) : undefined;
  const isPresetCheck = check?.is_preset ?? false;

  const lineageViewRef = useRef<LineageViewRef>(null);

  const { mutate } = useMutation({
    mutationFn: (check: Partial<Check>) => updateCheck(checkId, check),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cacheKeys.check(checkId) });
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

  const handleRerun = useCallback(async () => {
    const type = check?.type;
    if (!type) {
      return;
    }

    const submittedRun = await submitRunFromCheck(checkId, { nowait: true });
    setSubmittedRunId(submittedRun.run_id);
    await queryClient.invalidateQueries({ queryKey: cacheKeys.check(checkId) });
    if (refreshCheckList) refreshCheckList(); // refresh the checklist to fetch correct last run status
  }, [check, checkId, setSubmittedRunId, queryClient, refreshCheckList]);

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
        new Error("Copy to clipboard is available only in secure contexts (HTTPS)"),
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

  const handelUpdateViewOptions = (viewOptions: any) => {
    mutate({ view_options: viewOptions });
  };

  const handleUpdateDescription = (description?: string) => {
    mutate({ description });
  };

  const [tabValue, setTabValue] = useState<TabValueList>("result");
  const { ref, onCopyToClipboard, onMouseEnter, onMouseLeave } = useCopyToClipboardButton();

  useEffect(() => {
    const template = generateCheckTemplate({
      name: check?.name ?? "",
      description: check?.description ?? "",
      type: check?.type ?? "",
      params: check?.params,
      viewOptions: check?.view_options,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPresetCheckTemplate(template);
  }, [check]);

  if (isLoading) {
    return <Center h="100%">Loading</Center>;
  }

  if (error) {
    return (
      <Center h="100%">
        Error: <span className="no-track-pii-safe">{error.message}</span>
      </Center>
    );
  }

  const relativeTime = run?.run_at
    ? formatDistanceToNow(new Date(run.run_at), { addSuffix: true })
    : null;

  return (
    <VSplit
      minSize={100}
      sizes={[30, 70]}
      style={{ height: "100%", width: "100%", maxHeight: "100%" }}>
      <Box style={{ contain: "strict" }} display="flex" flexDirection="column">
        <Flex p="0px 16px" alignItems="center" h="40px">
          <CheckBreadcrumb
            name={check?.name ?? ""}
            setName={(name) => {
              mutate({ name });
            }}
          />
          {isPresetCheck && (
            <Tooltip content="Preset Check defined in recce config">
              <Tag.Root size="sm" flex="0 0 auto" ml="2">
                <Tag.StartElement>
                  <CiBookmark size="14px" />
                </Tag.StartElement>
                <Tag.Label>Preset</Tag.Label>
              </Tag.Root>
            </Tooltip>
          )}
          <Spacer />
          <HStack mr="10px">
            {relativeTime && (
              <Box textOverflow="ellipsis" whiteSpace="nowrap" overflow="hidden" fontSize="10pt">
                {relativeTime}
              </Box>
            )}

            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton rounded="full" variant="ghost" size="sm">
                  <Icon as={VscKebabVertical} />
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item
                      value="preset-check-template"
                      onClick={() => {
                        setOverlay(<Overlay />);
                        onPresetCheckTemplateOpen();
                      }}>
                      <Flex alignItems="center" gap={1} textStyle="sm">
                        <IoMdCodeWorking /> Get Preset Check Template
                      </Flex>
                    </Menu.Item>
                    <Menu.Item value="copy-markdown" onClick={() => handleCopy()}>
                      <Flex alignItems="center" gap={1} textStyle="sm">
                        <PiCopy /> Copy Markdown
                      </Flex>
                    </Menu.Item>
                    <MenuSeparator />
                    <Menu.Item
                      value="delete"
                      color="red.solid"
                      onClick={() => {
                        handleDelete();
                      }}
                      disabled={featureToggles.disableUpdateChecklist}>
                      <Flex alignItems="center" gap={1} textStyle="sm">
                        <PiTrashFill /> Delete
                      </Flex>
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>

            <Tooltip
              content={
                isDisabledByNoResult(check?.type ?? "", run)
                  ? "Run the check first"
                  : check?.is_checked
                    ? "Mark as Pending"
                    : "Mark as Approved"
              }
              positioning={{ placement: "bottom-end" }}>
              <Button
                flex="0 0 auto"
                size="sm"
                colorPalette={check?.is_checked ? "green" : "gray"}
                variant={check?.is_checked ? "solid" : "outline"}
                onClick={() => {
                  handleApproveCheck();
                }}
                disabled={
                  isDisabledByNoResult(check?.type ?? "", run) ||
                  featureToggles.disableUpdateChecklist
                }>
                {check?.is_checked ? (
                  <PiCheckCircle />
                ) : (
                  <Icon as={VscCircleLarge} color="lightgray" />
                )}{" "}
                {check?.is_checked ? "Approved" : "Mark as Approved"}
              </Button>
            </Tooltip>
          </HStack>
        </Flex>

        <Box flex="1" p="8px 16px" minHeight="100px">
          <CheckDescription
            key={check?.check_id}
            value={check?.description}
            onChange={handleUpdateDescription}
          />
        </Box>
        {/* </Flex> */}
      </Box>

      <Box style={{ contain: "strict" }}>
        <Tabs.Root
          height="100%"
          display="flex"
          flexDirection="column"
          value={tabValue}
          onValueChange={(e) => {
            setTabValue(e.value as TabValueList);
          }}>
          <Tabs.List height="50px">
            <Tabs.Trigger value="result" fontSize="0.75rem">
              Result
            </Tabs.Trigger>
            {(check?.type === "query" || check?.type === "query_diff") && (
              <Tabs.Trigger value="query" fontSize="0.75rem">
                Query
              </Tabs.Trigger>
            )}
            <Spacer />
            <HStack mr="10px">
              {runTypeEntry?.RunResultView && (
                <Tooltip content="Rerun">
                  <Button
                    variant="outline"
                    loading={isRunning}
                    size="sm"
                    onClick={() => handleRerun()}
                    disabled={featureToggles.disableDatabaseQuery}>
                    <PiRepeat /> Rerun
                  </Button>
                </Tooltip>
              )}
              <Button
                variant="outline"
                disabled={isDisabledByNoResult(check?.type ?? "", run) || tabValue !== "result"}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                size="sm"
                onClick={async () => {
                  if (check?.type === "lineage_diff") {
                    lineageViewRef.current?.copyToClipboard();
                  } else {
                    await onCopyToClipboard();
                  }
                  trackCopyToClipboard({ type: check?.type ?? "unknown", from: "check" });
                }}>
                <PiCopy /> Copy to Clipboard
              </Button>
            </HStack>
          </Tabs.List>
          <Tabs.ContentGroup height="100%" flex="1" style={{ contain: "strict" }}>
            <Tabs.Content value="result" p={0} width="100%" height="100%">
              {runTypeEntry?.RunResultView &&
                (check?.last_run || trackedRunId ? (
                  <RunView
                    ref={ref}
                    isRunning={isRunning}
                    isAborting={isAborting}
                    run={trackedRunId ? run : check?.last_run}
                    error={rerunError}
                    progress={progress}
                    RunResultView={runTypeEntry.RunResultView}
                    viewOptions={check?.view_options}
                    onViewOptionsChanged={handelUpdateViewOptions}
                    onCancel={handleCancel}
                    onExecuteRun={handleRerun}
                  />
                ) : (
                  <Center bg="rgb(249,249,249)" height="100%">
                    <VStack gap={4}>
                      <Box>
                        This action is part of the initial preset and has not been performed yet.
                        Once performed, the result will be shown here.
                      </Box>
                      <SetupConnectionPopover display={featureToggles.mode === "metadata only"}>
                        <Button
                          onClick={handleRerun}
                          colorPalette="blue"
                          size="sm"
                          disabled={featureToggles.disableDatabaseQuery}>
                          Run Query
                        </Button>
                      </SetupConnectionPopover>
                    </VStack>
                  </Center>
                ))}
              {check?.type === "schema_diff" && (
                <SchemaDiffView key={check.check_id} check={check} ref={ref} />
              )}
              {check?.type === "lineage_diff" && (
                <LineageDiffView key={check.check_id} check={check} ref={lineageViewRef} />
              )}
            </Tabs.Content>
            {(check?.type === "query" ||
              check?.type === "query_diff" ||
              check?.type === "query_base") && (
              <Tabs.Content value="query" p={0} height="100%" width="100%">
                {check.params?.base_sql_template ? (
                  <DualSqlEditor
                    value={check.params?.sql_template ?? ""}
                    baseValue={check.params?.base_sql_template ?? ""}
                    options={{ readOnly: true }}
                  />
                ) : (
                  <SqlEditor
                    value={check.params?.sql_template ?? ""}
                    options={{ readOnly: true }}
                  />
                )}
              </Tabs.Content>
            )}
          </Tabs.ContentGroup>
        </Tabs.Root>
      </Box>
      <Dialog.Root
        open={isPresetCheckTemplateOpen}
        onOpenChange={onPresetCheckTemplateClose}
        placement="center"
        size="xl">
        <Portal>
          {overlay}
          <Dialog.Positioner>
            <Dialog.Content overflowY="auto" height="40%" width="60%">
              <Dialog.Header>
                <Dialog.Title>Preset Check Template</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Heading size="sm" fontWeight="bold">
                  Please{" "}
                  <Text
                    as="span"
                    cursor="pointer"
                    _hover={{ textDecoration: "underline" }}
                    color={"blue.500"}
                    onClick={async () => {
                      await navigator.clipboard.writeText(presetCheckTemplate);
                      successToast("Copied the template to the clipboard");
                    }}>
                    copy
                  </Text>{" "}
                  the following template and paste it into the{" "}
                  <Highlight query="recce.yml" styles={{ px: "1", py: "0", bg: "red.100" }}>
                    recce.yml
                  </Highlight>{" "}
                  file.
                </Heading>
                <br />
                <PresetCheckTemplateView yamlTemplate={presetCheckTemplate} />
              </Dialog.Body>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VSplit>
  );
};

function Overlay(): ReactNode {
  return <Dialog.Backdrop bg="blackAlpha.300" backdropFilter="blur(10px) " />;
}

function buildMarkdown(check: Check) {
  return stripIndents`
  <details><summary>${buildTitle(check)}</summary>

  ${buildBody(check)}

  </details>`;
}

function buildBody(check: Check) {
  if (check.type === "query" || check.type === "query_diff") {
    return `${buildDescription(check)}\n\n${buildQuery(check)}`;
  }

  return buildDescription(check);
}
