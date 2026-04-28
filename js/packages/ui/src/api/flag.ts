import type { ApiClient, ApiResponse } from "../lib/fetchClient";

/**
 * Server-side feature flags
 */
export interface RecceServerFlags {
  single_env_onboarding: boolean;
  show_relaunch_hint: boolean;
  disable_cll_cache: boolean;
  impact_at_startup: boolean;
  new_cll_experience: boolean;
  /**
   * Highlight downstream models of a *breaking* change (red) distinctly from
   * downstream of non-breaking changes (amber). Implies new_cll_experience.
   */
  downstream_of_breaking: boolean;
}

/**
 * Fetch server flags from API
 */
export async function getServerFlag(
  client: ApiClient,
): Promise<RecceServerFlags> {
  const response = await client.get<never, ApiResponse<RecceServerFlags>>(
    "/api/flag",
  );
  return response.data;
}

/**
 * Mark relaunch hint as completed
 */
export async function markRelaunchHintCompleted(
  client: ApiClient,
): Promise<void> {
  try {
    await client.post<never, ApiResponse<never>>(
      "/api/relaunch-hint/completed",
    );
  } catch {
    // Skip any errors
  }
}
