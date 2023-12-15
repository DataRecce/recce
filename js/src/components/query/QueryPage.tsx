import React, { useState, useCallback, useMemo } from "react";
import { Box, Button, Flex } from "@chakra-ui/react";
import SqlEditor from "./SqlEditor";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { submitQueryDiff } from "@/lib/api/runs";
import { createCheckByRun } from "@/lib/api/checks";
import { useRouter } from "next/navigation";
import { QueryDiffDataGrid } from "./QueryDiffDataGrid";
import { useMutation } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";

export const QueryPage = () => {
  const { sqlQuery, setSqlQuery } = useRecceQueryContext();
  const [submittedQuery, setSubmittedQuery] = useState<string>();

  const router = useRouter();
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);

  const {
    data,
    mutate: runQuery,
    isPending,
  } = useMutation({
    mutationKey: cacheKeys.adhocQuery(),
    mutationFn: () => submitQueryDiff({ sql_template: sqlQuery }),
    onSuccess: () => {
      setPrimaryKeys([]);
      setSubmittedQuery(sqlQuery);
    },
  });

  const addToChecklist = useCallback(async () => {
    if (!data?.run_id) {
      return;
    }

    await createCheckByRun(data.run_id);
    setSubmittedQuery(undefined);
    router.push("#checks");
  }, [data?.run_id, router]);

  return (
    <Flex direction="column" height="100%">
      <Flex justifyContent="right" padding="5px" gap="5px">
        <Button
          colorScheme="blue"
          onClick={addToChecklist}
          isDisabled={isPending || !data?.run_id || sqlQuery != submittedQuery}
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
          onChange={(value) => setSqlQuery(value)}
          onRun={() => runQuery()}
        />
      </Box>
      <Box backgroundColor="gray.100" height="50vh">
        <QueryDiffDataGrid
          isFetching={isPending}
          result={data?.result}
          primaryKeys={primaryKeys}
          setPrimaryKeys={setPrimaryKeys}
        />
      </Box>
    </Flex>
  );
};
