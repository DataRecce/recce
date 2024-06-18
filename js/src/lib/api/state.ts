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

export async function syncState(): Promise<void> {
  const response = await axiosClient.post("/api/sync");
  if (response.status !== 202) {
    throw new Error("Failed to sync state");
  }
}
