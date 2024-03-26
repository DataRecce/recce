import { axiosClient } from "./axiosClient";

export interface LoadedState {
  runs: number;
  checks: number;
}

export async function exportState(): Promise<string> {
  const response = await axiosClient.post("/api/checks/export");
  return response.data;
}

export async function loadState(file: File): Promise<LoadedState> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axiosClient.post("/api/checks/load", formData);
  return response.data;
}
