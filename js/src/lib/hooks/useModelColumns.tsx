import { useState, useEffect, useMemo } from "react";
import { NodeColumnData, NodeData, getModelInfo } from "../api/info";
import { useLineageGraphContext } from "./LineageGraphContext";
import _ from "lodash";
import { LineageGraphNode } from "@/components/lineage/lineage";

export function extractColumns(node: LineageGraphNode) {
  function getColumns(nodeData: NodeData) {
    return nodeData && nodeData.columns ? Object.values(nodeData.columns) : [];
  }

  const baseColumns = getColumns(node.data.base!!);
  const currentColumns = getColumns(node.data.current!!);

  return unionColumns(baseColumns, currentColumns);
}

export function unionColumns(
  baseColumns: NodeColumnData[],
  currentColumns: NodeColumnData[]
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
  const [columns, setColumns] = useState<NodeColumnData[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const node = _.find(lineageGraph?.nodes, {
    name: model,
  });

  const nodeColumns = useMemo(() => {
    return node ? extractColumns(node) : [];
  }, [node]);

  const nodePrimaryKey = node ? node.data.current?.primary_key : undefined;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getModelInfo(node?.id!);
        const modelInfo = data.model;
        if (
          !modelInfo ||
          !modelInfo.base.columns ||
          !modelInfo.current.columns
        ) {
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
    };

    if (nodeColumns.length > 0) {
      setColumns(nodeColumns);
      setPrimaryKey(nodePrimaryKey);
      setIsLoading(false);
    } else if (node?.id === undefined) {
      setColumns([]);
      setIsLoading(false);
    } else {
      fetchData();
      setIsLoading(false);
    }
  }, [node?.id, nodeColumns, nodePrimaryKey]);

  return { columns, primaryKey, isLoading, error };
};

export default useModelColumns;
