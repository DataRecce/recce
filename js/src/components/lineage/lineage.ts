/* eslint-disable @typescript-eslint/no-unnecessary-condition */
// TODO LineageData typing needs to be fully thought out to handle the edge-cases - JMS
import { Node, Edge, Position } from "reactflow";
import { getNeighborSet, union } from "./graph";
import { Run } from "@/lib/api/types";
import dagre from "dagre";
import {
  CatalogMetadata,
  LineageData,
  LineageDiffData,
  ManifestMetadata,
  NodeData,
} from "@/lib/api/info";
import { ColumnLineageData } from "@/lib/api/cll";

/**
 * The types for internal data structures.
 */

export interface LineageGraphNode {
  id: string;
  name: string;
  from: "both" | "base" | "current";
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
}

export interface LinageGraphColumnNode {
  node: LineageGraphNode;
  column: string;
  type: string;
  transformationType?: string;
  changeStatus?: "added" | "removed" | "modified";
}

export interface LineageGraphEdge {
  id: string;
  from: "both" | "base" | "current";
  changeStatus?: "added" | "removed";
  parent: LineageGraphNode;
  child: LineageGraphNode;
}

export interface LineageGraph {
  nodes: Record<string, LineageGraphNode>;

  edges: Record<string, LineageGraphEdge>;
  modifiedSet: string[];
  nonBreakingSet: Set<string>;
  impactedSet: Set<string>;

  manifestMetadata: {
    base?: ManifestMetadata;
    current?: ManifestMetadata;
  };
  catalogMetadata: {
    base?: CatalogMetadata;
    current?: CatalogMetadata;
  };
}

export type NodeColumnSetMap = Record<string, Set<string>>;

export function _selectColumnLevelLineage(node: string, column: string, cll: ColumnLineageData) {
  const parentMap: Record<string, string[]> = {};
  const childMap: Record<string, string[]> = {};
  const selectedColumn = `${node}_${column}`;

  for (const modelNode of Object.values(cll.current.nodes)) {
    const nodeId = modelNode.id;
    if (!nodeId) {
      continue;
    }
    for (const columnNode of Object.values(modelNode.columns ?? {})) {
      const target = `${nodeId}_${columnNode.name}`;
      parentMap[target] = [];

      for (const parent of columnNode.depends_on ?? []) {
        const source = `${parent.node}_${parent.column}`;
        parentMap[target].push(source);
        if (!(source in childMap)) {
          childMap[source] = [];
        }
        childMap[source].push(target);
      }
    }
  }

  const selectColumnUpstream = (nodeIds: string[], degree = 1000) => {
    return getNeighborSet(
      nodeIds,
      (key) => {
        if (!(key in parentMap)) {
          return [];
        }
        return parentMap[key];
      },
      degree,
    );
  };

  const selectColumnDownstream = (nodeIds: string[], degree = 1000) => {
    return getNeighborSet(
      nodeIds,
      (key) => {
        if (!(key in childMap)) {
          return [];
        }
        return childMap[key];
      },
      degree,
    );
  };

  const columnSet = union(
    selectColumnDownstream([selectedColumn]),
    selectColumnUpstream([selectedColumn]),
  );
  return columnSet;
}

