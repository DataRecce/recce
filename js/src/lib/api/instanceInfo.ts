import { axiosClient } from "./axiosClient";

export interface RecceInstanceInfo {
  read_only: boolean;
}

export async function getRecceInstanceInfo(): Promise<RecceInstanceInfo> {
  const response = await axiosClient.get("/api/instance-info");
  return response.data as RecceInstanceInfo;
}
