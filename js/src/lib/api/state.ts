import { AxiosError, isAxiosError } from "axios";
import { axiosClient } from "./axiosClient";

export interface ImportedState {
  runs: number;
  checks: number;
}

export async function exportState(): Promise<string> {
  const response = await axiosClient.post("/api/export");
  return response.data;
}

export async function importState(file: File): Promise<ImportedState> {
  const formData = new FormData();
  formData.append("file", file);

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

export async function syncState(
  input: SyncStateInput
): Promise<SyncStateResponse> {
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
