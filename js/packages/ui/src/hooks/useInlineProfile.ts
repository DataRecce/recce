import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { DataFrame, ProfileDiffResult, Run } from "../api";
import { submitRun, waitRun } from "../api";
import { useApiConfig } from "./useApiConfig";

export interface ColumnProfileStats {
  not_null_proportion?: number | null;
  min?: string | number | null;
  max?: string | number | null;
  avg?: number | null;
  is_unique?: boolean | null;
  row_count?: number | null;
}

export type ProfileByColumn = Map<
  string,
  { base?: ColumnProfileStats; current?: ColumnProfileStats }
>;

export interface UseInlineProfileArgs {
  modelName: string | undefined;
  columns: string[];
  enabled: boolean;
}

export interface UseInlineProfileResult {
  profileByColumn: ProfileByColumn;
  isLoading: boolean;
  error: unknown;
}

const EMPTY_MAP: ProfileByColumn = new Map();

const STAT_FIELDS = [
  "not_null_proportion",
  "min",
  "max",
  "avg",
  "is_unique",
  "row_count",
] as const;

/**
 * Extracts stats from a profile DataFrame into a Map keyed by lower-cased column name.
 * Handles both lower-case and UPPER-case DataFrame keys (backends like Snowflake).
 */
function dataFrameToStatsMap(
  df: DataFrame | undefined,
): Map<string, ColumnProfileStats> {
  const out = new Map<string, ColumnProfileStats>();
  if (!df?.columns || !df?.data) return out;

  const keyFor = (target: string): string | undefined => {
    const lower = df.columns.find((c) => c.key.toLowerCase() === target);
    return lower?.key;
  };

  const columnNameKey = keyFor("column_name");
  if (!columnNameKey) return out;

  const fieldKeys = new Map<string, string | undefined>();
  for (const field of STAT_FIELDS) {
    fieldKeys.set(field, keyFor(field));
  }

  const colIndex = new Map<string, number>();
  df.columns.forEach((c, i) => colIndex.set(c.key, i));

  for (const row of df.data) {
    const nameIdx = colIndex.get(columnNameKey);
    if (nameIdx === undefined) continue;
    const rawName = row[nameIdx];
    if (typeof rawName !== "string") continue;
    const stats: ColumnProfileStats = {};
    for (const field of STAT_FIELDS) {
      const key = fieldKeys.get(field);
      if (!key) continue;
      const idx = colIndex.get(key);
      if (idx === undefined) continue;
      (stats as Record<string, unknown>)[field] = row[idx];
    }
    out.set(rawName.toLowerCase(), stats);
  }
  return out;
}

/**
 * Submits a profile_diff run for the given model + columns, polls until done,
 * and exposes the result as a per-column Map. Cached by React Query under
 * (modelName, sorted-columns) so reopening the same schema view is instant.
 */
export function useInlineProfile({
  modelName,
  columns,
  enabled,
}: UseInlineProfileArgs): UseInlineProfileResult {
  const { apiClient } = useApiConfig();

  const sortedColumnsKey = useMemo(
    () => [...columns].sort().join(","),
    [columns],
  );

  const queryEnabled = enabled && !!modelName && columns.length > 0;

  const query = useQuery({
    queryKey: ["inline-profile", modelName ?? "", sortedColumnsKey],
    enabled: queryEnabled,
    retry: false,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const submitted = await submitRun(
        "profile_diff",
        { model: modelName, columns },
        { nowait: true },
        apiClient,
      );
      const runId = submitted.run_id;
      // Poll until the run has a result or error. waitRun returns when the
      // run completes or the per-call timeout (2s) elapses; on timeout we
      // loop unless the query has been aborted.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (signal?.aborted) {
          throw new Error("aborted");
        }
        const run = (await waitRun(runId, 2, apiClient)) as Run;
        if (run.error) {
          throw new Error(String(run.error));
        }
        if (run.result) {
          return run.result as ProfileDiffResult;
        }
      }
    },
  });

  const profileByColumn = useMemo<ProfileByColumn>(() => {
    if (!query.data) return EMPTY_MAP;
    const base = dataFrameToStatsMap(query.data.base);
    const current = dataFrameToStatsMap(query.data.current);
    const out: ProfileByColumn = new Map();
    const names = new Set<string>([...base.keys(), ...current.keys()]);
    for (const name of names) {
      out.set(name, {
        base: base.get(name),
        current: current.get(name),
      });
    }
    return out;
  }, [query.data]);

  return {
    profileByColumn,
    isLoading: query.isLoading && queryEnabled,
    error: query.error,
  };
}
