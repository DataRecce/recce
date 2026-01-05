import { submitRowCountDiff as _submitRowCountDiff } from "@datarecce/ui/api";
import { AxiosInstance } from "axios";
import { axiosClient } from "./axiosClient";
import { SubmitOptions } from "./runs";

// ============================================================================
// Re-export types from @datarecce/ui/api library
// ============================================================================

export type {
  RowCount,
  RowCountDiff,
  RowCountDiffParams,
  RowCountDiffResult,
  RowCountParams,
  RowCountResult,
} from "@datarecce/ui/api";

// Import types for wrapper function signatures
import type { RowCountDiffParams } from "@datarecce/ui/api";

// ============================================================================
// Wrapper functions with default axiosClient
// ============================================================================

export async function submitRowCountDiff(
  params: RowCountDiffParams,
  options?: SubmitOptions,
  client: AxiosInstance = axiosClient,
) {
  return await _submitRowCountDiff(params, options, client);
}
