"use client";

import type { AxiosInstance, AxiosResponse } from "axios";

/**
 * Server mode for the Recce instance.
 * - "server": Full read-write mode
 * - "preview": Metadata only mode (no database queries)
 * - "read-only": Read-only mode (no modifications allowed)
 */
export type ServerMode = "server" | "preview" | "read-only";

/**
 * Information about the Recce instance returned from the server.
 */
export interface RecceInstanceInfo {
  server_mode: ServerMode;
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

/**
 * Fetches instance information from the Recce server.
 *
 * @param client - Axios instance to use for the request
 * @returns Promise resolving to RecceInstanceInfo
 */
export async function getRecceInstanceInfo(
  client: AxiosInstance,
): Promise<RecceInstanceInfo> {
  return (
    await client.get<never, AxiosResponse<RecceInstanceInfo>>(
      "/api/instance-info",
    )
  ).data;
}
