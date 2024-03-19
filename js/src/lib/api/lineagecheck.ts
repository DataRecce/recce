import { axiosClient } from "./axiosClient";
import { Check } from "./checks";

export interface LineageDiffViewOptions {
  view_mode?: "changed_models" | "all";
  node_ids?: string[];
  packages?: string[];
}

export async function createLineageDiffCheck(
  viewOptions: LineageDiffViewOptions
): Promise<Check> {
  const response = await axiosClient.post("/api/checks", {
    type: "lineage_diff",
    params: {},
    viewOptions: viewOptions,
  });
  const check = response.data;

  return check;
}
