import dagre from "@dagrejs/dagre";
import { Edge, Node, Position } from "@xyflow/react";
import { ColumnLineageData } from "@/lib/api/cll";
import {
  CatalogMetadata,
  LineageData,
  LineageDataFromMetadata,
  LineageDiffData,
  ManifestMetadata,
  NodeData,
} from "@/lib/api/info";
import { getNeighborSet } from "./graph";

export const COLUMN_HEIGHT = 20;
/**
 * The types for internal data structures.
 */

type LineageFrom = "both" | "base" | "current";

export type LineageGraphNode = Node<
  {
    id: string;
    name: string;
    from: LineageFrom;
    data: {
      base?: NodeData;
      current?: NodeData;
    };
    changeStatus?: "added" | "removed" | "modified";
    change?: {
      category: "breaking" | "non_breaking" | "partial_breaking" | "unknown";
      columns: Record<string, "added" | "removed" | "modified"> | null;
    };
    resourceType?: string;
    packageName?: string;
    parents: Record<string, LineageGraphEdge>;
    children: Record<string, LineageGraphEdge>;
  },
  "lineageGraphNode"
>;

export type LineageGraphColumnNode = Node<
  {
    node: LineageGraphNode["data"];
    column: string;
    type: string;
    transformationType?: string;
    changeStatus?: "added" | "removed" | "modified";
  },
  "lineageGraphColumnNode"
>;

export type LineageGraphEdge = Edge<
  {
    from: LineageFrom;
    changeStatus?: "added" | "removed";
  },
  "lineageGraphEdge"
>;

export type LineageGraphNodes = LineageGraphNode | LineageGraphColumnNode;

export interface LineageGraph {
  nodes: Record<string, LineageGraphNode>;

  edges: Record<string, LineageGraphEdge>;
  modifiedSet: string[];

  manifestMetadata: {
    base?: ManifestMetadata;
    current?: ManifestMetadata;
  };
  catalogMetadata: {
    base?: CatalogMetadata;
    current?: CatalogMetadata;
  };
}

export function isLineageGraphNode(
  node: LineageGraphNodes,
): node is LineageGraphNode {
  return node.type === "lineageGraphNode";
}

export function isLineageGraphColumnNode(
  node: LineageGraphNodes,
): node is LineageGraphColumnNode {
  return node.type === "lineageGraphColumnNode";
}

export type NodeColumnSetMap = Record<string, Set<string>>;

