import { AxiosInstance } from "axios";
import { axiosClient } from "./axiosClient";

export interface ConnectToCloud {
  connection_url: string;
}

export async function connectToCloud(
  client: AxiosInstance = axiosClient,
): Promise<ConnectToCloud> {
  const data = await client.post<ConnectToCloud>("/api/connect");
  return data.data;
}
