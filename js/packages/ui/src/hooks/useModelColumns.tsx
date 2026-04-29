/**
 * @file useModelColumns.tsx
 * @description Hook to fetch and manage column information for a model.
 * Combines data from lineage graph context with API calls for column details.
 */

import { useQuery } from "@tanstack/react-query";
import _ from "lodash";
import { useMemo } from "react";
import { getModelInfo, type NodeColumnData } from "../api";
import { useLineageGraphContext } from "../contexts/lineage";
import type { ApiClient } from "../lib/fetchClient";
import { useApiConfigOptional } from "../providers";

/**
 * Create a union of base and current columns by name.
 * Columns from current take precedence if both exist.
 */
export function unionColumns(
  baseColumns: NodeColumnData[],
  currentColumns: NodeColumnData[],
): NodeColumnData[] {
  const union: NodeColumnData[] = [];
  baseColumns.forEach((column) => {
    if (!union.some((c) => c.name === column.name)) {
      union.push(column);
    }
  });
  currentColumns.forEach((column) => {
    if (!union.some((c) => c.name === column.name)) {
      union.push(column);
    }
  });

  return union;
}

/**
 * Return type for the useModelColumns hook
 */
export interface UseModelColumnsReturn {
  columns: NodeColumnData[];
  primaryKey: string | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch model column information.
 *
 * This hook resolves the lineage node by `model` name and fetches the model
 * detail (columns + primary_key) via TanStack Query. The query key
 * `["modelDetail", node.id]` and `staleTime` are deliberately aligned with
 * the `useQuery` calls in NodeViewOss / NodeSqlViewOss / SandboxViewOss /
 * SchemaDiffView / SchemaSummary so that all consumers share a single cache
 * entry and a single in-flight request per node (DRC-3343).
 *
 * @param model - The model name to fetch columns for
 * @param client - Axios instance for API calls (optional - will use context if not provided)
 * @returns Object with columns, primaryKey, isLoading, and error states
 *
 * @example
 * ```tsx
 * const { columns, primaryKey, isLoading, error } = useModelColumns(modelName);
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return <ColumnList columns={columns} primaryKey={primaryKey} />;
 * ```
 */
export function useModelColumns(
  model: string | undefined,
  client?: ApiClient,
): UseModelColumnsReturn {
  const { lineageGraph } = useLineageGraphContext();
  const apiConfig = useApiConfigOptional();

  // Use provided client or fall back to context client
  const apiClient = client ?? apiConfig?.apiClient;

  const node = _.find(lineageGraph?.nodes, {
    data: {
      name: model,
    },
  });

  const enabled = !!apiClient && !!node?.id;

  // Shares cache + in-flight request with NodeViewOss / NodeSqlViewOss /
  // SandboxViewOss / SchemaDiffView / SchemaSummary, all of which use the
  // same ["modelDetail", node.id] queryKey and staleTime.
  const {
    data,
    isLoading: queryLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["modelDetail", node?.id],
    queryFn: () => {
      // `enabled` guarantees both `node?.id` and `apiClient` are defined
      // before this function runs.
      if (!node?.id || !apiClient) {
        throw new Error("useModelColumns: missing node id or api client");
      }
      return getModelInfo(node.id, apiClient);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const { columns, primaryKey } = useMemo(() => {
    const modelInfo = data?.model;
    if (!modelInfo?.base.columns || !modelInfo.current.columns) {
      return {
        columns: [] as NodeColumnData[],
        primaryKey: modelInfo?.current.primary_key,
      };
    }
    const baseColumns = Object.values(modelInfo.base.columns);
    const currentColumns = Object.values(modelInfo.current.columns);
    return {
      columns: unionColumns(baseColumns, currentColumns),
      primaryKey: modelInfo.current.primary_key,
    };
  }, [data]);

  // When the query is disabled (no model resolved or no api client), match
  // the prior hook contract of returning isLoading=false rather than the
  // TanStack default of true.
  const isLoading = enabled ? queryLoading : false;

  const error = queryError
    ? queryError instanceof Error
      ? queryError
      : new Error(String(queryError))
    : null;

  return { columns, primaryKey, isLoading, error };
}

export default useModelColumns;
