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
