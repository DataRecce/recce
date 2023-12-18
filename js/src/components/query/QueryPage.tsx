import React, { useState, useCallback, useMemo } from "react";
import { Box, Button, Flex } from "@chakra-ui/react";
import SqlEditor from "./SqlEditor";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { submitQueryDiff } from "@/lib/api/runs";
import { createCheckByRun, updateCheck } from "@/lib/api/checks";
import { useRouter } from "next/navigation";
import { QueryDiffDataGrid } from "./QueryDiffDataGrid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";

export const QueryPage = () => {
  const { sqlQuery, setSqlQuery } = useRecceQueryContext();
  const [submittedQuery, setSubmittedQuery] = useState<string>();

  const router = useRouter();
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);

  const queryClient = useQueryClient();

  const {
    data: queryResult,
    mutate: runQuery,
    error: error,
    isPending,
  } = useMutation({
    mutationFn: () => submitQueryDiff({ sql_template: sqlQuery }),
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
    await updateCheck(check.check_id, {
      params: { ...check.params, primary_keys: primaryKeys },
    });

    setSubmittedQuery(undefined);

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    router.push("#checks");
  }, [queryResult?.run_id, router, primaryKeys]);

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
          onClick={() => runQuery()}
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
          onRun={() => runQuery()}
        />
      </Box>
      <Box backgroundColor="gray.100" height="50vh">
        <QueryDiffDataGrid
          isFetching={isPending}
          result={queryResult?.result}
          error={error}
          primaryKeys={primaryKeys}
          setPrimaryKeys={setPrimaryKeys}
        />
      </Box>
    </Flex>
  );
};
