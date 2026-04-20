/**
 * @file useModelColumns.tsx
 * @description Hook to fetch and manage column information for a model.
 * Combines data from lineage graph context with API calls for column details.
 */

import _ from "lodash";
import { useCallback, useEffect, useState } from "react";
import { getModelInfo, type NodeColumnData } from "../api";
import {
  type LineageGraphNode,
  useLineageGraphContext,
} from "../contexts/lineage";
import type { ApiClient } from "../lib/fetchClient";
import { useApiConfigOptional } from "../providers";

/**
 * Stable empty array used when inline column data is unavailable.
 * Must be a module-level constant — a `[]` literal inside a hook body
 * creates a new reference every render, breaking the `prevNodeColumns`
 * identity check and causing an infinite re-render loop.
 */
const EMPTY_COLUMNS: NodeColumnData[] = [];

/**
 * Extract columns from a lineage graph node.
 *
 * After DRC-3260, inline column data is no longer available on the graph node.
 * This function always returns an empty array; the API fetch path in
 * useModelColumns provides the actual column data.
 *
 * @deprecated Kept for backward compatibility. Will be removed once all
 * callers migrate to on-demand API fetch.
 */
export function extractColumns(_node: LineageGraphNode): NodeColumnData[] {
  return EMPTY_COLUMNS;
}

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
 * This hook combines data from the lineage graph context (if available)
 * with API calls to get detailed column information for a model.
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

  // After DRC-3260, inline column data is no longer on the graph node.
  // Always use the API fetch path below.
  // IMPORTANT: uses module-level EMPTY_COLUMNS for referential stability —
  // a `[]` literal here caused infinite re-render (new ref every render).
  const nodeColumns = EMPTY_COLUMNS;

  const [columns, setColumns] = useState<NodeColumnData[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [prevNodeColumns, setPrevNodeColumns] = useState<NodeColumnData[]>([]);
  const [prevNodeId, setPrevNodeId] = useState(node?.id);

  // After DRC-3260, primary_key is no longer inline on the graph node.
  // The API fetch path below provides it.
  const nodePrimaryKey = undefined;

  const fetchData = useCallback(async () => {
    if (!node || !apiClient) {
      return;
    }
    try {
      const data = await getModelInfo(node.id, apiClient);
      const modelInfo = data.model;
      if (!modelInfo.base.columns || !modelInfo.current.columns) {
        setColumns([]);
        setIsLoading(false);
        return;
      }
      setPrimaryKey(modelInfo.current.primary_key);
      const baseColumns = Object.values(modelInfo.base.columns);
      const currentColumns = Object.values(modelInfo.current.columns);
      setColumns(unionColumns(baseColumns, currentColumns));
      setIsLoading(false);
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
    }
  }, [node, apiClient]);

  // Adjust state during render when node changes
  if (nodeColumns !== prevNodeColumns || node?.id !== prevNodeId) {
    setPrevNodeColumns(nodeColumns);
    setPrevNodeId(node?.id);

    if (nodeColumns.length > 0) {
      setColumns(nodeColumns);
      setPrimaryKey(nodePrimaryKey);
      setIsLoading(false);
    } else if (node?.id === undefined) {
      setColumns([]);
      setIsLoading(false);
    }
    // Note: fetchData case is handled separately in effect below
  }

  // Fetch data effect - only runs when we need to fetch
  useEffect(() => {
    if (nodeColumns.length === 0 && node?.id !== undefined) {
      fetchData().catch((e: unknown) => {
        // error is already handled in fetchData()
        console.error(e);
      });
    }
  }, [fetchData, node?.id]);

  return { columns, primaryKey, isLoading, error };
}

export default useModelColumns;
