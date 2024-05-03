import React, { useState, useCallback } from "react";
import { Box, Button, Flex } from "@chakra-ui/react";
import SqlEditor from "./SqlEditor";
import {
  defaultSqlQuery,
  useRecceQueryContext,
} from "@/lib/hooks/RecceQueryContext";

import { createCheckByRun } from "@/lib/api/checks";
import { QueryDiffResultView } from "./QueryDiffResultView";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useLocation } from "wouter";
import {
  QueryDiffViewOptions,
  QueryViewOptions,
  submitQuery,
  submitQueryDiff,
} from "@/lib/api/adhocQuery";
import { QueryResultView } from "./QueryResultView";
import { cancelRun, waitRun } from "@/lib/api/runs";
import { RunView } from "../run/RunView";
import { Run } from "@/lib/api/types";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { QueryForm } from "./QueryForm";

import Split from "react-split";
import "./styles.css";

export const QueryPage = () => {
  const {
    sqlQuery: _sqlQuery,
    setSqlQuery,
    primaryKeys,
    setPrimaryKeys,
  } = useRecceQueryContext();
  const { envInfo } = useLineageGraphContext();

  let sqlQuery = _sqlQuery;
  if (envInfo?.adapterType === "sqlmesh" && _sqlQuery === defaultSqlQuery) {
    sqlQuery = `select * from db.mymodel`;
  }

  const [runType, setRunType] = useState<string>();
  const [runId, setRunId] = useState<string>();

  const [viewOptions, setViewOptions] = useState<
    QueryDiffViewOptions | QueryViewOptions
  >({});

  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const queryFn = async (type: "query" | "query_diff") => {
    setRunType(type);
    const { run_id } =
      type === "query"
        ? await submitQuery({ sql_template: sqlQuery }, { nowait: true })
        : await submitQueryDiff(
            { sql_template: sqlQuery, primary_keys: primaryKeys },
            { nowait: true }
          );
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

      const check = await createCheckByRun(run.run_id, viewOptions);
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      setLocation(`/checks/${check.check_id}`);
    },
    [setLocation, viewOptions, queryClient]
  );

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
      <Split
        className="split"
        direction="vertical"
        minSize={100}
        gutterSize={2}
        style={{ height: "100%" }}
      >
        <Flex direction="row" height="300px">
          <Box width="70%" border={"1px solid #CBD5E0"}>
            <SqlEditor
              value={sqlQuery}
              onChange={setSqlQuery}
              onRun={() => runQuery("query")}
              onRunDiff={() => runQuery("query_diff")}
            />
          </Box>
          <QueryForm
            ml="10px"
            p="5px"
            width="30%"
            border="1px"
            borderColor="gray.300"
            defaultPrimaryKeys={primaryKeys}
            onPrimaryKeysChange={setPrimaryKeys}
          />
        </Flex>
        <Flex flex="1" direction="column">
          {runType === "query" ? (
            <RunView
              key={runId}
              run={run}
              error={error}
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
              error={error}
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
      </Split>
    </Flex>
  );
};
