import dagre from "@dagrejs/dagre";
import {
  COLUMN_HEIGHT,
  isLineageGraphNode,
  type LineageGraph,
  type LineageGraphColumnNode,
  type LineageGraphEdge,
  type LineageGraphNode,
  type LineageGraphNodes,
  type NodeColumnSetMap,
} from "@datarecce/ui";
import type { ColumnLineageData } from "@datarecce/ui/api";
import { Position } from "@xyflow/react";

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

export const layout = (
  nodes: LineageGraphNodes[],
  edges: LineageGraphEdge[],
  direction = "LR",
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: direction, ranksep: 50, nodesep: 30 });

  nodes.forEach((node) => {
    if (!isLineageGraphNode(node)) {
      return;
    }
    let width = 300;
    let height = 60;
    if (node.style?.height && node.style.width) {
      width = parseInt(String(node.style.width), 10);
      height = parseInt(String(node.style.height), 10);
    }
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    if (!isLineageGraphNode(node)) {
      return;
    }

    const nodeWidth = node.style?.width ?? 300;
    const nodeHeight = node.style?.height ?? 60;

    const nodeWithPosition = dagreGraph.node(node.id);

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - Number(nodeWidth) / 2,
      y: nodeWithPosition.y - Number(nodeHeight) / 2,
    };

    return node;
  });
};
