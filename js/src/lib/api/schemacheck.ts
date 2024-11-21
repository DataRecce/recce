import { axiosClient } from "./axiosClient";
import { Check } from "./checks";

export interface SchemaDiffViewParams {
  node_id?: string | string[];
  select?: string;
  exclude?: string;
  view_mode?: "all" | "changed_models";
  packages?: string[];
}

export async function createSchemaDiffCheck(
  params: SchemaDiffViewParams
): Promise<Check> {
  const response = await axiosClient.post("/api/checks", {
    type: "schema_diff",
    params: params,
  });
  const check = response.data;

  return check;
}
