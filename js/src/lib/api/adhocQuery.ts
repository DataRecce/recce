import {
  submitQuery as _submitQuery,
  submitQueryBase as _submitQueryBase,
  submitQueryDiff as _submitQueryDiff,
} from "@datarecce/ui/api";
import { AxiosInstance } from "axios";
import { axiosClient } from "./axiosClient";
import { SubmitOptions } from "./runs";

// ============================================================================
// Re-export types from @datarecce/ui/api library
// ============================================================================

export type {
  QueryDiffParams,
  QueryDiffResult,
  QueryDiffViewOptions,
  QueryParams,
  QueryPreviewChangeParams,
  QueryResult,
  QueryRunParams,
  QueryViewOptions,
} from "@datarecce/ui/api";

// Import types for wrapper function signatures
import type { QueryDiffParams, QueryRunParams } from "@datarecce/ui/api";

// ============================================================================
// Wrapper functions with default axiosClient
// ============================================================================

export async function submitQuery(
  params: QueryRunParams,
  options?: SubmitOptions,
  client: AxiosInstance = axiosClient,
) {
  return await _submitQuery(params, options, client);
}

export async function submitQueryBase(
  params: QueryRunParams,
  options?: SubmitOptions,
  client: AxiosInstance = axiosClient,
) {
  return await _submitQueryBase(params, options, client);
}

export async function submitQueryDiff(
  params: QueryDiffParams,
  options?: SubmitOptions,
  client: AxiosInstance = axiosClient,
) {
  return await _submitQueryDiff(params, options, client);
}
