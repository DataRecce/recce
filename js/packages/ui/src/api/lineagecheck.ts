/**
 * Lineage Check API - Types and Client Functions
 *
 * Provides functionality for creating lineage diff checks.
 */

import type { AxiosInstance, AxiosResponse } from "axios";
import type { Check } from "./checks";
import type { CllInput } from "./cll";

// ============================================================================
// Types
// ============================================================================

export interface LineageDiffViewOptions {
  view_mode?: "changed_models" | "all";
  node_ids?: string[];
  packages?: string[];
  select?: string;
  exclude?: string;
  column_level_lineage?: CllInput;
}

interface CreateLineageDiffCheckBody {
  type: string;
  params: Record<string, string | boolean | number>;
  view_options: LineageDiffViewOptions;
}

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Create a lineage diff check.
 *
 * @param viewOptions - View options for the lineage diff
 * @param client - Axios instance for API configuration
 * @returns Promise resolving to the created check
 */
export async function createLineageDiffCheck(
  viewOptions: LineageDiffViewOptions,
  client: AxiosInstance,
): Promise<Check> {
  const response = await client.post<
    CreateLineageDiffCheckBody,
    AxiosResponse<Check>
  >("/api/checks", {
    type: "lineage_diff",
    params: {},
    view_options: viewOptions,
  });

  return response.data;
}
