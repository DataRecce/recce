import { axiosClient } from "./axiosClient";
import { AxiosResponse } from "axios";

export interface RecceInstanceInfo {
  read_only: boolean;
  single_env: boolean;
  authed: boolean;
  lifetime_expired_at?: Date;
  share_url?: string;
}

export async function getRecceInstanceInfo(): Promise<RecceInstanceInfo> {
  return (await axiosClient.get<never, AxiosResponse<RecceInstanceInfo>>("/api/instance-info"))
    .data;
}
