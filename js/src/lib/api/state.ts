import { AxiosResponse, isAxiosError } from "axios";
import { axiosClient } from "./axiosClient";

export interface SaveAsInput {
  filename: string;
  overwrite?: boolean;
}

export interface ImportedState {
  runs: number;
  checks: number;
}

export async function saveAs(input: SaveAsInput): Promise<void> {
  return (
    await axiosClient.post<SaveAsInput, AxiosResponse<void>>(
      "/api/save-as",
      input,
    )
  ).data;
}

export async function rename(input: SaveAsInput): Promise<void> {
  return (
    await axiosClient.post<SaveAsInput, AxiosResponse<void>>(
      "/api/rename",
      input,
    )
  ).data;
}

export async function exportState(): Promise<string> {
  return (await axiosClient.post<never, AxiosResponse<string>>("/api/export"))
    .data;
}

interface ImportStateBody {
  file: File;
  checks_only: "true" | "false";
}

export async function importState(
  file: File,
  checksOnly?: boolean,
): Promise<ImportedState> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("checks_only", (!!checksOnly).toString());

  return (
    await axiosClient.post<ImportStateBody, AxiosResponse<ImportedState>>(
      "/api/import",
      formData,
    )
  ).data;
}

export async function isStateSyncing(): Promise<boolean> {
  const response = await axiosClient.get<never, AxiosResponse<boolean>>(
    "/api/sync",
  );
  return response.status === 208;
}

export interface SyncStateInput {
  method?: "overwrite" | "revert" | "merge";
}
export interface SyncStateResponse {
  status: "accepted" | "conflict" | "syncing";
}

export async function syncState(
  input: SyncStateInput,
): Promise<SyncStateResponse> {
  try {
    const response = await axiosClient.post<
      SyncStateInput,
      AxiosResponse<SyncStateResponse>
    >("/api/sync", input);

    if (response.status === 202) {
      return {
        status: "accepted",
      };
    }
    if (response.status === 208) {
      return {
        status: "syncing",
      };
    }
  } catch (error) {
    if (isAxiosError(error)) {
      if (error.response?.status === 409) {
        // 409 conflict case
        return { status: "conflict" };
      }
    }
  }
  throw new Error("Failed to sync state");
}

export interface ShareStateResponse {
  status: string;
  message: string;
  share_url?: string;
}

export async function shareState(): Promise<ShareStateResponse> {
  return (
    await axiosClient.post<never, AxiosResponse<ShareStateResponse>>(
      "/api/share",
    )
  ).data;
}
