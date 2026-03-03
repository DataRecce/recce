import type { AxiosInstance, AxiosResponse } from "axios";

/**
 * Server-side feature flags
 */
export interface RecceServerFlags {
  single_env_onboarding: boolean;
  show_relaunch_hint: boolean;
}

/**
 * Fetch server flags from API
 */
export async function getServerFlag(
  client: AxiosInstance,
): Promise<RecceServerFlags> {
  const response = await client.get<never, AxiosResponse<RecceServerFlags>>(
    "/api/flag",
  );
  return response.data;
}

/**
 * Mark relaunch hint as completed
 */
export async function markRelaunchHintCompleted(
  client: AxiosInstance,
): Promise<void> {
  try {
    await client.post<never, AxiosResponse<never>>(
      "/api/relaunch-hint/completed",
    );
  } catch {
    // Skip any errors
  }
}
