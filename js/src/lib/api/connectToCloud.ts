import { axiosClient } from "./axiosClient";
import { AxiosResponse } from "axios";

export interface ConnectToCloud {
  connection_url: string;
}

export async function connectToCloud(): Promise<ConnectToCloud> {
  const data = await axiosClient.post<never, AxiosResponse<ConnectToCloud>>("/api/connect");
  return data.data;
}
