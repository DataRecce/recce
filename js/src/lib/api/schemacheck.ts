import { AxiosResponse } from "axios";
import { axiosClient } from "./axiosClient";
import { Check } from "./checks";

export interface SchemaDiffViewParams {
  node_id?: string | string[];
  select?: string;
  exclude?: string;
  view_mode?: "all" | "changed_models";
  packages?: string[];
}

interface CreateSchemaDiffCheckBody {
  type: string;
  params: SchemaDiffViewParams;
}

export async function createSchemaDiffCheck(
  params: SchemaDiffViewParams,
): Promise<Check> {
  const response = await axiosClient.post<
    CreateSchemaDiffCheckBody,
    AxiosResponse<Check>
  >("/api/checks", {
    type: "schema_diff",
    params: params,
  });

  return response.data;
}
