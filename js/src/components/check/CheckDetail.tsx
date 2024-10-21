import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
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
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spacer,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  TagLeftIcon,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react";
import {
  CheckCircleIcon,
  CopyIcon,
  DeleteIcon,
  RepeatIcon,
} from "@chakra-ui/icons";
import { CiBookmark } from "react-icons/ci";
import { IoMdCodeWorking } from "react-icons/io";
import { CheckBreadcrumb } from "./CheckBreadcrumb";
import { VscKebabVertical } from "react-icons/vsc";
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
import { useCallback, useEffect, useState } from "react";
import { cancelRun, submitRunFromCheck, waitRun } from "@/lib/api/runs";
import { Run } from "@/lib/api/types";
import { RunView } from "../run/RunView";
import { formatDistanceToNow } from "date-fns";
import { LineageDiffView } from "./LineageDiffView";
import { findByRunType } from "../run/registry";
import { PresetCheckTemplateView } from "./PresetCheckTemplateView";
import { VSplit } from "../split/Split";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";

interface CheckDetailProps {
  checkId: string;
}

export const CheckDetail = ({ checkId }: CheckDetailProps) => {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { successToast, failToast } = useClipBoardToast();
  const [runId, setRunId] = useState<string>();
  const [progress, setProgress] = useState<Run["progress"]>();
  const [abort, setAborting] = useState(false);
  const {
    isOpen: isPresetCheckTemplateOpen,
    onOpen: onPresetCheckTemplateOpen,
    onClose: onPresetCheckTemplateClose,
  } = useDisclosure();
  const Overlay = () => (
    <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px) " />
  );
  const [overlay, setOverlay] = useState(<Overlay />);

  const {
    isLoading,
    error,
    refetch,
    data: check,
  } = useQuery({
    queryKey: cacheKeys.check(checkId),
    queryFn: async () => getCheck(checkId),
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
  });

  const runTypeEntry = check?.type ? findByRunType(check?.type) : undefined;
  const isPresetCheck = check?.is_preset || false;

  const { mutate } = useMutation({
    mutationFn: (check: Partial<Check>) => updateCheck(checkId, check),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.check(checkId) });
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  const { mutate: handleDelete } = useMutation({
    mutationFn: () => deleteCheck(checkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      setLocation("/checks");
    },
  });

  const submitRunFn = async () => {
    const type = check?.type;
    if (!type) {
      return;
    }

    const { run_id } = await submitRunFromCheck(checkId, { nowait: true });

    setRunId(run_id);

    while (true) {
      const run = await waitRun(run_id, 2);
      setProgress(run.progress);
      if (run.result || run.error) {
        setAborting(false);
        setProgress(undefined);
        return run;
      }
    }
  };

  const {
    data: rerunRun,
    mutate: rerun,
    error: rerunError,
    isIdle: rerunIdle,
    isPending: rerunPending,
  } = useMutation({
    mutationFn: submitRunFn,
    onSuccess: (run) => {
      refetch();
    },
  });

  const handleRerun = async () => {
    rerun();
  };

  const handleCancel = useCallback(async () => {
    setAborting(true);
    if (!runId) {
      return;
    }

    return await cancelRun(runId);
  }, [runId]);

  const handleCopy = async () => {
    if (!check) {
      return;
    }

    const markdown = buildMarkdown(check);
    if (!navigator.clipboard) {
      failToast(
        "Failed to copy the check to clipboard",
        new Error(
          "Copy to clipboard is available only in secure contexts (HTTPS)"
        )
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
  }, [check?.is_checked, mutate]);

  const handelUpdateViewOptions = (viewOptions: any) => {
    mutate({ view_options: viewOptions });
  };

  const handleUpdateDescription = (description?: string) => {
    mutate({ description });
  };

  const { ref, onCopyToClipboard, onMouseEnter, onMouseLeave } =
    useCopyToClipboardButton();

  if (isLoading) {
    return <Center h="100%">Loading</Center>;
  }

  if (error) {
    return <Center h="100%">Error: {error.message}</Center>;
  }

  const run = rerunIdle ? check?.last_run : rerunRun;
  const relativeTime = run?.run_at
    ? formatDistanceToNow(new Date(run.run_at), { addSuffix: true })
    : null;

  return (
    <VSplit
      minSize={100}
      sizes={[30, 70]}
      style={{ height: "100%", width: "100%", maxHeight: "100%" }}
    >
      <Box
        style={{ contain: "strict" }}
        display="flex"
        flexDirection="column"
        overflow="auto"
      >
        <Flex p="0px 16px" alignItems="center">
          <CheckBreadcrumb
            name={check?.name || ""}
            setName={(name) => {
              mutate({ name });
            }}
          />
          <Spacer />
          {isPresetCheck && (
            <Tooltip label="Preset Check defined in recce config">
              <Tag size="sm">
                <TagLeftIcon boxSize={"14px"} as={CiBookmark} />
                Preset
              </Tag>
            </Tooltip>
          )}
          <Menu>
            <MenuButton
              isRound={true}
              as={IconButton}
              icon={<Icon as={VscKebabVertical} />}
              variant="ghost"
            />
            <MenuList>
              <MenuItem
                icon={<IoMdCodeWorking />}
                onClick={() => {
                  setOverlay(<Overlay />);
                  onPresetCheckTemplateOpen();
                }}
              >
                Get Preset Check Template
              </MenuItem>
              <MenuItem icon={<DeleteIcon />} onClick={() => handleDelete()}>
                Delete
              </MenuItem>
            </MenuList>
          </Menu>

          {relativeTime && (
            <Box
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              overflow="hidden"
              fontSize="10pt"
            >
              {relativeTime}
            </Box>
          )}

          {runTypeEntry?.RunResultView && (
            <Tooltip label="Rerun">
              <IconButton
                isRound={true}
                isLoading={rerunPending}
                variant="ghost"
                aria-label="Rerun"
                icon={<RepeatIcon />}
                onClick={() => handleRerun()}
              />
            </Tooltip>
          )}

          <Tooltip label="Copy markdown">
            <IconButton
              isRound={true}
              variant="ghost"
              aria-label="Copy markdown"
              icon={<CopyIcon />}
              onClick={() => handleCopy()}
            />
          </Tooltip>

          <Tooltip
            label={check?.is_checked ? "Mark as pending" : "Mark as approved"}
            placement="bottom-end"
          >
            <Button
              size="sm"
              colorScheme={check?.is_checked ? "green" : "gray"}
              leftIcon={<CheckCircleIcon />}
              onClick={() => handleApproveCheck()}
            >
              {check?.is_checked ? "Approved" : "Pending"}
            </Button>
          </Tooltip>
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
        <Tabs height="100%" display="flex" flexDirection="column">
          <TabList height="50px">
            <Tab fontSize="10pt">Result</Tab>
            {(check?.type === "query" || check?.type === "query_diff") && (
              <Tab fontSize="10pt">Query</Tab>
            )}
            <Spacer />
            <HStack mr="10px">
              <Button
                leftIcon={<CopyIcon />}
                variant="outline"
                isDisabled={!run?.result || !!run?.error}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                size="sm"
                onClick={onCopyToClipboard}
              >
                Copy to Clipboard
              </Button>
            </HStack>
          </TabList>
          <TabPanels height="100%" flex="1" style={{ contain: "strict" }}>
            <TabPanel p={0} width="100%" height="100%">
              {runTypeEntry?.RunResultView && (
                <RunView
                  ref={ref}
                  isPending={rerunPending}
                  isAborting={abort}
                  isCheckDetail={true}
                  run={run}
                  error={rerunError}
                  progress={progress}
                  RunResultView={runTypeEntry.RunResultView}
                  viewOptions={check?.view_options}
                  onViewOptionsChanged={handelUpdateViewOptions}
                  onCancel={handleCancel}
                  onExecuteRun={handleRerun}
                />
              )}
              {check && check.type === "schema_diff" && (
                <SchemaDiffView check={check} />
              )}
              {check && check.type === "lineage_diff" && (
                <LineageDiffView check={check} />
              )}
            </TabPanel>
            {(check?.type === "query" ||
              check?.type === "query_diff" ||
              check?.type === "query_base") && (
              <TabPanel p={0} height="100%" width="100%">
                {check.params?.base_sql_template ? (
                  <DualSqlEditor
                    value={(check?.params as any)?.sql_template || ""}
                    baseValue={(check?.params as any)?.base_sql_template || ""}
                    options={{ readOnly: true }}
                  />
                ) : (
                  <SqlEditor
                    value={(check?.params as any)?.sql_template || ""}
                    options={{ readOnly: true }}
                  />
                )}
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      </Box>
      <Modal
        isOpen={isPresetCheckTemplateOpen}
        onClose={onPresetCheckTemplateClose}
        isCentered
        size="6xl"
      >
        {overlay}
        <ModalContent overflowY="auto" height="40%" width="60%">
          <ModalHeader>Preset Check Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Heading size="sm" fontWeight="bold">
              <Highlight
                query="recce.yml"
                styles={{ px: "1", py: "0", bg: "red.100" }}
              >
                Please copy the following template and paste it into the
                recce.yml file.
              </Highlight>
            </Heading>
            <br />
            <PresetCheckTemplateView
              name={check?.name || ""}
              description={check?.description || ""}
              type={check?.type || ""}
              params={check?.params}
              viewOptions={check?.view_options}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </VSplit>
  );
};

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
