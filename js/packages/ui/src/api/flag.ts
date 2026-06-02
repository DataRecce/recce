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
  /** Whole-model impact highlighting. Implies new_cll_experience. */
  whole_model_impact: boolean;
  /**
   * Inline paired-distribution profiles in the schema view (DRC-3390 Stage B).
   * When false (the default), Stage C's hook short-circuits and no
   * ``profile_distribution`` runs are submitted from the UI.
   */
  inline_profile: boolean;
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
