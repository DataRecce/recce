import { axiosClient } from "./axiosClient";

export interface SelectInput {
  select?: string;
  exclude?: string;
}

export interface SelectOutput {
  nodes: string[];
}

export async function select(input: SelectInput): Promise<SelectOutput> {
  const response = await axiosClient.post(`/api/select`, input);
  return response.data;
}
