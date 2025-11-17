import { AxiosError, AxiosResponse } from "axios";
import { axiosClient } from "./axiosClient";

/**
 * The data from the API
 */
export interface NodeColumnData {
  name: string;
  type: string;
  transformation_type?: string;
  change_status?: "added" | "removed" | "modified";
  not_null?: boolean;
  unique?: boolean;
}
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

// https://docs.getdbt.com/reference/artifacts/dbt-artifacts#common-metadata
interface ArtifactMetadata {
  dbt_version: string;
  dbt_schema_version: string;
  generated_at: string;
  adapter_type: string;
  env: Record<string, string>;
  invocation_id: string;
}
export interface ManifestMetadata extends ArtifactMetadata {
  project_id?: string;
  project_name?: string;
  user_id?: string;
}
export interface SQLMeshInfo {
  base_env: string;
  current_env: string;
}

export type CatalogMetadata = ArtifactMetadata;

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

interface LineageOutput {
  error?: string;
  data?: LineageData;
}

export async function getLineage(base = false): Promise<LineageData> {
  const response = await axiosClient.get<LineageData>(
    `/api/lineage?base=${base}`,
  );
  return response.data;
}

export async function getLineageWithError(
  base = false,
): Promise<LineageOutput> {
  try {
    const data = await getLineage(base);
    return { data };
  } catch (err: unknown) {
    if (err instanceof AxiosError) {
      const data = err.response?.data as Record<string, unknown> | undefined;
      const detail = data?.detail as string | undefined;
      if (detail) {
        return { error: detail };
      } else {
        return { error: err.message };
      }
    } else if (err instanceof Error) {
      return { error: err.message };
    } else {
      return { error: "An unknown error occurred" };
    }
  }
}

export interface LineageDiffResult {
  base?: LineageData;
  current?: LineageData;
  base_error?: string;
  current_error?: string;
}

export async function getLineageDiff(): Promise<LineageDiffResult> {
  const [base, current] = await Promise.all([
    getLineageWithError(true),
    getLineageWithError(false),
  ]);

  return {
    base: base.data,
    current: current.data,
    base_error: base.error,
    current_error: current.error,
  };
}

export interface stateMetadata {
  schema_version: string;
  recce_version: string;
  generated_at: string;
}

export interface gitInfo {
  branch?: string;
}

export interface pullRequestInfo {
  id?: string | number;
  title?: string;
  url?: string;
  branch?: string;
  base_branch?: string;
}

export interface ServerInfoResult {
  state_metadata: stateMetadata;
  adapter_type: string;
  review_mode: boolean;
  cloud_mode: boolean;
  file_mode: boolean;
  filename?: string;
  git?: gitInfo;
  pull_request?: pullRequestInfo;
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

export async function getServerInfo(): Promise<ServerInfoResult> {
  return (
    await axiosClient.get<never, AxiosResponse<ServerInfoResult>>(`/api/info`)
  ).data;
}

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

export async function getModelInfo(model: string): Promise<ModelInfoResult> {
  return (
    await axiosClient.get<never, AxiosResponse<ModelInfoResult>>(
      `/api/model/${model}`,
    )
  ).data;
}
