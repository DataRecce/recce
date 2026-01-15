/**
 * Schema Check API - Types and Client Functions
 *
 * Provides functionality for creating schema diff checks.
 */

import type { AxiosInstance, AxiosResponse } from "axios";
import type { Check } from "./checks";

// ============================================================================
// Types
// ============================================================================

export interface SchemaDiffViewParams {
  node_id?: string | string[];
  select?: string;
  exclude?: string;
  view_mode?: "all" | "changed_models";
  packages?: string[];
}

interface CreateSchemaDiffCheckBody {
  type: string;
  params: SchemaDiffViewParams;
}

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Create a schema diff check.
 *
 * @param params - Schema diff parameters
 * @param client - Axios instance for API configuration
 * @returns Promise resolving to the created check
 */
export async function createSchemaDiffCheck(
  params: SchemaDiffViewParams,
  client: AxiosInstance,
): Promise<Check> {
  const response = await client.post<
    CreateSchemaDiffCheckBody,
    AxiosResponse<Check>
  >("/api/checks", {
    type: "schema_diff",
    params: params,
  });

  return response.data;
}
