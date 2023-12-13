import React, { useState, useCallback, useMemo } from "react";
import { toDataGrid } from "@/components/query/query";
import { Box, Button, Flex } from "@chakra-ui/react";
import SqlEditor from "./SqlEditor";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { useSubmitRun } from "@/lib/api/runs";
import { createCheckByRun } from "@/lib/api/checks";
import { useRouter } from "next/navigation";
import { QueryDiffDataGrid } from "./QueryDiffDataGrid";

export const QueryPage = () => {
  const { sqlQuery, setSqlQuery } = useRecceQueryContext();
  const cacheKey = ["adhoc_query"];
  const router = useRouter();

  const {
    data,
    refetch: runQuery,
    isFetching,
  } = useSubmitRun(
    {
      type: "query_diff",
      params: { sql_template: sqlQuery },
    },
    cacheKey
  );
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);

  const executeQuery = useCallback(() => {
    setPrimaryKeys([]);
    runQuery();
  }, [runQuery]);

  const addToChecklist = useCallback(async () => {
    if (!data?.run_id) {
      return;
    }

    await createCheckByRun(data.run_id);
    router.push("#checks");
  }, [data?.run_id, router]);

  return (
    <Flex direction="column" height="100%">
      <Flex justifyContent="right" padding="5px" gap="5px">
        <Button
          colorScheme="blue"
          onClick={addToChecklist}
          isDisabled={isFetching || !data?.run_id}
          size="sm"
        >
          Add to Checklist
        </Button>
        <Button
          colorScheme="blue"
          onClick={executeQuery}
          isDisabled={isFetching}
          size="sm"
        >
          Run
        </Button>
      </Flex>
      <Box flex="1" border={"1px solid #CBD5E0"} height="200px" width="100%">
        <SqlEditor
          value={sqlQuery}
          onChange={(value) => setSqlQuery(value)}
          onRun={() => executeQuery()}
        />
      </Box>
      <Box backgroundColor="gray.100" height="50vh">
        <QueryDiffDataGrid
          isFetching={isFetching}
          result={data?.result}
          primaryKeys={primaryKeys}
          setPrimaryKeys={setPrimaryKeys}
        />
      </Box>
    </Flex>
  );
};
