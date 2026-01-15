import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";
import {
  COLUMN_HEIGHT,
  type LineageGraph,
  type LineageGraphColumnNode,
  type LineageGraphEdge,
  type LineageGraphNode,
  type LineageGraphNodes,
  layoutWithDagre,
  type NodeColumnSetMap,
} from "../..";
import type { ColumnLineageData } from "../../api";

/**
 * Convert a LineageGraph to React Flow nodes and edges with column-level lineage support
 *
 * This OSS-specific function extends the basic toReactFlow functionality with:
 * - Column-level lineage (CLL) visualization
 * - Dynamic node heights based on column count
 * - Column nodes as child nodes within parent model nodes
 *
 * @param lineageGraph - The lineage graph to convert
 * @param options - Conversion options
 * @param options.selectedNodes - Optional filter for which nodes to include
 * @param options.cll - Column-level lineage data for adding column nodes
 * @returns Tuple of [nodes, edges, nodeColumnSetMap] where nodeColumnSetMap tracks columns per node
 *
 * @example
 * ```tsx
 * const [nodes, edges, columnSetMap] = toReactFlow(lineageGraph, {
 *   selectedNodes: ["model.project.orders"],
 *   cll: columnLineageData,
 * });
 * ```
 */
export function toReactFlow(
  lineageGraph: LineageGraph,
  options?: {
    selectedNodes?: string[];
    cll?: ColumnLineageData;
  },
): [LineageGraphNodes[], LineageGraphEdge[], NodeColumnSetMap] {
  const nodes: LineageGraphNodes[] = [];
  const edges: LineageGraphEdge[] = [];
  const { selectedNodes, cll } = options ?? {};

  const nodeColumnSetMap: NodeColumnSetMap = {};

  function getWeight(from?: string) {
    if (from === "base") {
      return 0;
    } else if (from === "current") {
      return 2;
    } else {
      return 1;
    }
  }

  function compareFn(
    a: LineageGraphNode | LineageGraphEdge,
    b: LineageGraphNode | LineageGraphEdge,
  ) {
    const weightA = getWeight(a.data?.from);
    const weightB = getWeight(b.data?.from);

    if (weightA < weightB) {
      return -1;
    } else if (weightA > weightB) {
      return 1;
    }
    return 0;
  }

  const filterSet =
    selectedNodes !== undefined ? new Set(selectedNodes) : undefined;
  const sortedNodes = Object.values(lineageGraph.nodes).sort(compareFn);
  for (const node of sortedNodes) {
    if (filterSet && !filterSet.has(node.id)) {
      continue;
    }

    // add column nodes
    const nodeColumnSet = new Set<string>();
    let columnIndex = 0;
    if (cll) {
      const maybeCurrent = cll.current as unknown as
        | ColumnLineageData["current"]
        | undefined;
      const parentMap = maybeCurrent?.parent_map[node.id] ?? new Set<string>();

      for (const parentKey of parentMap) {
        const source = parentKey;
        const target = node.id;

        edges.push({
          id: `m2c_${source}_${target}`,
          source,
          target,
          style: {
            zIndex: 9999,
          },
        });
      }

      for (const columnName of Object.keys(
        node.data.data.current?.columns ?? {},
      )) {
        const columnKey = `${node.id}_${columnName}`;
        const maybeCurrent = cll.current as unknown as
          | ColumnLineageData["current"]
          | undefined;
        const column = maybeCurrent?.columns[columnKey];
        const parentMap =
          maybeCurrent?.parent_map[columnKey] ?? new Set<string>();

        if (column == null) {
          continue;
        }

        nodes.push({
          id: columnKey,
          position: { x: 10, y: 70 + columnIndex * COLUMN_HEIGHT },
          parentId: node.id,
          extent: "parent",
          draggable: false,
          className: "no-track-pii-safe",
          data: {
            node: node.data,
            column: column.name,
            type: column.type,
            transformationType: column.transformation_type,
            changeStatus: column.change_status,
          },
          style: {
            zIndex: 9999,
          },
          type: "lineageGraphColumnNode",
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
        } as LineageGraphColumnNode);

        for (const parentColumn of parentMap) {
          const source = parentColumn;
          const target = columnKey;

          edges.push({
            id: `${source}_${target}`,
            source,
            target,
            style: {
              zIndex: 9999,
            },
          });
        }

        columnIndex++;
        nodeColumnSet.add(column.name);
      }
    }

    nodeColumnSetMap[node.id] = nodeColumnSet;

    let height = 60;
    if (columnIndex > 0) {
      height += 20 + columnIndex * COLUMN_HEIGHT;
    }

    nodes.unshift({
      id: node.id,
      position: { x: 0, y: 0 },
      width: 300,
      height: height,
      className: "no-track-pii-safe",
      data: {
        ...node.data,
      },
      type: "lineageGraphNode",
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      style: {
        width: 300,
        height: height,
      },
    } as LineageGraphNode);
  }

  const sortedEdges = Object.values(lineageGraph.edges).sort(compareFn);
  for (const edge of sortedEdges) {
    if (
      filterSet &&
      (!filterSet.has(edge.source) || !filterSet.has(edge.target))
    ) {
      continue;
    }

    edges.push({
      id: edge.id,
      type: "lineageGraphEdge",
      source: edge.source,
      target: edge.target,
      data: {
        ...edge.data,
      },
    } as LineageGraphEdge);
  }

  layout(nodes, edges);

  return [nodes, edges, nodeColumnSetMap];
}

/**
 * Apply dagre layout to lineage graph nodes and edges
 *
 * This is a thin wrapper around layoutWithDagre from @datarecce/ui
 * that provides the dagre library instance.
 *
 * @param nodes - Array of lineage graph nodes
 * @param edges - Array of lineage graph edges
 * @param direction - Layout direction ("LR" for left-to-right, "TB" for top-to-bottom)
 */
export const layout = (
  nodes: LineageGraphNodes[],
  edges: LineageGraphEdge[],
  direction = "LR",
): void => {
  layoutWithDagre(dagre, nodes, edges, direction);
};
