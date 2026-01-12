import type { AxiosInstance, AxiosResponse } from "axios";

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
 * Lineage diff data
 */
export type LineageDiffData = Record<
  string,
  {
    change_status: "added" | "removed" | "modified";
    change: {
      category: "breaking" | "non_breaking" | "partial_breaking" | "unknown";
      columns: Record<string, "added" | "removed" | "modified"> | null;
    } | null;
  }
>;

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
  lineage: {
    base: LineageData;
    current: LineageData;
    diff: LineageDiffData;
  };
  demo: boolean;
  codespace: boolean;
  support_tasks: Record<string, boolean>;
}

/**
 * Fetch server info from API
 */
export async function getServerInfo(
  client: AxiosInstance,
): Promise<ServerInfoResult> {
  const response = await client.get<never, AxiosResponse<ServerInfoResult>>(
    "/api/info",
  );
  return response.data;
}

/**
 * Model info result from /api/model/:model endpoint
 */
export interface ModelInfoResult {
  model: {
    base: {
      columns?: Record<string, NodeColumnData>;
      primary_key?: string;
    };
    current: {
      columns?: Record<string, NodeColumnData>;
      primary_key?: string;
    };
  };
}

/**
 * Fetch model info (columns and primary key) from API
 */
export async function getModelInfo(
  model: string,
  client: AxiosInstance,
): Promise<ModelInfoResult> {
  const response = await client.get<never, AxiosResponse<ModelInfoResult>>(
    `/api/model/${model}`,
  );
  return response.data;
}
