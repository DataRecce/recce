import type { ApiClient, ApiResponse } from "../lib/fetchClient";

/**
 * Column-level data for a node
 */
export interface NodeColumnData {
  name: string;
  type: string;
  transformation_type?: string;
  change_status?: "added" | "removed" | "modified";
  not_null?: boolean;
  unique?: boolean;
}

/**
 * Node data within lineage
 */
export interface NodeData {
  id: string;
  unique_id: string;
  name: string;
  schema?: string;
  checksum?: {
    name: string;
    checksum: string;
  };
  raw_code?: string;
  resource_type?: string;
  package_name?: string;
  columns?: Record<string, NodeColumnData | undefined>;
  primary_key?: string;
  config?: {
    materialized?: string;
  };
}

/**
 * dbt artifact metadata
 * @see https://docs.getdbt.com/reference/artifacts/dbt-artifacts#common-metadata
 */
interface ArtifactMetadata {
  dbt_version: string;
  dbt_schema_version: string;
  generated_at: string;
  adapter_type: string;
  env: Record<string, string>;
  invocation_id: string;
}

/**
 * Manifest metadata extends artifact metadata
 */
export interface ManifestMetadata extends ArtifactMetadata {
  project_id?: string;
  project_name?: string;
  user_id?: string;
}

/**
 * SQLMesh environment info
 */
export interface SQLMeshInfo {
  base_env: string;
  current_env: string;
}

export type CatalogMetadata = ArtifactMetadata;

/**
 * Merged node from server-side lineage merge (DRC-3258).
 * Contains unified metadata from base+current with baked-in diff.
 */
export interface MergedNodeData {
  name: string;
  resource_type: string;
  package_name: string;
  schema?: string;
  materialized?: string;
  tags?: string[];
  source_name?: string;
  change_status?: "added" | "removed" | "modified";
  change?: {
    category: "breaking" | "non_breaking" | "partial_breaking" | "unknown";
    columns?: Record<string, "added" | "removed" | "modified">;
  };
}

/**
 * Merged edge from server-side lineage merge (DRC-3258).
 */
export interface MergedEdgeData {
  source: string;
  target: string;
  change_status?: "added" | "removed";
}

/**
 * Per-environment metadata in merged lineage response.
 */
export interface MergedLineageEnvMetadata {
  manifest_metadata?: ManifestMetadata;
  catalog_metadata?: CatalogMetadata;
}

/**
 * Server-side merged lineage response from /api/info.
 * Replaces the old {base, current, diff} triple.
 */
export interface MergedLineageResponse {
  nodes: Record<string, MergedNodeData>;
  edges: MergedEdgeData[];
  metadata: {
    base: MergedLineageEnvMetadata;
    current: MergedLineageEnvMetadata;
  };
}

/**
 * Lineage data structure
 */
export interface LineageData {
  metadata: {
    pr_url: string;
    git_branch?: string;
  };
  nodes: Record<string, NodeData>;
  parent_map: Record<string, string[]>;
  manifest_metadata?: ManifestMetadata | null;
  catalog_metadata?: CatalogMetadata | null;
}

export interface LineageDataFromMetadata extends Omit<LineageData, "nodes"> {
  nodes: Record<string, NodeData | undefined>;
}

/**
 * Lineage diff result from lineage_diff run type
 */
export interface LineageDiffResult {
  base?: LineageData;
  current?: LineageData;
  base_error?: string;
  current_error?: string;
}

/**
 * State metadata for recce state file
 */
export interface StateMetadata {
  schema_version: string;
  recce_version: string;
  generated_at: string;
}

/**
 * Git information
 */
export interface GitInfo {
  branch?: string;
}

/**
 * Pull request information
 */
export interface PullRequestInfo {
  id?: string | number;
  title?: string;
  url?: string;
  branch?: string;
  base_branch?: string;
}

/**
 * Server info result from /api/info endpoint
 */
export interface ServerInfoResult {
  state_metadata: StateMetadata;
  adapter_type: string;
  review_mode: boolean;
  cloud_mode: boolean;
  file_mode: boolean;
  filename?: string;
  git?: GitInfo;
  pull_request?: PullRequestInfo;
  sqlmesh?: SQLMeshInfo;
  lineage: MergedLineageResponse;
  demo: boolean;
  codespace: boolean;
  support_tasks: Record<string, boolean>;
}

/**
 * Fetch server info from API
 */
export async function getServerInfo(
  client: ApiClient,
): Promise<ServerInfoResult> {
  const response = await client.get<never, ApiResponse<ServerInfoResult>>(
    "/api/info",
  );
  return response.data;
}

/**
 * Per-environment model detail returned by /api/models/:model
 *
 * `raw_code` is served on-demand here so it can be stripped from the bulk
 * /api/info lineage payload (DRC-3263).
 */
export interface ModelEnvDetail {
  columns?: Record<string, NodeColumnData>;
  primary_key?: string;
  raw_code?: string;
}

/**
 * Model info result from /api/models/:model endpoint
 */
export interface ModelInfoResult {
  model: {
    base: ModelEnvDetail;
    current: ModelEnvDetail;
  };
}

/**
 * Fetch model info (columns and primary key) from API
 */
export async function getModelInfo(
  model: string,
  client: ApiClient,
): Promise<ModelInfoResult> {
  const response = await client.get<never, ApiResponse<ModelInfoResult>>(
    `/api/models/${model}`,
  );
  return response.data;
}
