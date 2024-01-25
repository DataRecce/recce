import React, { useState, useCallback } from "react";
import { Box, Button, Flex } from "@chakra-ui/react";
import SqlEditor from "./SqlEditor";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";

import { createCheckByRun, updateCheck } from "@/lib/api/checks";
import {
  QueryDiffResultView,
  QueryDiffResultViewOptions,
} from "./QueryDiffResultView";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useLocation } from "wouter";
import { submitQuery, submitQueryDiff } from "@/lib/api/adhocQuery";
import { QueryResultView } from "./QueryResultView";
import { cancelRun, waitRun } from "@/lib/api/runs";
import { RunView } from "../run/RunView";
import { Run } from "@/lib/api/types";

export const QueryPage = () => {
  const { sqlQuery, setSqlQuery } = useRecceQueryContext();

  const [runType, setRunType] = useState<string>();
  const [runId, setRunId] = useState<string>();

  const [viewOptions, setViewOptions] = useState<QueryDiffResultViewOptions>(
    {}
  );

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
    error,
    isPending,
  } = useMutation({
    mutationFn: queryFn,
    onSuccess: (run) => {
      setViewOptions({});
    },
  });

  const handleCancel = useCallback(async () => {
    if (!runId) {
      return;
    }

    return await cancelRun(runId);
  }, [runId]);

  const addToChecklist = useCallback(
    async (run: Run<any, any>) => {
      if (!run?.run_id) {
        return;
      }

      const check = await createCheckByRun(run.run_id);

      if (run.type === "query_diff") {
        await updateCheck(check.check_id, {
          params: {
            ...check.params,
            primary_keys: viewOptions?.primaryKeys,
            changed_only: viewOptions?.changedOnly,
            pinned_columns: viewOptions?.pinnedColumns,
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      setLocation(`/checks/${check.check_id}`);
    },
    [setLocation, viewOptions, queryClient]
  );

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
      <Flex height="50vh" direction="column">
        {runType === "query" ? (
          <RunView
            key={runId}
            run={run}
            isPending={isPending}
            onCancel={handleCancel}
          >
            {(props) => (
              <QueryResultView {...props} onAddToChecklist={addToChecklist} />
            )}
          </RunView>
        ) : (
          <RunView
            key={runId}
            isPending={isPending}
            run={run}
            viewOptions={viewOptions}
            onViewOptionsChanged={setViewOptions}
            onCancel={handleCancel}
          >
            {(props) => (
              <QueryDiffResultView
                {...props}
                onAddToChecklist={addToChecklist}
              />
            )}
          </RunView>
        )}
      </Flex>
    </Flex>
  );
};
