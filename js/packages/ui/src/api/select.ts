"use client";

import type { AxiosInstance, AxiosResponse } from "axios";

export interface SelectInput {
  select?: string;
  exclude?: string;
  packages?: string[];
  view_mode?: "all" | "changed_models";
}

export interface SelectOutput {
  nodes: string[];
}

export async function select(
  input: SelectInput,
  client: AxiosInstance,
): Promise<SelectOutput> {
  return (
    await client.post<SelectInput, AxiosResponse<SelectOutput>>(
      `/api/select`,
      input,
    )
  ).data;
}
