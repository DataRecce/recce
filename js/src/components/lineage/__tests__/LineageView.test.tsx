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
import type { LineageDataFromMetadata } from "@datarecce/ui/api";
import { toReactFlow } from "@datarecce/ui/components/lineage/lineage";
import React from "react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockLineageDataFromMetadata = (): LineageDataFromMetadata =>
  ({
    metadata: {
      pr_url: "https://github.com/test/test/pull/1",
    },
    nodes: {
      "model.test.node1": {
        id: "model.test.node1",
        unique_id: "model.test.node1",
        name: "node1",
        resource_type: "model",
        package_name: "test",
        columns: {},
        checksum: { name: "sha256", checksum: "abc123" },
      },
      "model.test.node2": {
        id: "model.test.node2",
        unique_id: "model.test.node2",
        name: "node2",
        resource_type: "model",
        package_name: "test",
        columns: {},
        checksum: { name: "sha256", checksum: "def456" },
      },
      "model.test.node3": {
        id: "model.test.node3",
        unique_id: "model.test.node3",
        name: "node3",
        resource_type: "model",
        package_name: "test",
        columns: {},
        checksum: { name: "sha256", checksum: "ghi789" },
      },
    },
    parent_map: {
      "model.test.node2": ["model.test.node1"],
      "model.test.node3": ["model.test.node2"],
    },
    // Using minimal mock data - full ManifestMetadata properties not needed for tests
    manifest_metadata: {
      project_name: "test",
    },
    catalog_metadata: {},
  }) as unknown as LineageDataFromMetadata;

// ============================================================================
// Lineage Graph Building Tests
// ============================================================================

describe("LineageView - buildLineageGraph", () => {
  it("builds graph with nodes from base and current", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();

    const graph = buildLineageGraph(base, current);

    expect(Object.keys(graph.nodes)).toHaveLength(3);
    expect(graph.nodes["model.test.node1"]).toBeDefined();
    expect(graph.nodes["model.test.node2"]).toBeDefined();
    expect(graph.nodes["model.test.node3"]).toBeDefined();
  });

  it("builds graph with edges from parent_map", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();

    const graph = buildLineageGraph(base, current);

    expect(Object.keys(graph.edges)).toHaveLength(2);
  });

  it("marks nodes as from=both when in both base and current", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();

    const graph = buildLineageGraph(base, current);

    expect(graph.nodes["model.test.node1"].data.from).toBe("both");
  });

  it("marks nodes as from=base when only in base", () => {
    const base = createMockLineageDataFromMetadata();
    const current = {
      ...createMockLineageDataFromMetadata(),
      nodes: {
        "model.test.node2":
          createMockLineageDataFromMetadata().nodes["model.test.node2"],
      },
      parent_map: {},
    };

    const graph = buildLineageGraph(base, current);

    expect(graph.nodes["model.test.node1"].data.from).toBe("base");
    expect(graph.nodes["model.test.node1"].data.changeStatus).toBe("removed");
  });

  it("marks nodes as from=current when only in current", () => {
    const base = {
      ...createMockLineageDataFromMetadata(),
      nodes: {},
      parent_map: {},
    };
    const current = createMockLineageDataFromMetadata();

    const graph = buildLineageGraph(base, current);

    expect(graph.nodes["model.test.node1"].data.from).toBe("current");
    expect(graph.nodes["model.test.node1"].data.changeStatus).toBe("added");
  });

  it("tracks modified nodes in modifiedSet", () => {
    const base = createMockLineageDataFromMetadata();
    const baseData = createMockLineageDataFromMetadata();
    const current = {
      ...baseData,
      nodes: {
        ...baseData.nodes,
        "model.test.node1": {
          ...baseData.nodes["model.test.node1"],
          checksum: { name: "sha256", checksum: "modified123" },
        },
      },
    } as LineageDataFromMetadata;

    const graph = buildLineageGraph(base, current);

    expect(graph.modifiedSet).toContain("model.test.node1");
    expect(graph.nodes["model.test.node1"].data.changeStatus).toBe("modified");
  });

  it("applies diff data for change status", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();
    const diff = {
      "model.test.node1": {
        change_status: "modified" as const,
        change: {
          category: "breaking" as const,
          columns: { col1: "added" as const },
        },
      },
    };

    const graph = buildLineageGraph(base, current, diff);

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
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();
    const graph = buildLineageGraph(base, current);

    const upstream = selectUpstream(graph, ["model.test.node3"]);

    expect(upstream.has("model.test.node2")).toBe(true);
    expect(upstream.has("model.test.node1")).toBe(true);
    expect(upstream.has("model.test.node3")).toBe(true);
  });

  it("limits selection to specified degree", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();
    const graph = buildLineageGraph(base, current);

    const upstream = selectUpstream(graph, ["model.test.node3"], 1);

    expect(upstream.has("model.test.node2")).toBe(true);
    expect(upstream.has("model.test.node1")).toBe(false);
    expect(upstream.has("model.test.node3")).toBe(true);
  });
});

describe("LineageView - selectDownstream", () => {
  it("selects downstream nodes within degree", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();
    const graph = buildLineageGraph(base, current);

    const downstream = selectDownstream(graph, ["model.test.node1"]);

    expect(downstream.has("model.test.node2")).toBe(true);
    expect(downstream.has("model.test.node3")).toBe(true);
    expect(downstream.has("model.test.node1")).toBe(true);
  });

  it("limits selection to specified degree", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();
    const graph = buildLineageGraph(base, current);

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
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();
    const graph = buildLineageGraph(base, current);

    expect(isLineageGraphNode(graph.nodes["model.test.node1"])).toBe(true);
  });

  it("isLineageGraphColumnNode returns false for graph nodes", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();
    const graph = buildLineageGraph(base, current);

    expect(isLineageGraphColumnNode(graph.nodes["model.test.node1"])).toBe(
      false,
    );
  });
});

// ============================================================================
// toReactFlow Conversion Tests
// ============================================================================

describe("LineageView - toReactFlow", () => {
  it("converts lineage graph to ReactFlow format", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();
    const graph = buildLineageGraph(base, current);

    const [nodes, edges, columnSetMap] = toReactFlow(graph);

    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
    expect(Object.keys(columnSetMap)).toHaveLength(3);
  });

  it("filters nodes based on selectedNodes option", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();
    const graph = buildLineageGraph(base, current);

    const [nodes, edges] = toReactFlow(graph, {
      selectedNodes: ["model.test.node1"],
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("model.test.node1");
    expect(edges).toHaveLength(0); // No edges since only one node
  });

  it("assigns positions to nodes via dagre layout", () => {
    const base = createMockLineageDataFromMetadata();
    const current = createMockLineageDataFromMetadata();
    const graph = buildLineageGraph(base, current);

    const [nodes] = toReactFlow(graph);

    // All nodes should have positions set
    for (const node of nodes) {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
    }
  });
});
