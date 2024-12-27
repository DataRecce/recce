import { axiosClient } from "./axiosClient";

export interface RecceServerFlags {
  show_onboarding_guide: boolean;
  onboarding_mode: boolean;
}

export async function getServerFlag(): Promise<RecceServerFlags> {
  const response = await axiosClient.get("/api/flag");
  return response.data;
}

export async function markOnboardingCompleted(): Promise<void> {
  try {
    await axiosClient.post("/api/onboarding/completed");
  } catch (error) {
    // skip any errors
  }
}
