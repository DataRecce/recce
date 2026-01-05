import {
  submitValueDiff as _submitValueDiff,
  submitValueDiffDetail as _submitValueDiffDetail,
} from "@datarecce/ui/api";
import { AxiosInstance } from "axios";
import { axiosClient } from "./axiosClient";
import { SubmitOptions } from "./runs";

// ============================================================================
// Re-export types from @datarecce/ui/api library
// ============================================================================

export type {
  ValueDiffDetailParams,
  ValueDiffDetailResult,
  ValueDiffDetailViewOptions,
  ValueDiffParams,
  ValueDiffResult,
} from "@datarecce/ui/api";

// Import types for wrapper function signatures
import type { ValueDiffParams } from "@datarecce/ui/api";

// ============================================================================
// Wrapper functions with default axiosClient
// ============================================================================

export async function submitValueDiff(
  params: ValueDiffParams,
  options?: SubmitOptions,
  client: AxiosInstance = axiosClient,
) {
  return await _submitValueDiff(params, options, client);
}

export async function submitValueDiffDetail(
  params: ValueDiffParams,
  options?: SubmitOptions,
  client: AxiosInstance = axiosClient,
) {
  return await _submitValueDiffDetail(params, options, client);
}