export function buildLineageGraph(
  base: LineageData,
  current: LineageData,
  diff?: LineageDiffData,
): LineageGraph {
  const nodes: Record<string, LineageGraphNode> = {};
  const edges: Record<string, LineageGraphEdge> = {};
  const buildNode = (key: string, from: "base" | "current"): LineageGraphNode => {
    return {
      id: key,
      name: key,
      data: {},
      from,
      parents: {},
      children: {},
    };
  };

  for (const [key, nodeData] of Object.entries(base.nodes)) {
    nodes[key] = buildNode(key, "base");
    if (nodeData) {
      nodes[key].data.base = nodeData;
      nodes[key].name = nodeData.name;
      nodes[key].resourceType = nodeData.resource_type;
      nodes[key].packageName = nodeData.package_name;
    }
  }

  for (const [key, nodeData] of Object.entries(current.nodes)) {
    if (nodes[key]) {
      nodes[key].from = "both";
    } else {
      nodes[key] = buildNode(key, "current");
    }
    if (nodeData) {
      // TODO `current.nodes` is treated as potentially falsy here
      //  this means either that a) the typing needs to be adjusted
      //  on `current.nodes` or b) the input to `current.nodes`
      //  should default to a value
      nodes[key].data.current = current.nodes[key];
      nodes[key].name = nodeData.name;
      nodes[key].resourceType = nodeData.resource_type;
      nodes[key].packageName = nodeData.package_name;
    }
  }

  for (const [child, parents] of Object.entries(base.parent_map)) {
    for (const parent of parents) {
      const childNode = nodes[child];
      const parentNode = nodes[parent];
      const id = `${parent}_${child}`;

      if (!childNode || !parentNode) {
        // Skip the edge if the node is not found
        continue;
      }
      edges[id] = {
        id,
        from: "base",
        parent: parentNode,
        child: childNode,
      };
      const edge = edges[id];

      childNode.parents[parent] = edge;
      parentNode.children[child] = edge;
    }
  }

  for (const [child, parents] of Object.entries(current.parent_map)) {
    for (const parent of parents) {
      const childNode = nodes[child];
      const parentNode = nodes[parent];
      const id = `${parent}_${child}`;

      if (!childNode || !parentNode) {
        // Skip the edge if the node is not found
        continue;
      }
      if (edges[id]) {
        edges[id].from = "both";
      } else {
        edges[id] = {
          id,
          from: "current",
          parent: parentNode,
          child: childNode,
        };
      }
      const edge = edges[id];

      childNode.parents[parent] = edge;
      parentNode.children[child] = edge;
    }
  }

  const modifiedSet: string[] = [];
  const nonBreakingSet: string[] = [];
  const breakingSet: string[] = [];

  for (const [key, node] of Object.entries(nodes)) {
    if (diff) {
      const diffNode = diff[key];
      if (diffNode) {
        node.changeStatus = diffNode.change_status;
        if (diffNode.change) {
          node.change = {
            category: diffNode.change.category,
            columns: diffNode.change.columns,
          };
        }
        modifiedSet.push(key);

        if (diffNode?.change?.category === "non_breaking") {
          nonBreakingSet.push(key);
        } else {
          breakingSet.push(key);
        }
      }
    } else if (node.from === "base") {
      node.changeStatus = "removed";
      modifiedSet.push(node.id);
    } else if (node.from === "current") {
      node.changeStatus = "added";
      modifiedSet.push(node.id);
    } else {
      const checksum1 = node.data.base?.checksum?.checksum;
      const checksum2 = node.data.current?.checksum?.checksum;

      if (checksum1 && checksum2 && checksum1 !== checksum2) {
        node.changeStatus = "modified";
        modifiedSet.push(node.id);
        breakingSet.push(key);
      }
    }
  }

  for (const [key, edge] of Object.entries(edges)) {
    if (edge.from === "base") {
      edge.changeStatus = "removed";
    } else if (edge.from === "current") {
      edge.changeStatus = "added";
    }
  }

  const impactedSet = union(
    new Set(modifiedSet),
    getNeighborSet(breakingSet, (key) => {
      if (nodes[key] === undefined) {
        return [];
      }
      return Object.keys(nodes[key].children);
    }),
  );

  return {
    nodes,
    edges,
    modifiedSet,
    nonBreakingSet: new Set(nonBreakingSet),
    impactedSet,
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

export function selectUpstream(lineageGraph: LineageGraph, nodeIds: string[], degree = 1000) {
  return getNeighborSet(
    nodeIds,
    (key) => {
      if (lineageGraph.nodes[key] === undefined) {
        return [];
      }
      return Object.keys(lineageGraph.nodes[key].parents);
    },
    degree,
  );
}

export function selectDownstream(lineageGraph: LineageGraph, nodeIds: string[], degree = 1000) {
  return getNeighborSet(
    nodeIds,
    (key) => {
      if (lineageGraph.nodes[key] === undefined) {
        return [];
      }
      return Object.keys(lineageGraph.nodes[key].children);
    },
    degree,
  );
}

export function toReactflow(
  lineageGraph: LineageGraph,
  options?: {
    selectedNodes?: string[];
    columnLevelLineage?: {
      node: string;
      column: string;
    };
    cll?: ColumnLineageData;
    breakingChangeEnabled?: boolean;
  },
): [Node[], Edge[], NodeColumnSetMap] {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const { selectedNodes, columnLevelLineage, cll, breakingChangeEnabled } = options ?? {};
  const columnSet =
    columnLevelLineage && cll != null
      ? _selectColumnLevelLineage(columnLevelLineage.node, columnLevelLineage.column, cll)
      : new Set<string>();

  const nodeColumnSetMap: NodeColumnSetMap = {};

  function getWeight(from: string) {
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
    const weightA = getWeight(a.from);
    const weightB = getWeight(b.from);

    if (weightA < weightB) {
      return -1;
    } else if (weightA > weightB) {
      return 1;
    }
    return 0;
  }

  const filterSet = selectedNodes !== undefined ? new Set(selectedNodes) : undefined;
  const sortedNodes = Object.values(lineageGraph.nodes).sort(compareFn);
  for (const node of sortedNodes) {
    if (filterSet && !filterSet.has(node.id)) {
      continue;
    }

    // add column nodes
    const nodeColumnSet = new Set<string>();
    let columnIndex = 0;
    if (columnLevelLineage) {
      const cllNodeColumns = cll?.current?.nodes?.[node.id]?.columns ?? {};

      for (const column of Object.values(cllNodeColumns)) {
        const columnKey = `${node.id}_${column.name}`;
        if (!columnSet.has(columnKey)) {
          continue;
        }

        nodes.push({
          id: columnKey,
          position: { x: 10, y: 70 + columnIndex * 15 },
          parentId: node.id,
          extent: "parent",
          draggable: false,
          data: {
            node,
            column: column.name,
            type: column.type,
            transformationType: column.transformation_type,
          },
          style: {
            zIndex: 9999,
          },
          type: "customColumnNode",
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
        });

        for (const parentColumn of column.depends_on ?? []) {
          const source = `${parentColumn.node}_${parentColumn.column}`;
          const target = columnKey;

          if (!columnSet.has(source)) {
            continue;
          }

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
    } else if (breakingChangeEnabled && node.change) {
      for (const [column, changeStatus] of Object.entries(node.change.columns ?? {})) {
        const columnKey = `${node.id}_${column}`;
        const columnType =
          node.data.current?.columns?.[column]?.type ?? node.data.base?.columns?.[column]?.type;

        nodes.push({
          id: columnKey,
          position: { x: 10, y: 70 + columnIndex * 15 },
          parentId: node.id,
          extent: "parent",
          draggable: false,
          data: {
            node,
            column,
            type: columnType,
            changeStatus,
          },
          style: {
            zIndex: 9999,
          },
          type: "customColumnNode",
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
        });

        columnIndex++;
        nodeColumnSet.add(column);
      }
    }

    nodeColumnSetMap[node.id] = nodeColumnSet;

    let height = 60;
    if (columnIndex > 0) {
      height += 20 + columnIndex * 15;
    }

    nodes.push({
      id: node.id,
      position: { x: 0, y: 0 },
      width: 300,
      height: height,
      data: {
        ...node,
      },
      type: "customNode",
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    });
  }

  const sortedEdges = Object.values(lineageGraph.edges).sort(compareFn);
  for (const edge of sortedEdges) {
    if (filterSet && (!filterSet.has(edge.parent.id) || !filterSet.has(edge.child.id))) {
      continue;
    }

    edges.push({
      id: edge.id,
      type: "customEdge",
      source: edge.parent.id,
      target: edge.child.id,
      data: edge,
    });
  }

  layout(nodes, edges);

  return [nodes, edges, nodeColumnSetMap];
}

export const layout = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: direction, ranksep: 50, nodesep: 30 });

  nodes.forEach((node) => {
    if (node.type !== "customNode") {
      return;
    }
    dagreGraph.setNode(node.id, { width: node.width, height: node.height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    if (node.type !== "customNode") {
      return;
    }

    const nodeWidth = node.width ?? 300;
    const nodeHeight = node.height ?? 60;

    const nodeWithPosition = dagreGraph.node(node.id);

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });
};
