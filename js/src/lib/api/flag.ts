import { axiosClient } from "./axiosClient";
import { AxiosResponse } from "axios";

export interface RecceServerFlags {
  single_env_onboarding: boolean;
  show_relaunch_hint: boolean;
}

export async function getServerFlag(): Promise<RecceServerFlags> {
  return (await axiosClient.get<never, AxiosResponse<RecceServerFlags>>("/api/flag")).data;
}

// This was used for showing onboarding guide. Check DRC-1320 for more detials
export async function markOnboardingCompleted(): Promise<void> {
  try {
    await axiosClient.post<never, AxiosResponse<never>>("/api/onboarding/completed");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // skip any errors
  }
}

export async function markRelaunchHintCompleted(): Promise<void> {
  try {
    await axiosClient.post<never, AxiosResponse<never>>("/api/relaunch-hint/completed");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // skip any errors
  }
}
