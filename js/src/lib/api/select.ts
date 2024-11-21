import { axiosClient } from "./axiosClient";

export interface SelectInput {
  select?: string;
  exclude?: string;
  packages?: string[];
  view_mode?: "all" | "changed_models";
}

export interface SelectOutput {
  nodes: string[];
}

export async function select(input: SelectInput): Promise<SelectOutput> {
  const response = await axiosClient.post(`/api/select`, input);
  return response.data;
}
