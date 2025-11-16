import { AxiosResponse } from "axios";
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
  return (
    await axiosClient.post<SelectInput, AxiosResponse<SelectOutput>>(
      `/api/select`,
      input,
    )
  ).data;
}
