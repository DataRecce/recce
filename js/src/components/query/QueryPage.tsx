import React, { CSSProperties, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Icon,
  Spacer,
  Switch,
  Tooltip,
} from "@chakra-ui/react";
import SqlEditor, { DualSqlEditor } from "./SqlEditor";
import {
  defaultSqlQuery,
  useRecceQueryContext,
} from "@/lib/hooks/RecceQueryContext";

import { QueryOptions, useMutation } from "@tanstack/react-query";
import {
  QueryDiffParams,
  QueryParams,
  submitQuery,
  submitQueryBase,
  submitQueryDiff,
} from "@/lib/api/adhocQuery";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { QueryForm } from "./QueryForm";
import { HSplit } from "../split/Split";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { SubmitOptions, waitRun } from "@/lib/api/runs";
import { VscDiff, VscHistory } from "react-icons/vsc";
import { InfoIcon } from "@chakra-ui/icons";

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

const QueryModeToggle = () => {
  const { isCustomQueries, setCustomQueries, sqlQuery, setBaseSqlQuery } =
    useRecceQueryContext();
  const handleToggle = () => {
    if (isCustomQueries === false) setBaseSqlQuery && setBaseSqlQuery(sqlQuery);
    setCustomQueries(!isCustomQueries);
  };
  const customQueriesDescription =
    "Custom queries allow you to use two SQL queries to compare results between current and base environments.";
  return (
    <Box>
      <Box fontSize="8pt">
        Custom Queries {""}
        <Tooltip label={customQueriesDescription}>
          <InfoIcon color="gray.600" boxSize="3" />
        </Tooltip>
      </Box>
      <Switch size="sm" isChecked={isCustomQueries} onChange={handleToggle} />
    </Box>
  );
};

export const QueryPage = () => {
  const {
    sqlQuery: _sqlQuery,
    baseSqlQuery,
    setSqlQuery,
    setBaseSqlQuery,
    primaryKeys,
    setPrimaryKeys,
    isCustomQueries,
  } = useRecceQueryContext();
  const { envInfo } = useLineageGraphContext();

  let sqlQuery = _sqlQuery;
  if (envInfo?.adapterType === "sqlmesh" && _sqlQuery === defaultSqlQuery) {
    sqlQuery = `select * from db.mymodel`;
  }

  const { showRunId } = useRecceActionContext();
  const queryFn = async (type: "query" | "query_base" | "query_diff") => {
    function queryFactory(type: string) {
      switch (type) {
        case "query":
          return submitQuery;
        case "query_base":
          return submitQueryBase;
        case "query_diff":
          return submitQueryDiff;
        default:
          throw new Error(`Unknown query type: ${type}`);
      }
    }
    const sqlTemplate = type === "query_base" ? baseSqlQuery || "" : sqlQuery;
    const runFn = queryFactory(type);
    const params: QueryParams = { sql_template: sqlTemplate };
    const options: SubmitOptions = { nowait: true };

    if (type === "query_diff") {
      params.primary_keys = primaryKeys;
      if (isCustomQueries) params.base_sql_template = baseSqlQuery;
    }
    const { run_id } = await runFn(params, options);

    showRunId(run_id);

    return await waitRun(run_id);
  };

  const { mutate: runQuery, isPending } = useMutation({
    mutationFn: queryFn,
  });

  return (
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
        <QueryModeToggle />
        <Spacer />
        <QueryForm
          defaultPrimaryKeys={primaryKeys}
          onPrimaryKeysChange={setPrimaryKeys}
        />
        <Button
          colorScheme="blue"
          onClick={() => runQuery("query_diff")}
          isDisabled={isPending}
          size="xs"
          fontSize="14px"
          marginTop={"16px"}
        >
          Run Diff
        </Button>
      </Flex>

      <Box width="100%" flex="1">
        {isCustomQueries ? (
          <DualSqlEditor
            value={sqlQuery}
            baseValue={baseSqlQuery}
            onChange={setSqlQuery}
            onChangeBase={setBaseSqlQuery}
            onRun={() => runQuery("query")}
            onRunBase={() => runQuery("query_base")}
            onRunDiff={() => runQuery("query_diff")}
          />
        ) : (
          <SqlEditor
            value={sqlQuery}
            onChange={setSqlQuery}
            onRun={() => runQuery("query")}
            onRunDiff={() => runQuery("query_diff")}
          />
        )}
      </Box>
    </Flex>
    /* <QueryForm
      p="5px"
      border="1px"
      borderColor="gray.300"
      defaultPrimaryKeys={primaryKeys}
      onPrimaryKeysChange={setPrimaryKeys}
    /> */
  );
};
