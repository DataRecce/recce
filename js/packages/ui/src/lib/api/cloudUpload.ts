import type { ApiClient, ApiResponse } from "../fetchClient";

export interface CloudOrganization {
  id: string;
  name: string;
  display_name?: string;
  slug?: string;
}

export interface CloudProject {
  id: string;
  name: string;
  display_name?: string;
  slug?: string;
}

export interface CloudProjectBaseStatus {
  base_needs_upload: boolean;
}

export interface CloudUploadInput {
  org_id: string;
  project_id: string;
  session_name: string;
}

export interface CloudUploadOutput {
  status: string;
  session_id?: string;
  session_url?: string;
  message?: string;
}

export async function listCloudOrganizations(
  client: ApiClient,
): Promise<CloudOrganization[]> {
  const response = await client.get<
    never,
    ApiResponse<{ organizations: CloudOrganization[] }>
  >("/api/cloud/organizations");
  return response.data.organizations;
}

export async function listCloudProjects(
  client: ApiClient,
  orgId: string,
): Promise<CloudProject[]> {
  const response = await client.get<
    never,
    ApiResponse<{ projects: CloudProject[] }>
  >(`/api/cloud/organizations/${orgId}/projects`);
  return response.data.projects;
}

export async function getCloudProjectBaseStatus(
  client: ApiClient,
  orgId: string,
  projectId: string,
): Promise<CloudProjectBaseStatus> {
  const response = await client.get<never, ApiResponse<CloudProjectBaseStatus>>(
    `/api/cloud/organizations/${orgId}/projects/${projectId}/base-status`,
  );
  return response.data;
}

export async function uploadToCloud(
  client: ApiClient,
  input: CloudUploadInput,
): Promise<CloudUploadOutput> {
  const response = await client.post<
    CloudUploadInput,
    ApiResponse<CloudUploadOutput>
  >("/api/cloud/upload", input);
  return response.data;
}

// --- Connection Info ---

export interface ConnectionInfo {
  type: string;
  [key: string]: unknown;
}

export async function getConnectionInfo(
  client: ApiClient,
): Promise<ConnectionInfo | null> {
  const response = await client.get<
    never,
    ApiResponse<{ connection_info: ConnectionInfo | null }>
  >("/api/connection-info");
  return response.data.connection_info;
}

// --- Warehouse Setup ---

export interface WarehouseSetupInput {
  org_id: string;
  project_id: string;
  connection_name: string;
  config: Record<string, unknown>;
}

export interface WarehouseSetupOutput {
  status: string;
  warehouse_connection_id?: string;
  message?: string;
}

export async function setupWarehouse(
  client: ApiClient,
  input: WarehouseSetupInput,
): Promise<WarehouseSetupOutput> {
  const response = await client.post<
    WarehouseSetupInput,
    ApiResponse<WarehouseSetupOutput>
  >("/api/cloud/warehouse-setup", input);
  return response.data;
}
