import { describe, expect, it, vi } from "vitest";
import type { LineageGraph } from "../../../contexts/lineage/types";
import { toReactFlow } from "../lineage";

// Mock @dagrejs/dagre
vi.mock("@dagrejs/dagre", () => {
  class MockGraph {
    setGraph = vi.fn();
    setDefaultEdgeLabel = vi.fn(() => ({}));
    setNode = vi.fn();
    setEdge = vi.fn();
    node = vi.fn((id: string) => ({ x: 100, y: 100 }));
    nodes = vi.fn(() => []);
  }

  return {
    default: {
      graphlib: {
        Graph: MockGraph,
      },
      layout: vi.fn(),
    },
  };
});

/**
 * Helper to create a minimal LineageGraph for testing
 */
function createMockLineageGraph(nodeIds: string[]): LineageGraph {
  const nodes: LineageGraph["nodes"] = {};
  const edges: LineageGraph["edges"] = {};

  for (const id of nodeIds) {
    nodes[id] = {
      id,
      position: { x: 0, y: 0 },
      data: {
        id,
        name: id,
        from: "both",
        data: {
          base: {
            id,
            name: id,
            unique_id: id,
            resource_type: "model",
            package_name: "test",
            columns: {},
          },
          current: {
            id,
            name: id,
            unique_id: id,
            resource_type: "model",
            package_name: "test",
            columns: {},
          },
        },
        parents: {},
        children: {},
      },
      type: "lineageGraphNode",
    };
  }

  return {
    nodes,
    edges,
    modifiedSet: [],
    manifestMetadata: {},
    catalogMetadata: {},
  };
}

describe("toReactFlow", () => {
  it("uses existing positions when provided", () => {
    const lineageGraph = createMockLineageGraph(["node1", "node2"]);
    const existingPositions = new Map([
      ["node1", { x: 100, y: 200 }],
      ["node2", { x: 300, y: 400 }],
    ]);

    const [nodes] = toReactFlow(lineageGraph, { existingPositions });

    const node1 = nodes.find((n) => n.id === "node1");
    const node2 = nodes.find((n) => n.id === "node2");

    expect(node1?.position).toEqual({ x: 100, y: 200 });
    expect(node2?.position).toEqual({ x: 300, y: 400 });
  });

  it("falls back to dagre layout when positions not provided", () => {
    const lineageGraph = createMockLineageGraph(["node1", "node2"]);

    const [nodes] = toReactFlow(lineageGraph);

    // After dagre layout, positions should be updated from (0, 0)
    const node1 = nodes.find((n) => n.id === "node1");
    const node2 = nodes.find((n) => n.id === "node2");

    // The mock dagre returns (100, 100) for center, which gets shifted to top-left
    // For a 300x60 node: (100 - 150, 100 - 30) = (-50, 70)
    expect(node1?.position).toEqual({ x: -50, y: 70 });
    expect(node2?.position).toEqual({ x: -50, y: 70 });
  });

  it("skips layout when all parent nodes have positions", () => {
    const lineageGraph = createMockLineageGraph(["node1", "node2"]);
    const existingPositions = new Map([
      ["node1", { x: 100, y: 200 }],
      ["node2", { x: 300, y: 400 }],
    ]);

    const [nodes] = toReactFlow(lineageGraph, { existingPositions });

    // Positions should remain as provided, not modified by dagre
    const node1 = nodes.find((n) => n.id === "node1");
    const node2 = nodes.find((n) => n.id === "node2");

    expect(node1?.position).toEqual({ x: 100, y: 200 });
    expect(node2?.position).toEqual({ x: 300, y: 400 });
  });

  it("applies partial positions and runs layout for missing ones", () => {
    const lineageGraph = createMockLineageGraph(["node1", "node2", "node3"]);
    const existingPositions = new Map([
      ["node1", { x: 100, y: 200 }],
      // node2 has no position
      ["node3", { x: 500, y: 600 }],
    ]);

    const [nodes] = toReactFlow(lineageGraph, { existingPositions });

    const node1 = nodes.find((n) => n.id === "node1");
    const node2 = nodes.find((n) => n.id === "node2");
    const node3 = nodes.find((n) => n.id === "node3");

    // When any node is missing a position, layout runs for all nodes
    // Since layout modifies all nodes, they all get dagre positions
    // The mock dagre returns (100, 100) for center, shifted to (-50, 70) for top-left
    expect(node1?.position).toEqual({ x: -50, y: 70 });
    expect(node2?.position).toEqual({ x: -50, y: 70 });
    expect(node3?.position).toEqual({ x: -50, y: 70 });
  });

  it("preserves column node positions relative to parent", () => {
    const lineageGraph = createMockLineageGraph(["node1"]);
    // Add columns to the node
    lineageGraph.nodes.node1.data.data.current = {
      ...lineageGraph.nodes.node1.data.data.current!,
      columns: {
        col1: {
          name: "col1",
          type: "varchar",
        },
      },
    };

    const existingPositions = new Map([["node1", { x: 200, y: 300 }]]);

    const columnLineageData = {
      current: {
        nodes: {
          node1: {
            id: "node1",
            name: "node1",
            source_name: "test",
            resource_type: "model",
          },
        },
        columns: {
          node1_col1: {
            name: "col1",
            type: "varchar",
            transformation_type: "direct",
          },
        },
        parent_map: {
          node1: [],
          node1_col1: [],
        },
        child_map: {
          node1: [],
          node1_col1: [],
        },
      },
    };

    const [nodes] = toReactFlow(lineageGraph, {
      existingPositions,
      cll: columnLineageData,
    });

    const parentNode = nodes.find((n) => n.id === "node1");
    const columnNode = nodes.find((n) => n.id === "node1_col1");

    expect(parentNode?.position).toEqual({ x: 200, y: 300 });
    // Column nodes have relative positions within parent
    expect(columnNode?.position).toEqual({ x: 10, y: 70 });
    expect(columnNode?.parentId).toBe("node1");
  });
});
