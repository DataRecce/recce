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

export const QueryPage = () => {
  const { sqlQuery, setSqlQuery } = useRecceQueryContext();
  const [submittedQuery, setSubmittedQuery] = useState<string>();

  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const queryFn = async (type: "query" | "query_diff") => {
    if (type === "query") {
      return submitQuery({ sql_template: sqlQuery });
    } else {
      return submitQueryDiff({ sql_template: sqlQuery });
    }
  };

  const {
    data: queryResult,
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

  const addToChecklist = useCallback(async () => {
    if (!queryResult?.run_id) {
      return;
    }

    const check = await createCheckByRun(queryResult.run_id);

    if (queryResult.type === "query_diff") {
      await updateCheck(check.check_id, {
        params: { ...check.params, primary_keys: primaryKeys },
      });
    }

    setSubmittedQuery(undefined);

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [
    queryResult?.run_id,
    queryResult?.type,
    setLocation,
    primaryKeys,
    queryClient,
  ]);

  return (
    <Flex direction="column" height="100%">
      <Flex justifyContent="right" padding="5px" gap="5px">
        <Button
          colorScheme="blue"
          onClick={addToChecklist}
          isDisabled={
            isPending || !queryResult?.run_id || sqlQuery != submittedQuery
          }
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
          onRun={() => runQuery("query_diff")}
        />
      </Box>
      <Box backgroundColor="gray.100" height="50vh">
        {queryResult?.type === "query" && (
          <QueryDataGrid
            isFetching={isPending}
            result={queryResult?.result as QueryResult}
            error={error}
          />
        )}
        {queryResult?.type === "query_diff" && (
          <QueryDiffDataGrid
            isFetching={isPending}
            result={queryResult?.result as QueryDiffResult}
            error={error}
            primaryKeys={primaryKeys}
            setPrimaryKeys={setPrimaryKeys}
          />
        )}
      </Box>
    </Flex>
  );
};
