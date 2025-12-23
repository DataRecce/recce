import { AxiosInstance, AxiosResponse } from "axios";
import { axiosClient } from "./axiosClient";

export interface RecceInstanceInfo {
  server_mode: "server" | "preview" | "read-only";
  single_env: boolean;
  authed: boolean;
  cloud_instance: boolean;
  lifetime_expired_at?: Date;
  idle_timeout?: number;
  share_url?: string;
  session_id?: string;
  organization_name?: string;
  web_url?: string;
}

export async function getRecceInstanceInfo(
  client: AxiosInstance = axiosClient,
): Promise<RecceInstanceInfo> {
  return (
    await client.get<never, AxiosResponse<RecceInstanceInfo>>(
      "/api/instance-info",
    )
  ).data;
}
