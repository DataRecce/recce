import { Box, Button, Flex, Spacer, Switch } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { PiInfoFill } from "react-icons/pi";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import HistoryToggle from "@/components/shared/HistoryToggle";
import { Tooltip } from "@/components/ui/tooltip";
import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";
import {
  QueryParams,
  submitQuery,
  submitQueryBase,
  submitQueryDiff,
} from "@/lib/api/adhocQuery";
import { SubmitOptions, waitRun } from "@/lib/api/runs";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import {
  defaultSqlQuery,
  useRecceQueryContext,
} from "@/lib/hooks/RecceQueryContext";
import { BaseEnvironmentSetupGuide } from "../lineage/SingleEnvironmentQueryView";
import { QueryForm } from "./QueryForm";
import SetupConnectionGuide from "./SetupConnectionGuide";
import SqlEditor, { DualSqlEditor } from "./SqlEditor";

const QueryModeToggle = () => {
  const { isCustomQueries, setCustomQueries, sqlQuery, setBaseSqlQuery } =
    useRecceQueryContext();
  const handleToggle = () => {
    if (!isCustomQueries && setBaseSqlQuery) setBaseSqlQuery(sqlQuery);
    setCustomQueries(!isCustomQueries);
  };
  const customQueriesDescription =
    "Custom queries allow you to use two SQL queries to compare results between current and base environments.";
  return (
    <Box>
      <Flex fontSize="0.75rem" gap={1} alignItems="center">
        Custom Queries{" "}
        <Tooltip content={customQueriesDescription}>
          <PiInfoFill color="gray.600" fontSize="1rem" />
        </Tooltip>
      </Flex>
      <Switch.Root
        size="sm"
        colorPalette="iochmara"
        checked={isCustomQueries}
        onCheckedChange={handleToggle}
      >
        <Switch.HiddenInput />
        <Switch.Control />
        <Switch.Label />
      </Switch.Root>
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
  const { lineageGraph, envInfo } = useLineageGraphContext();
  const { featureToggles, singleEnv } = useRecceInstanceContext();

  let sqlQuery = _sqlQuery;
  if (envInfo?.adapterType === "sqlmesh" && _sqlQuery === defaultSqlQuery) {
    sqlQuery = `select * from db.mymodel`;
  }

  if (featureToggles.mode === "read only") {
    sqlQuery = `--- Would like to do query here? Book a demo with us at ${RECCE_SUPPORT_CALENDAR_URL}\n${sqlQuery}`;
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
    const sqlTemplate = type === "query_base" ? (baseSqlQuery ?? "") : sqlQuery;
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

  const currentSchema = useMemo(() => {
    const initialValue = "N/A";
    // find the most common schema from the current lineage graph
    const countMap: Record<string, number> = {};
    if (!lineageGraph) {
      return initialValue;
    }

    for (const key in lineageGraph.nodes) {
      const schema = lineageGraph.nodes[key].data.data.current?.schema;
      if (schema) {
        countMap[schema] = (countMap[schema] || 0) + 1;
      }
    }
    // Find the most common value
    return Object.keys(countMap).reduce((mostCommon, current) => {
      if (countMap[current] > (countMap[mostCommon] || 0)) {
        return current;
      }
      return mostCommon;
    }, initialValue);
  }, [lineageGraph]);

  if (singleEnv || featureToggles.mode === "metadata only") {
    return (
      <Flex direction="column" height="100%">
        <Flex
          justifyContent="right"
          alignItems="center"
          padding="4pt 8pt"
          gap="5px"
          height="54px"
          borderBottom="1px solid lightgray"
        >
          <HistoryToggle />
          <Spacer />
          {singleEnv ? (
            <Tooltip
              content="Please configure the base environment before running the diff"
              positioning={{ placement: "left" }}
            >
              <Button
                colorPalette="iochmara"
                disabled
                size="xs"
                fontSize="14px"
                marginTop={"16px"}
              >
                Run Diff
              </Button>
            </Tooltip>
          ) : (
            <SetupConnectionPopover
              display={featureToggles.mode === "metadata only"}
            >
              <Button
                colorPalette="iochmara"
                disabled
                size="xs"
                fontSize="14px"
                marginTop={"16px"}
              >
                Run Diff
              </Button>
            </SetupConnectionPopover>
          )}
        </Flex>
        <DualSqlEditor
          value={sqlQuery}
          onChange={setSqlQuery}
          onRun={() => {
            runQuery("query");
          }}
          labels={["base (production)", `current (${currentSchema})`]}
          SetupGuide={
            featureToggles.mode === "metadata only" ? (
              <SetupConnectionGuide />
            ) : (
              <BaseEnvironmentSetupGuide />
            )
          }
        />
      </Flex>
    );
  }

  return (
    <Flex direction="column" height="100%">
      <Flex
        justifyContent="right"
        alignItems="flex-end"
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
          colorPalette="iochmara"
          onClick={() => {
            runQuery("query_diff");
          }}
          disabled={isPending || featureToggles.disableDatabaseQuery}
          size="2xs"
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
            onRun={() => {
              runQuery("query");
            }}
            onRunBase={() => {
              runQuery("query_base");
            }}
            onRunDiff={() => {
              runQuery("query_diff");
            }}
          />
        ) : (
          <SqlEditor
            value={sqlQuery}
            onChange={setSqlQuery}
            onRun={() => {
              runQuery("query");
            }}
            onRunDiff={() => {
              runQuery("query_diff");
            }}
          />
        )}
      </Box>
    </Flex>
  );
};
