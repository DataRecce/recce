import { useQueries, useQueryClient } from "@tanstack/react-query";
import { RowCountDiffResult, submitQueryDiff, submitRowCountDiff } from "./adhocQuery";
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

export async function fetchModelRowCount(modelName: string) : Promise<RowCount> {
  const response = await axiosClient.get(`/api/models/${modelName}/row_count`);
  return response.data;
}


export async function queryModelRowCount(modelName: string) : Promise<RowCount> {
  const result = await queryModelsRowCount([modelName]);
  return result[modelName];
}

export async function queryModelsRowCount(modelNames: string[]) : Promise<RowCountDiffResult> {
  if (modelNames.length === 0) {
    return {};
  }

  const { run_id } = await submitRowCountDiff({ node_names: modelNames }, { nowait: true });
  const run = await waitRun(run_id);

  return run.result;
}


export function useModelsRowCount(modelNames: string[]) {
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

  async function fetchModelsRowCount() {
    setIsLoading(true);
    setIsNodesFetching(fetchCandidates);

    const queryResponses = await queryModelsRowCount(fetchCandidates);
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
  }

  return {
    isLoading,
    fetchFn: fetchModelsRowCount,
  };
}
