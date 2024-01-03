import React, { useState, useCallback } from "react";
import { Box, Button, Flex } from "@chakra-ui/react";
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

export const QueryPage = () => {
  const { sqlQuery, setSqlQuery } = useRecceQueryContext();
  const [submittedQuery, setSubmittedQuery] = useState<string>();

  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [runType, setRunType] = useState<string>();
  const [runId, setRunId] = useState<string>();

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

  const {
    data: run,
    mutate: runQuery,
    error: error,
    isPending,
  } = useMutation({
    mutationFn: queryFn,
    onSuccess: (run) => {
      setPrimaryKeys([]);
      setSubmittedQuery(sqlQuery);
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
        params: { ...check.params, primary_keys: primaryKeys },
      });
    }

    setSubmittedQuery(undefined);

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [run?.run_id, run?.type, setLocation, primaryKeys, queryClient]);

  return (
    <Flex direction="column" height="100%">
      <Flex justifyContent="right" padding="5px" gap="5px">
        <Button
          colorScheme="blue"
          onClick={addToChecklist}
          isDisabled={isPending || !run?.run_id || sqlQuery != submittedQuery}
          size="sm"
        >
          Add to Checklist
        </Button>
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
      <Box backgroundColor="gray.100" height="50vh">
        {runType === "query" ? (
          <QueryDataGrid
            key={runId}
            isFetching={isPending}
            run={run}
            error={error}
            onCancel={handleCancel}
          />
        ) : (
          <QueryDiffDataGrid
            key={runId}
            isFetching={isPending}
            run={run}
            error={error}
            primaryKeys={primaryKeys}
            setPrimaryKeys={setPrimaryKeys}
            onCancel={handleCancel}
          />
        )}
      </Box>
    </Flex>
  );
};
