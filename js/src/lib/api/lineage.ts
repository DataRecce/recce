import { axiosClient } from "./axiosClient";
import { AxiosError } from "axios";

interface LineageOutput {
  error?: string;
  data?: any;
}

export async function getLineage(base: boolean = false) {
  const response = await axiosClient.get(`/api/lineage?base=${base}`);
  return response.data;
}

export async function getLineageWithError(
  base: boolean = false
): Promise<LineageOutput> {
  try {
    const data = await getLineage(base);
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

export interface LineageDiffResult {
  base?: any;
  current?: any;
  base_error?: string;
  current_error?: string;
}

export async function getLineageDiff(): Promise<LineageDiffResult> {
  const [base, current] = await Promise.all([
    getLineageWithError(true),
    getLineageWithError(false),
  ]);

  return {
    base: base.data,
    current: current.data,
    base_error: base.error,
    current_error: current.error,
  };
}
