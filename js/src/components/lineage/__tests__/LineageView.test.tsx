/**
 * @file LineageView.test.tsx
 * @description Tests for LineageView component
 *
 * Note: This component has complex async behavior with useLayoutEffect that makes
 * comprehensive testing challenging. The tests focus on exported utilities and
 * sub-components that can be tested in isolation.
 *
 * Full integration testing should be done via E2E tests or after the migration
 * to UI package components is complete.
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

import { vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  ReactFlow: vi.fn(() => null),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Background: vi.fn(() => null),
  BackgroundVariant: { Dots: "dots" },
  Controls: vi.fn(() => null),
  ControlButton: vi.fn(() => null),
  MiniMap: vi.fn(() => null),
  Panel: vi.fn(() => null),
  useReactFlow: vi.fn(() => ({
    fitView: vi.fn(),
    setCenter: vi.fn(),
    getNodes: vi.fn(() => []),
  })),
  useNodesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  useEdgesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  getNodesBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
  Handle: vi.fn(() => null),
  Position: {
    Left: "left",
    Right: "right",
    Top: "top",
    Bottom: "bottom",
  },
}));

// ============================================================================
// Imports
// ============================================================================

import type {
  LineageGraph,
  LineageGraphEdge,
  LineageGraphNode,
} from "@datarecce/ui";
import {
  buildLineageGraph,
  isLineageGraphColumnNode,
  isLineageGraphNode,
  selectDownstream,
  selectUpstream,
} from "@datarecce/ui";
import type { MergedLineageResponse } from "@datarecce/ui/api";
import { toReactFlow } from "@datarecce/ui/components/lineage/lineage";
import React from "react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockMergedLineage = (): MergedLineageResponse => ({
  nodes: {
    "model.test.node1": {
      name: "node1",
      resource_type: "model",
      package_name: "test",
    },
    "model.test.node2": {
      name: "node2",
      resource_type: "model",
      package_name: "test",
    },
    "model.test.node3": {
      name: "node3",
      resource_type: "model",
      package_name: "test",
    },
  },
  edges: [
    { source: "model.test.node1", target: "model.test.node2" },
    { source: "model.test.node2", target: "model.test.node3" },
  ],
  metadata: {
    base: { manifest_metadata: { project_name: "test" } as any },
    current: { manifest_metadata: { project_name: "test" } as any },
  },
});

// ============================================================================
// Lineage Graph Building Tests
// ============================================================================

describe("LineageView - buildLineageGraph", () => {
  it("builds graph with nodes from merged lineage", () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    expect(Object.keys(graph.nodes)).toHaveLength(3);
    expect(graph.nodes["model.test.node1"]).toBeDefined();
    expect(graph.nodes["model.test.node2"]).toBeDefined();
    expect(graph.nodes["model.test.node3"]).toBeDefined();
  });

  it("builds graph with edges from merged lineage", () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    expect(Object.keys(graph.edges)).toHaveLength(2);
  });

  it("nodes have no changeStatus when not in diff", () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    expect(graph.nodes["model.test.node1"].data.changeStatus).toBeUndefined();
  });

  it("marks nodes as removed when change_status is removed", () => {
    const lineage = createMockMergedLineage();
    // Remove node1 and node3, keep only node2 with "removed" status on node1
    lineage.nodes["model.test.node1"].change_status = "removed";

    const graph = buildLineageGraph(lineage);

    expect(graph.nodes["model.test.node1"].data.changeStatus).toBe("removed");
  });

  it("marks nodes as added when change_status is added", () => {
    const lineage = createMockMergedLineage();
    lineage.nodes["model.test.node1"].change_status = "added";

    const graph = buildLineageGraph(lineage);

    expect(graph.nodes["model.test.node1"].data.changeStatus).toBe("added");
  });

  it("tracks modified nodes in modifiedSet", () => {
    const lineage = createMockMergedLineage();
    lineage.nodes["model.test.node1"].change_status = "modified";

    const graph = buildLineageGraph(lineage);

    expect(graph.modifiedSet).toContain("model.test.node1");
    expect(graph.nodes["model.test.node1"].data.changeStatus).toBe("modified");
  });

  it("applies diff data for change status", () => {
    const lineage = createMockMergedLineage();
    lineage.nodes["model.test.node1"].change_status = "modified";
    lineage.nodes["model.test.node1"].change = {
      category: "breaking",
      columns: { col1: "added" },
    };

    const graph = buildLineageGraph(lineage);

    expect(graph.nodes["model.test.node1"].data.changeStatus).toBe("modified");
    expect(graph.nodes["model.test.node1"].data.change?.category).toBe(
      "breaking",
    );
  });
});

// ============================================================================
// Node Selection Tests
// ============================================================================

describe("LineageView - selectUpstream", () => {
  it("selects upstream nodes within degree", () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    const upstream = selectUpstream(graph, ["model.test.node3"]);

    expect(upstream.has("model.test.node2")).toBe(true);
    expect(upstream.has("model.test.node1")).toBe(true);
    expect(upstream.has("model.test.node3")).toBe(true);
  });

  it("limits selection to specified degree", () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    const upstream = selectUpstream(graph, ["model.test.node3"], 1);

    expect(upstream.has("model.test.node2")).toBe(true);
    expect(upstream.has("model.test.node1")).toBe(false);
    expect(upstream.has("model.test.node3")).toBe(true);
  });
});

describe("LineageView - selectDownstream", () => {
  it("selects downstream nodes within degree", () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    const downstream = selectDownstream(graph, ["model.test.node1"]);

    expect(downstream.has("model.test.node2")).toBe(true);
    expect(downstream.has("model.test.node3")).toBe(true);
    expect(downstream.has("model.test.node1")).toBe(true);
  });

  it("limits selection to specified degree", () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    const downstream = selectDownstream(graph, ["model.test.node1"], 1);

    expect(downstream.has("model.test.node2")).toBe(true);
    expect(downstream.has("model.test.node3")).toBe(false);
    expect(downstream.has("model.test.node1")).toBe(true);
  });
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe("LineageView - type guards", () => {
  it("isLineageGraphNode returns true for graph nodes", () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    expect(isLineageGraphNode(graph.nodes["model.test.node1"])).toBe(true);
  });

  it("isLineageGraphColumnNode returns false for graph nodes", () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    expect(isLineageGraphColumnNode(graph.nodes["model.test.node1"])).toBe(
      false,
    );
  });
});

// ============================================================================
// toReactFlow Conversion Tests
// ============================================================================

describe("LineageView - toReactFlow", () => {
  it("converts lineage graph to ReactFlow format", async () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    const [nodes, edges, columnSetMap] = await toReactFlow(graph);

    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
    expect(Object.keys(columnSetMap)).toHaveLength(3);
  });

  it("filters nodes based on selectedNodes option", async () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    const [nodes, edges] = await toReactFlow(graph, {
      selectedNodes: ["model.test.node1"],
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("model.test.node1");
    expect(edges).toHaveLength(0); // No edges since only one node
  });

  it("assigns positions to nodes via dagre layout", async () => {
    const graph = buildLineageGraph(createMockMergedLineage());

    const [nodes] = await toReactFlow(graph);

    // All nodes should have positions set
    for (const node of nodes) {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
    }
  });
});
