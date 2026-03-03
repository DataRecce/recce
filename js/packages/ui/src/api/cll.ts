/**
 * Column-Level Lineage (CLL) API - Types and Client Functions
 *
 * Provides column-level lineage analysis functionality for data models.
 */

import type { AxiosInstance, AxiosResponse } from "axios";
import type { NodeColumnData } from "./info";

// ============================================================================
// Input Types
// ============================================================================

export interface CllInput {
  node_id?: string;
  column?: string;
  change_analysis?: boolean;
  no_cll?: boolean;
  no_upstream?: boolean;
  no_downstream?: boolean;
}

export interface ImpactRadiusParams {
  node_id: string;
}

// ============================================================================
// Result Types
// ============================================================================

export interface CllNodeData {
  id: string;
  name: string;
  source_name: string;
  resource_type: string;
  raw_code?: string;
  change_status?: "added" | "removed" | "modified";
  change_category?:
    | "breaking"
    | "non_breaking"
    | "partial_breaking"
    | "unknown";
  impacted?: boolean;
  columns?: Record<string, NodeColumnData>;
}

export interface ColumnLineageData {
  current: {
    nodes: Record<string, CllNodeData>;
    columns: Record<string, NodeColumnData>;
    /** JSON arrays from API - iterable like Set but properly typed */
    parent_map: Record<string, string[]>;
    /** JSON arrays from API - iterable like Set but properly typed */
    child_map: Record<string, string[]>;
  };
}

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Get column-level lineage data.
 *
 * @param input - CLL input parameters
 * @param client - Axios instance for API configuration
 * @returns Promise resolving to column lineage data
 */
export async function getCll(
  input: CllInput,
  client: AxiosInstance,
): Promise<ColumnLineageData> {
  const response = await client.post<
    CllInput,
    AxiosResponse<ColumnLineageData>
  >("/api/cll", input);

  return response.data;
}
