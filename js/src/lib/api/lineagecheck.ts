import { AxiosResponse } from "axios";
import { axiosClient } from "./axiosClient";
import { Check } from "./checks";
import { CllInput } from "./cll";

export interface LineageDiffViewOptions {
  view_mode?: "changed_models" | "all";
  node_ids?: string[];
  packages?: string[];
  select?: string;
  exclude?: string;
  column_level_lineage?: CllInput;
}

interface CreateLineageDiffCheckBody {
  type: string;
  params: Record<string, string | boolean | number>;
  view_options: LineageDiffViewOptions;
}

export async function createLineageDiffCheck(
  viewOptions: LineageDiffViewOptions,
): Promise<Check> {
  const response = await axiosClient.post<
    CreateLineageDiffCheckBody,
    AxiosResponse<Check>
  >("/api/checks", {
    type: "lineage_diff",
    params: {},
    view_options: viewOptions,
  });

  return response.data;
}