export function buildLineageGraph(
  base: LineageDataFromMetadata,
  current: LineageDataFromMetadata,
  diff?: LineageDiffData,
): LineageGraph {
  const nodes: Record<string, LineageGraphNode> = {};
  const edges: Record<string, LineageGraphEdge> = {};
  const buildNode = (
    key: string,
    from: "base" | "current",
  ): LineageGraphNode => {
    return {
      id: key,
      data: {
        id: key,
        name: key,
        from,
        data: {
          base: undefined,
          current: undefined,
        },
        parents: {},
        children: {},
      },
      type: "lineageGraphNode",
      // Return as LineageGraphNode for now
    } as LineageGraphNode;
  };

  for (const [key, nodeData] of Object.entries(base.nodes)) {
    nodes[key] = buildNode(key, "base");
    if (nodeData) {
      nodes[key].data.data.base = nodeData;
      nodes[key].data.name = nodeData.name;
      nodes[key].data.resourceType = nodeData.resource_type;
      nodes[key].data.packageName = nodeData.package_name;
    }
  }

  for (const [key, nodeData] of Object.entries(current.nodes)) {
    if (nodes[key] as LineageGraphNode | undefined) {
      nodes[key].data.from = "both";
    } else {
      nodes[key] = buildNode(key, "current");
    }
    if (nodeData) {
      nodes[key].data.data.current = current.nodes[key];
      nodes[key].data.name = nodeData.name;
      nodes[key].data.resourceType = nodeData.resource_type;
      nodes[key].data.packageName = nodeData.package_name;
    }
  }

  for (const [child, parents] of Object.entries(base.parent_map)) {
    for (const parent of parents) {
      const childNode = nodes[child] as LineageGraphNode | undefined;
      const parentNode = nodes[parent] as LineageGraphNode | undefined;
      const id = `${parent}_${child}`;

      if (!childNode || !parentNode) {
        // Skip the edge if the node is not found
        continue;
      }
      edges[id] = {
        id,
        source: parentNode.id,
        target: childNode.id,
        data: {
          from: "base",
        },
      };
      const edge = edges[id];

      childNode.data.parents[parent] = edge;
      parentNode.data.children[child] = edge;
    }
  }

  for (const [child, parents] of Object.entries(current.parent_map)) {
    for (const parent of parents) {
      const childNode = nodes[child] as LineageGraphNode | undefined;
      const parentNode = nodes[parent] as LineageGraphNode | undefined;
      const id = `${parent}_${child}`;

      if (!childNode || !parentNode) {
        // Skip the edge if the node is not found
        continue;
      }
      const existingEdge = edges[id] as LineageGraphEdge | undefined;
      if (existingEdge?.data && edges[id].data) {
        edges[id].data.from = "both";
      } else {
        edges[id] = {
          id,
          source: parentNode.id,
          target: childNode.id,
          data: {
            from: "current",
          },
        };
      }
      const edge = edges[id];

      childNode.data.parents[parent] = edge;
      parentNode.data.children[child] = edge;
    }
  }

  const modifiedSet: string[] = [];

  for (const [key, node] of Object.entries(nodes)) {
    const diffNode = diff?.[key];
    if (diffNode) {
      node.data.changeStatus = diffNode.change_status;
      if (diffNode.change) {
        node.data.change = {
          category: diffNode.change.category,
          columns: diffNode.change.columns,
        };
      }
      modifiedSet.push(key);
    } else if (node.data.from === "base") {
      node.data.changeStatus = "removed";
      modifiedSet.push(node.id);
    } else if (node.data.from === "current") {
      node.data.changeStatus = "added";
      modifiedSet.push(node.id);
    } else {
      const checksum1 = node.data.data.base?.checksum?.checksum;
      const checksum2 = node.data.data.current?.checksum?.checksum;

      if (checksum1 && checksum2 && checksum1 !== checksum2) {
        node.data.changeStatus = "modified";
        modifiedSet.push(node.id);
      }
    }
  }

  for (const [, edge] of Object.entries(edges)) {
    if (edge.data) {
      if (edge.data.from === "base") {
        edge.data.changeStatus = "removed";
      } else if (edge.data.from === "current") {
        edge.data.changeStatus = "added";
      }
    }
  }

  return {
    nodes,
    edges,
    modifiedSet,
    manifestMetadata: {
      base: base.manifest_metadata ?? undefined,
      current: current.manifest_metadata ?? undefined,
    },
    catalogMetadata: {
      base: base.catalog_metadata ?? undefined,
      current: current.catalog_metadata ?? undefined,
    },
  };
}

export function selectUpstream(
  lineageGraph: LineageGraph,
  nodeIds: string[],
  degree = 1000,
) {
  return getNeighborSet(
    nodeIds,
    (key) => {
      const maybeNodes = lineageGraph.nodes as unknown as Record<
        string,
        LineageGraphNode | undefined
      >;
      if (maybeNodes[key] === undefined) {
        return [];
      }
      return Object.keys(lineageGraph.nodes[key].data.parents);
    },
    degree,
  );
}

export function selectDownstream(
  lineageGraph: LineageGraph,
  nodeIds: string[],
  degree = 1000,
) {
  return getNeighborSet(
    nodeIds,
    (key) => {
      if (
        (lineageGraph.nodes[key] as LineageGraphNode | undefined) === undefined
      ) {
        return [];
      }
      return Object.keys(lineageGraph.nodes[key].data.children);
    },
    degree,
  );
}

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
