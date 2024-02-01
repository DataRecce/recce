import { SubmitOptions, submitRun } from "./runs";
import { DataFrame } from "./types";

export interface ProfileDiffParams {
  model: string;
}

export interface ProfileDiffResult {
  base?: DataFrame;
  current?: DataFrame;
}

export interface ProfileDiffViewOptions {
  pinned_columns?: string[];
}

export async function submitProfileDiff(
  params: ProfileDiffParams,
  options?: SubmitOptions
) {
  return await submitRun<ProfileDiffParams, ProfileDiffResult>(
    "profile_diff",
    params,
    options
  );
}
