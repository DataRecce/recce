import _ from "lodash";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LineageGraphNode } from "@/components/lineage/lineage";
import { getModelInfo, NodeColumnData, NodeData } from "../api/info";
import { useLineageGraphContext } from "./LineageGraphContext";

export function extractColumns(node: LineageGraphNode) {
  function getColumns(nodeData: NodeData | undefined) {
    return nodeData?.columns
      ? Object.values(nodeData.columns).filter((c) => c != null)
      : [];
  }

  const baseColumns = getColumns(node.data.data.base);
  const currentColumns = getColumns(node.data.data.current);

  return unionColumns(baseColumns, currentColumns);
}

export function unionColumns(
  baseColumns: NodeColumnData[],
  currentColumns: NodeColumnData[],
) {
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

const useModelColumns = (model: string | undefined) => {
  const { lineageGraph } = useLineageGraphContext();

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
    if (!node) {
      return;
    }
    try {
      const data = await getModelInfo(node.id);
      const modelInfo = data.model;
      if (!modelInfo.base.columns || !modelInfo.current.columns) {
        setColumns([]);
        return;
      }
      setPrimaryKey(modelInfo.current.primary_key);
      const baseColumns = Object.values(modelInfo.base.columns);
      const currentColumns = Object.values(modelInfo.current.columns);
      setColumns(unionColumns(baseColumns, currentColumns));
    } catch (error) {
      setError(error as Error);
    }
  }, [node]);

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
      // fetchData() is a legitimate side effect, leaving
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchData().catch((e: unknown) => {
        // error is already handled in fetchData()
        console.error(e);
      });
      setIsLoading(false);
    }
  }, [fetchData, node?.id, nodeColumns]);

  return { columns, primaryKey, isLoading, error };
};

export default useModelColumns;
