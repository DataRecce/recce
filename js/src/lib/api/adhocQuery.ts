import { useQuery } from "@tanstack/react-query";
import { axiosClient } from "./axiosClient";
import { AxiosError } from "axios";

interface QueryParams {
  sql_template: string;
  base?: boolean;
}

interface QueryOutput {
  error?: string;
  data?: any;
}

export async function runQuery(params: QueryParams) {
  const response = await axiosClient.post("/api/query", params);
  return response.data;
}

export async function runQueryWithError(
  params: QueryParams
): Promise<QueryOutput> {
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

export interface QueryDiffParams {
  sql_template: string;
}

export interface QueryDiffResult {
  base?: any;
  current?: any;
  base_error?: string;
  current_error?: string;
}

export async function runQueryDiff(
  params: QueryDiffParams
): Promise<QueryDiffResult> {
  const sql_template = params.sql_template;

  const [base, current] = await Promise.all([
    runQueryWithError({ sql_template, base: true }),
    runQueryWithError({ sql_template, base: false }),
  ]);

  return {
    base: base.data,
    current: current.data,
    base_error: base.error,
    current_error: current.error,
  };
}
