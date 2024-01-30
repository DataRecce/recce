import { useQueryClient } from "@tanstack/react-query";
import { RowCountDiffResult, submitRowCountDiff } from "./adhocQuery";
import { axiosClient } from "./axiosClient";
import { waitRun } from "./runs";
import { cacheKeys } from "./cacheKeys";
import { useState } from "react";
import { useRowCountStateContext } from "../hooks/RecceQueryContext";

export interface RowCount {
  name?: string;
  base: number | null;
  curr: number | null;
}

export interface QueryRowCountResult {
  runId: string;
  result: RowCountDiffResult;
}

export async function fetchModelRowCount(modelName: string) : Promise<RowCount> {
  const response = await axiosClient.get(`/api/models/${modelName}/row_count`);
  return response.data;
}


export async function queryModelRowCount(modelName: string) : Promise<RowCount> {
  const { result } = await queryRowCount([modelName]);
  return result[modelName];
}

export async function queryRowCount(modelNames: string[]) : Promise<QueryRowCountResult> {
  if (modelNames.length === 0) {
    throw new Error("No model names provided");
  }

  const { run_id } = await submitRowCountDiff({ node_names: modelNames }, { nowait: true });
  const run = await waitRun(run_id);

  return {
    runId: run_id,
    result: run.result,
  };
}


export function useRowCountQueries(modelNames: string[]) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { setIsNodesFetching } = useRowCountStateContext();
  const cachedRowCounts = queryClient.getQueriesData<RowCount[]>({
    queryKey: cacheKeys.allRowCount()
  }).filter((cachedData) => {
    const [queryKey, data] = cachedData;
    const [key, modelName] = queryKey;
    return modelNames.includes(modelName as string);
  }).map((cachedData) => {
    const [queryKey, data] = cachedData;
    const [key, modelName] = queryKey;
    return { modelName, data };
  });

  const fetchCandidates : string[] = [];
  modelNames.forEach((modelName) => {
    const { data } = cachedRowCounts.find((cachedData) => cachedData.modelName === modelName) || { data: undefined, modelName: modelName };
    if (data === undefined) {
      fetchCandidates.push(modelName);
    }
  });

  async function fetchModelsRowCount(options: { skipCache?: boolean } = {}) {
    const fetchNodes = (options && options.skipCache) ? modelNames : fetchCandidates;
    setIsLoading(true);
    setIsNodesFetching(fetchNodes);

    const { runId, result: queryResponses } = await queryRowCount(fetchNodes);
    Object.keys(queryResponses).forEach((name) => {
      const modelName = name as string;
      const queryResponse = queryResponses[modelName];
      queryClient.setQueryData<RowCount>(cacheKeys.rowCount(modelName), {
        base: queryResponse.base,
        curr: queryResponse.curr,
      });
    });
    setIsLoading(false);
    setIsNodesFetching([]);
    return runId;
  }

  return {
    isLoading,
    fetchFn: fetchModelsRowCount,
  };
}
