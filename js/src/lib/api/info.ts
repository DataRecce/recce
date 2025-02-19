import { axiosClient } from "./axiosClient";
import { AxiosError } from "axios";

/**
 * The data from the API
 */
export interface NodeColumnData {
  name: string;
  type: string;
  transformation_type?: string;
  depends_on?: {
    node: string;
    column: string;
  }[];
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
  columns?: { [key: string]: NodeColumnData };
  primary_key?: string;
}

// https://docs.getdbt.com/reference/artifacts/dbt-artifacts#common-metadata
interface ArtifactMetadata {
  dbt_version: string;
  dbt_schema_version: string;
  generated_at: string;
  adapter_type: string;
  env: Record<string, any>;
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

export interface CatalogMetadata extends ArtifactMetadata {}

export interface LineageData {
  metadata: {
    pr_url: string;
    git_branch?: string;
  };
  nodes: {
    [key: string]: NodeData;
  };
  parent_map: {
    [key: string]: string[];
  };
  manifest_metadata?: ManifestMetadata | null;
  catalog_metadata?: CatalogMetadata | null;
}
export interface LineageDiffData {
  [key: string]: {
    change_status: "added" | "removed" | "modified";
    change_category: "breaking" | "non-breaking";
  };
}

interface LineageOutput {
  error?: string;
  data?: LineageData;
}

export async function getLineage(base: boolean = false): Promise<LineageData> {
  const response = await axiosClient.get(`/api/lineage?base=${base}`);
  return response.data;
}

export async function getLineageWithError(
  base: boolean = false
): Promise<LineageOutput> {
  try {
    const data = await getLineage(base);
    return { data };
  } catch (err: any) {
    if (err instanceof AxiosError) {
      const detail = err?.response?.data?.detail;
      if (detail) {
        return { error: detail };
      } else {
        return { error: err?.message };
      }
    } else {
      return { error: err?.message };
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
  support_tasks: { [key: string]: boolean };
}

export async function getServerInfo(): Promise<ServerInfoResult> {
  const response = await axiosClient.get(`/api/info`);
  return response.data;
}

export interface ModelInfoResult {
  model: {
    base: {
      columns?: { [key: string]: NodeColumnData };
      primary_key?: string;
    };
    current: {
      columns?: { [key: string]: NodeColumnData };
      primary_key?: string;
    };
  };
}

export async function getModelInfo(model: string): Promise<ModelInfoResult> {
  const response = await axiosClient.get(`/api/model/${model}`);
  return response.data;
}
