"use client";

import type { ApiClient, ApiResponse } from "../lib/fetchClient";

export interface SelectInput {
  select?: string;
  exclude?: string;
  packages?: string[];
  view_mode?: "all" | "changed_models" | "body_changes";
}

export interface SelectOutput {
  nodes: string[];
}

export async function select(
  input: SelectInput,
  client: ApiClient,
): Promise<SelectOutput> {
  return (
    await client.post<SelectInput, ApiResponse<SelectOutput>>(
      `/api/select`,
      input,
    )
  ).data;
}
