import React, { CSSProperties, useState } from "react";
import { Box, Button, Flex, Icon, Spacer } from "@chakra-ui/react";
import SqlEditor from "./SqlEditor";
import {
  defaultSqlQuery,
  useRecceQueryContext,
} from "@/lib/hooks/RecceQueryContext";

import { useMutation } from "@tanstack/react-query";
import { submitQuery, submitQueryDiff } from "@/lib/api/adhocQuery";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { QueryForm } from "./QueryForm";
import { HSplit } from "../split/Split";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { waitRun } from "@/lib/api/runs";
import { VscHistory } from "react-icons/vsc";

const HistoryToggle = () => {
  const { isHistoryOpen, showHistory, closeHistory } = useRecceActionContext();
  return (
    <Box>
      <Box fontSize="8pt">History</Box>

      <Button
        leftIcon={<Icon as={VscHistory} />}
        size="xs"
        variant="outline"
        onClick={isHistoryOpen ? closeHistory : showHistory}
      >
        {isHistoryOpen ? "Hide" : "Show"}
      </Button>
    </Box>
  );
};

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

  const { showRunId } = useRecceActionContext();
  const queryFn = async (type: "query" | "query_diff") => {
    const { run_id } =
      type === "query"
        ? await submitQuery({ sql_template: sqlQuery }, { nowait: true })
        : await submitQueryDiff(
            { sql_template: sqlQuery, primary_keys: primaryKeys },
            { nowait: true }
          );

    showRunId(run_id);

    return await waitRun(run_id);
  };

  const { mutate: runQuery, isPending } = useMutation({
    mutationFn: queryFn,
  });

  return (
    <HSplit
      sizes={[90, 10]}
      minSize={200}
      style={{ flex: "1", height: "100%" }}
    >
      <Flex direction="column" height="100%">
        <Flex
          justifyContent="right"
          alignItems="center"
          padding="4pt 8pt"
          gap="5px"
          height="54px"
          borderBottom="1px solid lightgray"
          flex="0 0 54px"
        >
          <HistoryToggle />
          <Spacer />
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
            onClick={() => {
              runQuery("query");
            }}
            isDisabled={isPending}
            size="sm"
          >
            Run
          </Button>
        </Flex>

        <Box width="100%" flex="1">
          <SqlEditor
            value={sqlQuery}
            onChange={setSqlQuery}
            onRun={() => runQuery("query")}
            onRunDiff={() => runQuery("query_diff")}
          />
        </Box>
      </Flex>
      <QueryForm
        p="5px"
        border="1px"
        borderColor="gray.300"
        defaultPrimaryKeys={primaryKeys}
        onPrimaryKeysChange={setPrimaryKeys}
      />
    </HSplit>
  );
};
