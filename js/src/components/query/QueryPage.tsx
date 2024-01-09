import React, { useState, useCallback } from "react";
import {
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  Spacer,
  Tooltip,
} from "@chakra-ui/react";
import SqlEditor from "./SqlEditor";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";

import { createCheckByRun, updateCheck } from "@/lib/api/checks";
import { QueryDiffDataGrid } from "./QueryDiffDataGrid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useLocation, useRouter } from "wouter";
import {
  QueryDiffResult,
  QueryResult,
  submitQuery,
  submitQueryDiff,
} from "@/lib/api/adhocQuery";
import { QueryDataGrid } from "./QueryDataGrid";
import { cancelRun, waitRun } from "@/lib/api/runs";
import { AddIcon } from "@chakra-ui/icons";

export const QueryPage = () => {
  const { sqlQuery, setSqlQuery } = useRecceQueryContext();

  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [runType, setRunType] = useState<string>();
  const [runId, setRunId] = useState<string>();
  const [changedOnly, setChangedOnly] = useState(false);

  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const queryFn = async (type: "query" | "query_diff") => {
    setRunType(type);
    const { run_id } =
      type === "query"
        ? await submitQuery({ sql_template: sqlQuery }, { nowait: true })
        : await submitQueryDiff({ sql_template: sqlQuery }, { nowait: true });
    setRunId(run_id);

    return await waitRun(run_id);
  };

  const handleCheckboxChange = () => {
    setChangedOnly(!changedOnly);
  };

  const {
    data: run,
    mutate: runQuery,
    error: error,
    isPending,
  } = useMutation({
    mutationFn: queryFn,
    onSuccess: (run) => {
      setPrimaryKeys([]);
      setChangedOnly(false);
    },
  });

  const handleCancel = useCallback(async () => {
    if (!runId) {
      return;
    }

    return await cancelRun(runId);
  }, [runId]);

  const addToChecklist = useCallback(async () => {
    if (!run?.run_id) {
      return;
    }

    const check = await createCheckByRun(run.run_id);

    if (run.type === "query_diff") {
      await updateCheck(check.check_id, {
        params: {
          ...check.params,
          primary_keys: primaryKeys,
          changed_only: changedOnly,
        },
      });
    }

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [
    run?.run_id,
    run?.type,
    setLocation,
    primaryKeys,
    queryClient,
    changedOnly,
  ]);

  const hasResult = !isPending && run?.run_id && !run?.error;

  return (
    <Flex direction="column" height="100%">
      <Flex justifyContent="right" padding="5px" gap="5px">
        <Button
          colorScheme="blue"
          onClick={() => runQuery("query_diff")}
          isDisabled={isPending}
          size="sm"
        >
          Run Diff
        </Button>
        <Button
          colorScheme="blue"
          onClick={() => runQuery("query")}
          isDisabled={isPending}
          size="sm"
        >
          Run
        </Button>
      </Flex>
      <Box flex="1" border={"1px solid #CBD5E0"} height="200px" width="100%">
        <SqlEditor
          value={sqlQuery}
          onChange={setSqlQuery}
          onRun={() => runQuery("query")}
          onRunDiff={() => runQuery("query_diff")}
        />
      </Box>
      <Flex backgroundColor="rgb(249,249,249)" height="50vh" direction="column">
        {hasResult && (
          <Flex
            borderBottom="1px solid lightgray"
            justifyContent="flex-end"
            gap="5px"
          >
            {runType === "query_diff" && (
              <Checkbox isChecked={changedOnly} onChange={handleCheckboxChange}>
                Changed only
              </Checkbox>
            )}
            <Tooltip label="Add to Checklist">
              <IconButton
                variant="unstyled"
                size="sm"
                aria-label="Add"
                icon={<AddIcon />}
                onClick={addToChecklist}
              />
            </Tooltip>
          </Flex>
        )}
        {runType === "query" ? (
          <QueryDataGrid
            key={runId}
            isFetching={isPending}
            run={run}
            error={error}
            onCancel={handleCancel}
            enableScreenshot={false}
          />
        ) : (
          <QueryDiffDataGrid
            key={runId}
            isFetching={isPending}
            run={run}
            error={error}
            changedOnly={changedOnly}
            primaryKeys={primaryKeys}
            setPrimaryKeys={setPrimaryKeys}
            onCancel={handleCancel}
            enableScreenshot={false}
          />
        )}
      </Flex>
    </Flex>
  );
};
