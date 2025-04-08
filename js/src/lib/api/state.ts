import { AxiosError, isAxiosError } from "axios";
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
  const response = await axiosClient.post("/api/save-as", input);
  return response.data;
}

export async function rename(input: SaveAsInput): Promise<void> {
  const response = await axiosClient.post("/api/rename", input);
  return response.data;
}

export async function exportState(): Promise<string> {
  const response = await axiosClient.post("/api/export");
  return response.data;
}

export async function importState(file: File, checksOnly?: boolean): Promise<ImportedState> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("checks_only", (!!checksOnly).toString());

  const response = await axiosClient.post("/api/import", formData);
  return response.data;
}

export async function isStateSyncing(): Promise<boolean> {
  const response = await axiosClient.get("/api/sync");
  return response.status === 208;
}

export interface SyncStateInput {
  method?: "overwrite" | "revert" | "merge";
}
export interface SyncStateResponse {
  status: "accepted" | "conflict" | "syncing";
}

export async function syncState(input: SyncStateInput): Promise<SyncStateResponse> {
  try {
    const response = await axiosClient.post("/api/sync", input);

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
      if (error.response && error.response.status === 409) {
        // 409 conflict case
        return { status: "conflict" };
      }
    }
  }
  throw new Error("Failed to sync state");
}

export interface ShareStateResponse {
  share_url?: string;
  error?: string;
}

export async function shareState(): Promise<ShareStateResponse> {
  try {
    const response = await axiosClient.post("/api/share");
    return response.data as ShareStateResponse;
  } catch (error) {
    if (isAxiosError(error)) {
      if (error.response && error.response.status === 400) {
        const errorMessage = String(
          (error as AxiosError<{ detail: string } | undefined, unknown>).response?.data?.detail,
        );
        return { error: errorMessage };
      }
    }
  }
  throw new Error("Failed to share state");
}
