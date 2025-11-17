import { AxiosResponse } from "axios";
import { axiosClient } from "./axiosClient";

export interface RecceInstanceInfo {
  server_mode: "server" | "preview" | "read-only";
  single_env: boolean;
  authed: boolean;
  cloud_instance: boolean;
  lifetime_expired_at?: Date;
  share_url?: string;
  session_id?: string;
  organization_name?: string;
  web_url?: string;
}

export async function getRecceInstanceInfo(): Promise<RecceInstanceInfo> {
  return (
    await axiosClient.get<never, AxiosResponse<RecceInstanceInfo>>(
      "/api/instance-info",
    )
  ).data;
}
