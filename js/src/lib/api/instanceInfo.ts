import { axiosClient } from "./axiosClient";
import { AxiosResponse } from "axios";

export interface RecceInstanceInfo {
  read_only: boolean;
  authed: boolean;
}

export async function getRecceInstanceInfo(): Promise<RecceInstanceInfo> {
  return (await axiosClient.get<never, AxiosResponse<RecceInstanceInfo>>("/api/instance-info"))
    .data;
}
