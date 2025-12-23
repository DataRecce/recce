import { AxiosInstance, AxiosResponse } from "axios";
import { axiosClient } from "./axiosClient";

export interface RecceServerFlags {
  single_env_onboarding: boolean;
  show_relaunch_hint: boolean;
}

export async function getServerFlag(
  client: AxiosInstance = axiosClient,
): Promise<RecceServerFlags> {
  return (await client.get<never, AxiosResponse<RecceServerFlags>>("/api/flag"))
    .data;
}

// This was used for showing onboarding guide. Check DRC-1320 for more detials
export async function markOnboardingCompleted(
  client: AxiosInstance = axiosClient,
): Promise<void> {
  try {
    await client.post<never, AxiosResponse<never>>("/api/onboarding/completed");
  } catch (_error) {
    // skip any errors
  }
}

export async function markRelaunchHintCompleted(
  client: AxiosInstance = axiosClient,
): Promise<void> {
  try {
    await client.post<never, AxiosResponse<never>>(
      "/api/relaunch-hint/completed",
    );
  } catch (_error) {
    // skip any errors
  }
}
