import { axiosClient } from "./axiosClient";
import { AxiosResponse } from "axios";

export interface RecceInstanceInfo {
  server_mode: "server" | "preview" | "read-only";
  single_env: boolean;
  authed: boolean;
  lifetime_expired_at?: Date;
  share_url?: string;
  snapshot_id?: string;
}

export async function getRecceInstanceInfo(): Promise<RecceInstanceInfo> {
  return (await axiosClient.get<never, AxiosResponse<RecceInstanceInfo>>("/api/instance-info"))
    .data;
}
