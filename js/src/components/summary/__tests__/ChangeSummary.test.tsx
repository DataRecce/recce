/**
 * @file ChangeSummary.test.tsx
 * @description Tests for ChangeSummary component focusing on rendering and basic functionality
 *
 * Tests verify:
 * - Component renders without errors
 * - Displays correct section titles and labels
 * - Handles various data scenarios gracefully
 * - Icons are rendered correctly (real SVG icons)
 *
 * Source of truth: @datarecce/ui implementation - OSS re-exports from there
 */

// ============================================================================
// Mocks
// ============================================================================

// No mocks needed - uses real @datarecce/ui implementation

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraph, LineageGraphNode } from "@datarecce/ui";
import { ChangeSummary } from "@datarecce/ui/components/summary";
import { render, screen } from "@testing-library/react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockNode = (
  id: string,
  changeStatus: "added" | "removed" | "modified" | undefined,
  _baseColumns: Record<string, { type: string }> = {},
  _currentColumns: Record<string, { type: string }> = {},
): LineageGraphNode => ({
  id,
  type: "lineageGraphNode",
  position: { x: 0, y: 0 },
  data: {
    id,
    name: id.split(".").pop() || id,
    changeStatus,
    resourceType: "model",
    packageName: "test",
    parents: {},
    children: {},
  },
});

const createMockLineageGraph = (
  nodes: LineageGraphNode[] = [],
): LineageGraph => {
  const nodesMap: Record<string, LineageGraphNode> = {};
  const modifiedSet: string[] = [];

  for (const node of nodes) {
    nodesMap[node.id] = node;
    if (node.data.changeStatus) {
      modifiedSet.push(node.id);
    }
  }

  return {
    nodes: nodesMap,
    edges: {},
    modifiedSet,
    manifestMetadata: { base: undefined, current: undefined },
    catalogMetadata: { base: undefined, current: undefined },
  };
};

// ============================================================================
// Tests
// ============================================================================

describe("ChangeSummary (Simplified)", () => {
  describe("rendering", () => {
    it("renders without errors with empty graph", () => {
      const lineageGraph = createMockLineageGraph([]);
      render(<ChangeSummary lineageGraph={lineageGraph} />);

      expect(screen.getByText("Code Changes")).toBeInTheDocument();
      expect(screen.getByText("Column Changes")).toBeInTheDocument();
    });

    it("renders all change status labels", () => {
      const lineageGraph = createMockLineageGraph([]);
      render(<ChangeSummary lineageGraph={lineageGraph} />);

      expect(screen.getByText("Model Added")).toBeInTheDocument();
      expect(screen.getByText("Model Removed")).toBeInTheDocument();
      expect(screen.getByText("Model Modified")).toBeInTheDocument();
      expect(screen.getByText("Column Added")).toBeInTheDocument();
      expect(screen.getByText("Column Removed")).toBeInTheDocument();
      expect(screen.getByText("Column Modified")).toBeInTheDocument();
    });

    it("renders icons for each change type", () => {
      const lineageGraph = createMockLineageGraph([]);
      const { container } = render(
        <ChangeSummary lineageGraph={lineageGraph} />,
      );

      // Icons are SVG elements - 6 icons total (3 for code changes, 3 for column changes)
      const svgIcons = container.querySelectorAll("svg");
      expect(svgIcons.length).toBe(6);
    });
  });

  describe("data handling", () => {
    it("handles added nodes", () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode("node1", "added", {}, { col1: { type: "STRING" } }),
      ]);

      render(<ChangeSummary lineageGraph={lineageGraph} />);
      // Should render without errors
      expect(screen.getByText("Code Changes")).toBeInTheDocument();
    });

    it("handles removed nodes", () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode("node1", "removed", { col1: { type: "STRING" } }, {}),
      ]);

      render(<ChangeSummary lineageGraph={lineageGraph} />);
      // Should render without errors
      expect(screen.getByText("Code Changes")).toBeInTheDocument();
    });

    it("handles modified nodes", () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode(
          "node1",
          "modified",
          { col1: { type: "STRING" } },
          { col1: { type: "VARCHAR" } },
        ),
      ]);

      render(<ChangeSummary lineageGraph={lineageGraph} />);
      // Should render without errors
      expect(screen.getByText("Code Changes")).toBeInTheDocument();
    });

    it("handles mixed change types", () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode("node1", "added", {}, { col1: { type: "STRING" } }),
        createMockNode("node2", "removed", { col1: { type: "STRING" } }, {}),
        createMockNode(
          "node3",
          "modified",
          { col1: { type: "STRING" } },
          { col1: { type: "VARCHAR" } },
        ),
      ]);

      render(<ChangeSummary lineageGraph={lineageGraph} />);
      // Should render without errors
      expect(screen.getByText("Code Changes")).toBeInTheDocument();
      expect(screen.getByText("Column Changes")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles undefined columns gracefully", () => {
      const lineageGraph: LineageGraph = {
        nodes: {
          node1: {
            id: "node1",
            type: "lineageGraphNode",
            position: { x: 0, y: 0 },
            data: {
              id: "node1",
              name: "node1",
              changeStatus: "modified",
              resourceType: "model",
              packageName: "test",
              parents: {},
              children: {},
            },
          },
        },
        edges: {},
        modifiedSet: ["node1"],
        manifestMetadata: { base: undefined, current: undefined },
        catalogMetadata: { base: undefined, current: undefined },
      };

      render(<ChangeSummary lineageGraph={lineageGraph} />);
      // Should not crash
      expect(screen.getByText("Code Changes")).toBeInTheDocument();
    });

    it("handles empty modifiedSet", () => {
      const lineageGraph = createMockLineageGraph([]);

      render(<ChangeSummary lineageGraph={lineageGraph} />);
      expect(screen.getByText("Code Changes")).toBeInTheDocument();
    });

    it("handles large number of changes", () => {
      const nodes = Array.from({ length: 50 }, (_, i) =>
        createMockNode(
          `node${i}`,
          i % 3 === 0 ? "added" : i % 3 === 1 ? "removed" : "modified",
          i % 3 !== 0 ? { col1: { type: "STRING" } } : {},
          i % 3 !== 1 ? { col1: { type: "VARCHAR" } } : {},
        ),
      );
      const lineageGraph = createMockLineageGraph(nodes);

      render(<ChangeSummary lineageGraph={lineageGraph} />);
      // Should render without performance issues
      expect(screen.getByText("Code Changes")).toBeInTheDocument();
    });
  });

  describe("layout", () => {
    it("renders in grid layout", () => {
      const lineageGraph = createMockLineageGraph([]);
      const { container } = render(
        <ChangeSummary lineageGraph={lineageGraph} />,
      );

      const gridItems = container.querySelectorAll('[class*="MuiGrid-root"]');
      expect(gridItems.length).toBeGreaterThanOrEqual(2);
    });
  });
});
