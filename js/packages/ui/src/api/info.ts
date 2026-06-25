import type { ApiClient, ApiResponse } from "../lib/fetchClient";

/**
 * Column-level data for a node
 */
export interface NodeColumnData {
  name: string;
  type: string;
  transformation_type?: string;
  change_status?: "added" | "removed" | "modified" | "unknown";
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
  change_status?: "added" | "removed" | "modified" | "unknown";
  change?: {
    category: "breaking" | "non_breaking" | "partial_breaking" | "unknown";
    columns?: Record<string, "added" | "removed" | "modified" | "unknown">;
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
 * Session staleness fields returned by the backend when the PR session's
 * frozen-snapshot base may have diverged from the project's current shared base.
 * All fields are null for legacy sessions (pre-DRC-3309) or OSS mode.
 */
export interface SessionStaleness {
  /** ID of the shared-base session that was cloned into this PR session. */
  source_session_id: string | null;
  /** Timestamp of the shared-base session at clone time (ISO 8601). */
  source_session_updated_at: string | null;
  /** ID of the project's current shared-base session. */
  current_base_session_id: string | null;
  /** Timestamp of the project's current shared-base session (ISO 8601). */
  current_base_updated_at: string | null;
}

/**
 * Returns true when the PR session's frozen snapshot is outdated relative to
 * the project's current shared base.
 *
 * Conditions:
 * - source_session_id must be non-null (i.e. session was auto-snapshotted)
 * - Either the source session ID or its timestamp differs from the current base
 */
export function isSessionBaseOutdated(s: SessionStaleness): boolean {
  return (
    s.source_session_id !== null &&
    (s.source_session_id !== s.current_base_session_id ||
      s.source_session_updated_at !== s.current_base_updated_at)
  );
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
  /** Session staleness fields (cloud mode only, null for OSS / legacy sessions). */
  session_staleness?: SessionStaleness;
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
    // optional: added nodes have no base, removed nodes have no current
    base?: ModelEnvDetail;
    current?: ModelEnvDetail;
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

/**
 * Refresh the PR session's frozen-snapshot base from the project's current
 * shared base. Backend resolves the session via the `/api/v2/sessions/<id>`
 * mount prefix (cloud mode); takes no body.
 *
 * On success, the backend emits a `metadata_updated` WS event which the
 * frontend uses to invalidate the lineage cache.
 */
export async function refreshSessionBase(client: ApiClient): Promise<void> {
  await client.post<never, ApiResponse<void>>("/api/refresh-base");
}
