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
  base_needs_upload?: boolean;
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
  base_uploaded?: boolean;
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
