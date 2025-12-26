import { AxiosInstance, AxiosResponse } from "axios";
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
  client: AxiosInstance = axiosClient,
): Promise<Check> {
  const response = await client.post<
    CreateSchemaDiffCheckBody,
    AxiosResponse<Check>
  >("/api/checks", {
    type: "schema_diff",
    params: params,
  });

  return response.data;
}
