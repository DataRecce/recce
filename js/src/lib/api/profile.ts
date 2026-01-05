import { submitProfileDiff as _submitProfileDiff } from "@datarecce/ui/api";
import { AxiosInstance } from "axios";
import { axiosClient } from "./axiosClient";
import { SubmitOptions } from "./runs";

// ============================================================================
// Re-export types from @datarecce/ui/api library
// ============================================================================

export type {
  HistogramDiffParams,
  HistogramDiffResult,
  HistogramResult,
  ProfileDiffParams,
  ProfileDiffResult,
  ProfileDiffViewOptions,
  TopKDiffParams,
  TopKDiffResult,
  TopKResult,
  TopKViewOptions,
} from "@datarecce/ui/api";

// Import types for wrapper function signatures
import type { ProfileDiffParams } from "@datarecce/ui/api";

// ============================================================================
// Wrapper functions with default axiosClient
// ============================================================================

export async function submitProfileDiff(
  params: ProfileDiffParams,
  options?: SubmitOptions,
  client: AxiosInstance = axiosClient,
) {
  return await _submitProfileDiff(params, options, client);
}
