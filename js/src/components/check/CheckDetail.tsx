import {
  Box,
  Center,
  Checkbox,
  Flex,
  Icon,
  IconButton,
  Menu,
  MenuButton,
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

import { QueryDiffView } from "@/components/check/QueryDiffView";
import { ValueDiffResultView } from "@/components/valuediff/ValueDiffResultView";
import { SchemaDiffView } from "./SchemaDiffView";
import { useLocation } from "wouter";
import { CheckDescription } from "./CheckDescription";
import { QueryView } from "./QueryView";
import { RowCountDiffView } from "./RowCountDiffView";
import { ProfileDiffResultView } from "../profile/ProfileDiffResultView";
import { stripIndent } from "common-tags";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";
import { buildTitle, buildDescription, buildQuery } from "./check";

interface CheckDetailProps {
  checkId: string;
}

export const CheckDetail = ({ checkId }: CheckDetailProps) => {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { successToast, failToast } = useClipBoardToast();

  const {
    isLoading,
    error,
    data: check,
  } = useQuery({
    queryKey: cacheKeys.check(checkId),
    queryFn: () => getCheck(checkId),
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
  });

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

  if (isLoading) {
    return <Center h="100%">Loading</Center>;
  }

  if (error) {
    return <Center h="100%">Error: {error.message}</Center>;
  }

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

  const handleUpdateDescription = (description?: string) => {
    mutate({ description });
  };

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
            <MenuItem icon={<CopyIcon />} onClick={() => handleCopy()}>
              Copy markdown
            </MenuItem>
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

      {check && check.type === "query" && <QueryView check={check} />}
      {check && check.type === "query_diff" && <QueryDiffView check={check} />}
      {check && check.type === "value_diff" && check?.last_run && (
        <ValueDiffResultView run={check.last_run} />
      )}
      {check && check.type === "schema_diff" && (
        <SchemaDiffView check={check} />
      )}
      {check && check.type === "profile_diff" && check?.last_run && (
        <ProfileDiffResultView run={check.last_run} />
      )}
      {check && check.type === "row_count_diff" && (
        <RowCountDiffView check={check} />
      )}
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
