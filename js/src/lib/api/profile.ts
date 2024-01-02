import { submitRun } from "./runs";
import { DataFrame } from "./types";

export interface ProfileParams {
  model: string;
}

export interface ProfileDiffResult {
  base?: DataFrame;
  current?: DataFrame;
  base_error?: string;
  current_error?: string;
}

export async function submitProfile(params: ProfileParams) {
  return await submitRun<ProfileParams, ProfileDiffResult>("profile", params);
}