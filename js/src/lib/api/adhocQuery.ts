import { useQuery } from "@tanstack/react-query";
import { axiosClient } from "./axiosClient";
import { AxiosError } from "axios";

interface RunQueryInput {
  sql_template: string;
  base?: boolean;
}

interface RunQueryWithErrorOutput {
  error?: string;
  data?: any;
}

interface RunQueryDiffOutput {
  run_id?: string;
  result: {
    base?: any;
    current?: any;
    base_error?: string;
    current_error?: string;
  };
}

export async function runQuery(params: RunQueryInput) {
  const response = await axiosClient.post("/api/query", params);
  return response.data;
}

export async function runQueryWithError(
  params: RunQueryInput
): Promise<RunQueryWithErrorOutput> {
  try {
    const data = await runQuery(params);
    return { data };
  } catch (err: any) {
    if (err instanceof AxiosError) {
      const detail = err?.response?.data?.detail;
      if (detail) {
        return { error: detail };
      } else {
        return { error: err?.message };
      }
    } else {
      return { error: err?.message };
    }
  }
}

export async function runQueryDiff(
  sql_template: string
): Promise<RunQueryDiffOutput> {
  const [base, current] = await Promise.all([
    runQueryWithError({ sql_template, base: true }),
    runQueryWithError({ sql_template, base: false }),
  ]);

  const run_id = Math.random()
    .toString(36)
    .substring(2, 16 + 2);

  return {
    run_id,
    result: {
      base: base.data,
      current: current.data,
      base_error: base.error,
      current_error: current.error,
    },
  };
}

export function useRunQueryDiff(sql_template: string, queryKey: any[]) {
  return useQuery({
    queryKey,
    queryFn: () => runQueryDiff(sql_template),
    retry: false,
    enabled: false, // never auto run
  });
}
