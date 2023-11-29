import _ from "lodash";
import { Node, Edge, Position } from "reactflow";
import { getNeighborSet } from "./graph";

/**
 * The data from the API
 */
export interface NodeColumnData {
  name: string;
  type: string;
}
export interface NodeData {
  unique_id: string;
  name: string;
  checksum?: {
    name: string;
    checksum: string;
  };
  raw_code?: string;
  resource_type?: string;
  package_name?: string;
  columns?: { [key: string]: NodeColumnData };
}

export interface LineageData {
  nodes?: {
    [key: string]: NodeData;
  };
  parent_map: {
    [key: string]: string[];
  };
}

/**
 * THe types for internal data structures.
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
  resourceType?: string;
  packageName?: string;
  parents: {
    [key: string]: LineageGraphEdge;
  };
  children: {
    [key: string]: LineageGraphEdge;
  };

  isHighlighted?: boolean;
}

export interface LineageGraphEdge {
  id: string;
  from: "both" | "base" | "current";
  changeStatus?: "added" | "removed";
  parent: LineageGraphNode;
  child: LineageGraphNode;
  isHighlighted?: boolean;
}

export interface LineageGraph {
  nodes: {
    [key: string]: LineageGraphNode;
  };

  edges: {
    [key: string]: LineageGraphEdge;
  };

  modifiedSet: string[];
}

export function buildLineageGraph(
  base: LineageData,
  current: LineageData
): LineageGraph {
  const nodes: { [key: string]: LineageGraphNode } = {};
  const edges: { [key: string]: LineageGraphEdge } = {};
  const buildNode = (
    key: string,
    from: "base" | "current"
  ): LineageGraphNode => {
    return {
      id: key,
      name: key,
      data: {},
      from,
      parents: {},
      children: {},
    };
  };

  for (const [key, parents] of Object.entries(base.parent_map)) {
    nodes[key] = buildNode(key, "base");
    const nodeData = base.nodes && base.nodes[key];
    if (nodeData) {
      nodes[key].data.base = nodeData;
      nodes[key].name = nodeData?.name;
      nodes[key].resourceType = nodeData?.resource_type;
      nodes[key].packageName = nodeData?.package_name;
    }
  }

  for (const [key, parents] of Object.entries(current.parent_map)) {
    if (nodes[key]) {
      nodes[key].from = "both";
    } else {
      nodes[key] = buildNode(key, "current");
    }
    const nodeData = current.nodes && current.nodes[key];
    if (nodeData) {
      nodes[key].data.current = current.nodes && current.nodes[key];
      nodes[key].name = nodeData?.name;
      nodes[key].resourceType = nodeData?.resource_type;
      nodes[key].packageName = nodeData?.package_name;
    }
  }

  for (const [child, parents] of Object.entries(base.parent_map)) {
    for (const parent of parents) {
      const childNode = nodes[child];
      const parentNode = nodes[parent];
      const id = `${parent}_${child}`;
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
  for (const [key, node] of Object.entries(nodes)) {
    if (node.from === "base") {
      node.changeStatus = "removed";
      modifiedSet.push(node.id);
    } else if (node.from === "current") {
      node.changeStatus = "added";
      modifiedSet.push(node.id);
    } else {
      const checksum1 = node?.data?.base?.checksum?.checksum;
      const checksum2 = node?.data?.current?.checksum?.checksum;

      if (checksum1 && checksum2 && checksum1 !== checksum2) {
        node.changeStatus = "modified";
        modifiedSet.push(node.id);
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

  return {
    nodes,
    edges,
    modifiedSet,
  };
}

export function toReactflow(lineageGraph: LineageGraph): [Node[], Edge[]] {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const backgroundColorMap = {
    removed: "red",
    added: "green",
    modified: "orange",
  };
  const strokeColorMap = {
    removed: "red",
    added: "green",
  };

  for (const [key, node] of Object.entries(lineageGraph.nodes)) {
    nodes.push({
      id: node.id,
      position: { x: 0, y: 0 },
      data: node,
      type: "customNode",
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    });
  }

  for (const [key, edge] of Object.entries(lineageGraph.edges)) {
    edges.push({
      id: edge.id,
      type: "customEdge",
      source: edge.parent.id,
      target: edge.child.id,
      data: edge,
    });
  }

  return highlightPath(lineageGraph, nodes, edges, null);
}

export function highlightPath(
  lineageGraph: LineageGraph,
  nodes: Node<LineageGraphNode>[],
  edges: Edge[],
  id: string | null
): [Node<LineageGraphNode>[], Edge[]] {
  function union(...sets: Set<string>[]) {
    const unionSet = new Set<string>();

    sets.forEach((set) => {
      set.forEach((key) => {
        unionSet.add(key);
      });
    });

    return unionSet;
  }

  const relatedNodes =
    id !== null
      ? union(
          getNeighborSet([id], (key) =>
            Object.keys(lineageGraph.nodes[key].parents)
          ),
          getNeighborSet([id], (key) =>
            Object.keys(lineageGraph.nodes[key].children)
          )
        )
      : getNeighborSet(lineageGraph.modifiedSet, (key) =>
          Object.keys(lineageGraph.nodes[key].children)
        );

  const relatedEdges = new Set(
    edges
      .filter((edge) => {
        return relatedNodes.has(edge.source) && relatedNodes.has(edge.target);
      })
      .map((edge) => edge.id)
  );

  const newNodes = nodes.map((node) => {
    return {
      ...node,
      data: {
        ...node.data,
        isHighlighted: relatedNodes.has(node.id),
      },
    };
  });
  const newEdges = edges.map((edge) => {
    return {
      ...edge,
      data: {
        ...edge.data,
        isHighlighted: relatedEdges.has(edge.id),
      },
    };
  });

  return [newNodes, newEdges];
}