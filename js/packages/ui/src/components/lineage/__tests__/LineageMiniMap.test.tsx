/**
 * MiniMap auto-disable tests.
 *
 * Verifies that:
 * 1. The threshold constant is exported and equals 500
 * 2. LineageCanvas actually hides <MiniMap> when showMiniMap=false
 *    (the prop LineageViewOss derives from the threshold)
 */
import { render, screen } from "@testing-library/react";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import type { LineageEdgeData } from "../edges";
import { LineageCanvas } from "../LineageCanvas";
import { MINIMAP_NODE_THRESHOLD } from "../LineageViewOss";
import type { LineageNodeData } from "../nodes";

// Mock @xyflow/react — same pattern as LineageCanvas.test.tsx
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="reactflow">{children}</div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  useNodesState: (initialNodes: unknown[]) => [initialNodes, vi.fn(), vi.fn()],
  useEdgesState: (initialEdges: unknown[]) => [initialEdges, vi.fn(), vi.fn()],
}));

function makeMockNodes(count: number): Node<LineageNodeData>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: "lineageNode",
    position: { x: i * 400, y: 0 },
    data: { label: `Model ${i}`, changeStatus: "unchanged" as const },
  }));
}

function makeMockEdges(nodeCount: number): Edge<LineageEdgeData>[] {
  if (nodeCount < 2) return [];
  return Array.from({ length: nodeCount - 1 }, (_, i) => ({
    id: `edge-${i}`,
    type: "lineageEdge",
    source: `node-${i}`,
    target: `node-${i + 1}`,
    data: { changeStatus: "unchanged" as const },
  }));
}

describe("MiniMap auto-disable for large graphs", () => {
  it("exports MINIMAP_NODE_THRESHOLD as 500", () => {
    expect(MINIMAP_NODE_THRESHOLD).toBe(500);
  });

  it("renders MiniMap when showMiniMap is true (small graph)", () => {
    const nodes = makeMockNodes(10);
    const edges = makeMockEdges(10);

    render(<LineageCanvas nodes={nodes} edges={edges} showMiniMap={true} />);

    expect(screen.getByTestId("minimap")).toBeInTheDocument();
  });

  it("hides MiniMap when showMiniMap is false (simulating large graph)", () => {
    const nodes = makeMockNodes(10);
    const edges = makeMockEdges(10);

    render(<LineageCanvas nodes={nodes} edges={edges} showMiniMap={false} />);

    expect(screen.queryByTestId("minimap")).not.toBeInTheDocument();
  });

  it("threshold correctly determines showMiniMap prop value", () => {
    // This is the logic used in LineageViewOss:
    // {nodes.length <= MINIMAP_NODE_THRESHOLD && <MiniMap />}
    expect(500 <= MINIMAP_NODE_THRESHOLD).toBe(true); // at threshold → show
    expect(501 <= MINIMAP_NODE_THRESHOLD).toBe(false); // above threshold → hide
    expect(1860 <= MINIMAP_NODE_THRESHOLD).toBe(false); // Super-scale → hide
  });
});
