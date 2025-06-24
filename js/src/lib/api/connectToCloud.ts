import { axiosClient } from "./axiosClient";

export interface ConnectToCloud {
  connection_url: string;
}

export async function connectToCloud(): Promise<ConnectToCloud> {
  const data = await axiosClient.post<ConnectToCloud>("/api/connect");
  return data.data;
}
