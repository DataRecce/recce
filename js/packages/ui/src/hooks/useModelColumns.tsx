/**
 * @file useModelColumns.tsx
 * @description Hook to fetch and manage column information for a model.
 * Combines data from lineage graph context with API calls for column details.
 */

import type { AxiosInstance } from "axios";
import _ from "lodash";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getModelInfo, type NodeColumnData } from "../api";
import {
  type LineageGraphNode,
  useLineageGraphContext,
} from "../contexts/lineage";
import { useApiConfigOptional } from "../providers";

/**
 * Extract columns from a lineage graph node.
 * Combines base and current columns using union logic.
 */
export function extractColumns(node: LineageGraphNode): NodeColumnData[] {
  function getColumns(
    nodeData:
      | { columns?: Record<string, NodeColumnData | undefined> }
      | undefined,
  ): NodeColumnData[] {
    return nodeData?.columns
      ? Object.values(nodeData.columns).filter(
          (c): c is NodeColumnData => c != null,
        )
      : [];
  }

  const baseColumns = getColumns(node.data.data.base);
  const currentColumns = getColumns(node.data.data.current);

  return unionColumns(baseColumns, currentColumns);
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
  client?: AxiosInstance,
): UseModelColumnsReturn {
  const { lineageGraph } = useLineageGraphContext();
  const apiConfig = useApiConfigOptional();

  // Use provided client or fall back to context client
  const axiosClient = client ?? apiConfig?.apiClient;

  const node = _.find(lineageGraph?.nodes, {
    data: {
      name: model,
    },
  });

  const nodeColumns = useMemo(() => {
    return node ? extractColumns(node) : [];
  }, [node]);

  const [columns, setColumns] = useState<NodeColumnData[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [prevNodeColumns, setPrevNodeColumns] = useState<NodeColumnData[]>([]);
  const [prevNodeId, setPrevNodeId] = useState(node?.id);

  const nodePrimaryKey = node ? node.data.data.current?.primary_key : undefined;

  const fetchData = useCallback(async () => {
    if (!node || !axiosClient) {
      return;
    }
    try {
      const data = await getModelInfo(node.id, axiosClient);
      const modelInfo = data.model;
      if (!modelInfo.base.columns || !modelInfo.current.columns) {
        setColumns([]);
        return;
      }
      setPrimaryKey(modelInfo.current.primary_key);
      const baseColumns = Object.values(modelInfo.base.columns);
      const currentColumns = Object.values(modelInfo.current.columns);
      setColumns(unionColumns(baseColumns, currentColumns));
    } catch (err) {
      setError(err as Error);
    }
  }, [node, axiosClient]);

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
      setIsLoading(false);
    }
  }, [fetchData, node?.id, nodeColumns]);

  return { columns, primaryKey, isLoading, error };
}

export default useModelColumns;
