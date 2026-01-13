"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import MuiSwitch from "@mui/material/Switch";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { PiInfoFill } from "react-icons/pi";
import {
  type QueryParams,
  type SubmitOptions,
  submitQuery,
  submitQueryBase,
  submitQueryDiff,
  waitRun,
} from "../../api";
import { HistoryToggle } from "../../components";
import { SetupConnectionPopover } from "../../components/app";
import { BaseEnvironmentSetupGuide } from "../../components/lineage";
import {
  useLineageGraphContext,
  useRecceActionContext,
  useRecceInstanceContext,
} from "../../contexts";
import {
  defaultSqlQuery,
  useApiConfig,
  useRecceQueryContext,
} from "../../hooks";
import { RECCE_SUPPORT_CALENDAR_URL } from "../../lib/const";
import { QueryForm } from "./QueryForm";
import { SetupConnectionGuide } from "./SetupConnectionGuide";
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
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        fontSize="0.75rem"
      >
        <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
          Custom Queries
        </Typography>
        <MuiTooltip title={customQueriesDescription}>
          <Box component="span" sx={{ display: "flex", color: "grey.600" }}>
            <PiInfoFill fontSize="1rem" />
          </Box>
        </MuiTooltip>
      </Stack>
      <MuiSwitch
        size="small"
        checked={isCustomQueries}
        onChange={handleToggle}
        color="primary"
      />
    </Box>
  );
};

export const QueryPageOss = () => {
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
    sqlQuery = "select * from db.mymodel";
  }

  if (featureToggles.mode === "read only") {
    sqlQuery = `--- Would like to do query here? Book a demo with us at ${RECCE_SUPPORT_CALENDAR_URL}\n${sqlQuery}`;
  }

  const { showRunId } = useRecceActionContext();
  const { apiClient } = useApiConfig();
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
    const { run_id } = await runFn(params, options, apiClient);

    showRunId(run_id);

    return await waitRun(run_id, undefined, apiClient);
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
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "right",
            alignItems: "center",
            padding: "4pt 8pt",
            gap: "5px",
            height: "54px",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <HistoryToggle />
          <Box sx={{ flexGrow: 1 }} />
          {singleEnv ? (
            <MuiTooltip
              title="Please configure the base environment before running the diff"
              placement="left"
            >
              <span>
                <Button
                  variant="contained"
                  disabled
                  size="small"
                  sx={{ fontSize: "14px", mt: "16px" }}
                >
                  Run Diff
                </Button>
              </span>
            </MuiTooltip>
          ) : (
            <SetupConnectionPopover
              display={featureToggles.mode === "metadata only"}
            >
              <Button
                variant="contained"
                disabled
                size="small"
                sx={{ fontSize: "14px", mt: "16px" }}
              >
                Run Diff
              </Button>
            </SetupConnectionPopover>
          )}
        </Box>
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
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "right",
          alignItems: "flex-end",
          padding: "4pt 8pt",
          gap: "5px",
          height: "54px",
          borderBottom: "1px solid",
          borderColor: "divider",
          flex: "0 0 54px",
        }}
      >
        <HistoryToggle />
        <QueryModeToggle />
        <Box sx={{ flexGrow: 1 }} />
        <QueryForm
          defaultPrimaryKeys={primaryKeys}
          onPrimaryKeysChange={setPrimaryKeys}
        />
        <Button
          variant="contained"
          onClick={() => {
            runQuery("query_diff");
          }}
          disabled={isPending || featureToggles.disableDatabaseQuery}
          size="small"
        >
          Run Diff
        </Button>
      </Box>

      <Box sx={{ width: "100%", flex: 1 }}>
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
    </Box>
  );
};
