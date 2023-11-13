import _ from "lodash";
import "./styles/diff.css";
import { Node, Edge, Position } from "reactflow";

/**
 * The data from the API
 */
interface LineageData {
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
  resourceType?: string;
  packageName?: string;
  parents: {
    [key: string]: LineageGraphEdge;
  };
  children: {
    [key: string]: LineageGraphEdge;
  };
}

interface LineageGraphEdge {
  id: string;
  from: "both" | "base" | "current";
  parent: LineageGraphNode;
  child: LineageGraphNode;
}

interface LineageGraph {
  nodes: {
    [key: string]: LineageGraphNode;
  };

  edges: {
    [key: string]: LineageGraphEdge;
  };
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
      from,
      parents: {},
      children: {},
    };
  };

  for (const [key, parents] of Object.entries(base.parent_map)) {
    nodes[key] = buildNode(key, "base");
  }

  for (const [key, parents] of Object.entries(current.parent_map)) {
    if (nodes[key]) {
      nodes[key].from = "both";
    } else {
      nodes[key] = buildNode(key, "current");
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

  return {
    nodes,
    edges,
  };
}

export function toReactflow(lineageGraph: LineageGraph): [Node[], Edge[]] {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const backgroundColorMap = {
    both: "white",
    base: "red",
    current: "green",
    modified: "orange",
  };
  const strokeColorMap = {
    both: "black",
    base: "red",
    current: "green",
  };

  for (const [key, node] of Object.entries(lineageGraph.nodes)) {
    // node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    // node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    nodes.push({
      id: node.id,
      position: { x: 0, y: 0 },
      data: { label: node.name },
      style: { backgroundColor: backgroundColorMap[node.from] },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    });
  }

  for (const [key, edge] of Object.entries(lineageGraph.edges)) {
    edges.push({
      id: edge.id,
      source: edge.parent.id,
      target: edge.child.id,
      style: { stroke: strokeColorMap[edge.from] },
    });
  }

  return [nodes, edges];
}
