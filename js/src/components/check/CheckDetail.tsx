import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Center,
  Checkbox,
  Flex,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Spacer,
} from "@chakra-ui/react";
import { CopyIcon, DeleteIcon } from "@chakra-ui/icons";
import { CheckBreadcrumb } from "./CheckBreadcrumb";
import { VscKebabVertical } from "react-icons/vsc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check, deleteCheck, getCheck, updateCheck } from "@/lib/api/checks";

import { ValueDiffResultView } from "@/components/valuediff/ValueDiffResultView";
import { SchemaDiffView } from "./SchemaDiffView";
import { useLocation } from "wouter";
import { CheckDescription } from "./CheckDescription";
import { RowCountDiffResultView } from "../rowcount/RowCountDiffView";
import { ProfileDiffResultView } from "../profile/ProfileDiffResultView";
import { stripIndent } from "common-tags";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";
import { buildTitle, buildDescription, buildQuery } from "./check";
import SqlEditor from "../query/SqlEditor";
import { QueryResultView } from "../query/QueryResultView";
import { QueryDiffResultView } from "../query/QueryDiffResultView";
import { useCallback, useEffect, useState } from "react";
import { cancelRun, submitRunFromCheck, waitRun } from "@/lib/api/runs";
import { Run } from "@/lib/api/types";
import { RunView } from "../run/RunView";
import { BiRefresh } from "react-icons/bi";

interface CheckDetailProps {
  checkId: string;
}

const typeResultViewMap: { [key: string]: any } = {
  query: QueryResultView,
  query_diff: QueryDiffResultView,
  value_diff: ValueDiffResultView,
  profile_diff: ProfileDiffResultView,
  row_count_diff: RowCountDiffResultView,
};

const useCancelOnUnmount = ({
  runId,
  isPending,
  setAborting,
}: {
  runId?: string;
  isPending?: boolean;
  setAborting: (aborting: boolean) => void;
}) => {
  useEffect(() => {
    return () => {
      setAborting(false);
      if (runId && isPending) {
        cancelRun(runId);
      }
    };
  }, [isPending, runId, setAborting]);
};

export const CheckDetail = ({ checkId }: CheckDetailProps) => {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { successToast, failToast } = useClipBoardToast();
  const [runId, setRunId] = useState<string>();
  const [progress, setProgress] = useState<Run["progress"]>();
  const [abort, setAborting] = useState(false);

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

  const RunResultView =
    check && check?.type in typeResultViewMap
      ? typeResultViewMap[check?.type]
      : undefined;

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

  useCancelOnUnmount({ runId, isPending: rerunPending, setAborting });
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

  const handleCheck: React.ChangeEventHandler = (event) => {
    const isChecked: boolean = (event.target as any).checked;
    mutate({ is_checked: isChecked });
  };

  const handelUpdateViewOptions = (viewOptions: any) => {
    mutate({ view_options: viewOptions });
  };

  const handleUpdateDescription = (description?: string) => {
    mutate({ description });
  };

  if (isLoading) {
    return <Center h="100%">Loading</Center>;
  }

  if (error) {
    return <Center h="100%">Error: {error.message}</Center>;
  }

  const run = rerunIdle ? check?.last_run : rerunRun;

  return (
    <Flex height="100%" width="100%" maxHeight="100%" direction="column">
      <Flex p="0px 16px" alignItems="center">
        <CheckBreadcrumb
          name={check?.name || ""}
          setName={(name) => {
            mutate({ name });
          }}
        />
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<Icon as={VscKebabVertical} />}
            variant="ghost"
          />
          <MenuList>
            {check && check?.type in typeResultViewMap && (
              <MenuItem icon={<CopyIcon />} onClick={() => handleRerun()}>
                Rerun
              </MenuItem>
            )}
            <MenuItem icon={<CopyIcon />} onClick={() => handleCopy()}>
              Copy markdown
            </MenuItem>
            <MenuDivider />
            <MenuItem icon={<DeleteIcon />} onClick={() => handleDelete()}>
              Delete
            </MenuItem>
          </MenuList>
        </Menu>
        <Spacer />
        <Checkbox isChecked={check?.is_checked} onChange={handleCheck}>
          Check
        </Checkbox>
      </Flex>

      {/* <Divider /> */}

      <Box p="8px 16px" minHeight="100px">
        <CheckDescription
          key={check?.check_id}
          value={check?.description}
          onChange={handleUpdateDescription}
        />
      </Box>

      {(check?.type === "query" || check?.type === "query_diff") && (
        <Accordion defaultIndex={[]} allowToggle>
          <AccordionItem>
            <AccordionButton>
              query
              <AccordionIcon />
            </AccordionButton>

            <AccordionPanel>
              <Box height="400px" width="100%" border="lightgray 1px solid ">
                <SqlEditor
                  value={(check?.params as any)?.sql_template || ""}
                  options={{ readOnly: true }}
                />
              </Box>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      )}

      <Box style={{ contain: "size" }} flex="1 1 0%">
        {RunResultView && (
          <RunView
            isPending={rerunPending}
            isAborting={abort}
            run={run}
            error={rerunError}
            progress={progress}
            RunResultView={RunResultView}
            viewOptions={check?.view_options}
            onViewOptionsChanged={handelUpdateViewOptions}
            onCancel={handleCancel}
          />
        )}
        {check && check.type === "schema_diff" && (
          <SchemaDiffView check={check} />
        )}
      </Box>
    </Flex>
  );
};

function buildMarkdown(check: Check) {
  return stripIndent`
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
