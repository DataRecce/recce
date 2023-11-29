import { useQuery } from "@tanstack/react-query";
import { axiosClient } from "./axiosClient";

interface RunQueryInput {
  sql_template: string;
  base?: boolean;
}

export async function runQuery(params: RunQueryInput) {
  const response = await axiosClient.post("/api/query", params);
  return response.data;
}

export function useRunQuery(params: RunQueryInput) {
  return useQuery({
    queryKey: ["query", params.base],
    queryFn: () => runQuery(params),
    retry: false,
    enabled: false, // never auto run
  });
}
