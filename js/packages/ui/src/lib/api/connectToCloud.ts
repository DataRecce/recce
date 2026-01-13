import axios, { type AxiosInstance } from "axios";
import { PUBLIC_API_URL } from "../const";

export interface ConnectToCloud {
  connection_url: string;
}

const defaultApiClient = axios.create({
  baseURL: PUBLIC_API_URL,
});

export async function connectToCloud(
  client: AxiosInstance = defaultApiClient,
): Promise<ConnectToCloud> {
  const data = await client.post<ConnectToCloud>("/api/connect");
  return data.data;
}
