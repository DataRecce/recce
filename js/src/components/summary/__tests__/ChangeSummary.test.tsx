/**
 * @file ChangeSummary.simplified.test.tsx
 * @description Simplified tests for ChangeSummary component focusing on rendering and basic functionality
 *
 * Tests verify:
 * - Component renders without errors
 * - Displays correct section titles and labels
 * - Handles various data scenarios gracefully
 * - Icons are rendered correctly
 *
 * Source of truth: OSS functionality - these tests document current behavior before migration
 */

// ============================================================================
// Mocks
// ============================================================================

jest.mock("@datarecce/ui", () => ({
  ...jest.requireActual("@datarecce/ui"),
}));

jest.mock("@datarecce/ui/api", () => ({
  ...jest.requireActual("@datarecce/ui/api"),
}));

jest.mock("@datarecce/ui/components/lineage", () => ({
  IconAdded: () => <span data-testid="icon-added">Added</span>,
  IconRemoved: () => <span data-testid="icon-removed">Removed</span>,
  IconModified: () => <span data-testid="icon-modified">Modified</span>,
  IconChanged: () => <span data-testid="icon-changed">Changed</span>,
}));

jest.mock("@/components/ui/mui-theme", () => ({
  token: jest.fn((path: string) => {
    const tokens: Record<string, string> = {
      "colors.green.solid": "#22c55e",
      "colors.red.solid": "#ef4444",
      "colors.amber.emphasized": "#f59e0b",
    };
    return tokens[path] || "#000000";
  }),
}));

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraph, LineageGraphNode } from "@datarecce/ui";
import type { NodeData } from "@datarecce/ui/api";
import { render, screen } from "@testing-library/react";
import { ChangeSummary } from "../ChangeSummary";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockNodeData = (overrides: Partial<NodeData> = {}): NodeData => ({
  id: "model.test.test_model",
  unique_id: "model.test.test_model",
  name: "test_model",
  resource_type: "model",
  package_name: "test",
  columns: {},
  checksum: { name: "sha256", checksum: "abc123" },
  ...overrides,
});

// Helper to convert simple column definitions to proper NodeColumnData format
const toNodeColumns = (
  cols: Record<string, { type: string }>,
): Record<string, { name: string; type: string }> => {
  const result: Record<string, { name: string; type: string }> = {};
  for (const [name, col] of Object.entries(cols)) {
    result[name] = { name, type: col.type };
  }
  return result;
};

const createMockNode = (
  id: string,
  changeStatus: "added" | "removed" | "modified" | undefined,
  baseColumns: Record<string, { type: string }> = {},
  currentColumns: Record<string, { type: string }> = {},
): LineageGraphNode => ({
  id,
  type: "lineageGraphNode",
  position: { x: 0, y: 0 },
  data: {
    id,
    name: id.split(".").pop() || id,
    from:
      changeStatus === "added"
        ? "current"
        : changeStatus === "removed"
          ? "base"
          : "both",
    changeStatus,
    data: {
      base:
        changeStatus === "removed" || changeStatus === "modified"
          ? createMockNodeData({ columns: toNodeColumns(baseColumns) })
          : changeStatus === "added"
            ? undefined
            : createMockNodeData({ columns: toNodeColumns(baseColumns) }),
      current:
        changeStatus === "added" || changeStatus === "modified"
          ? createMockNodeData({ columns: toNodeColumns(currentColumns) })
          : changeStatus === "removed"
            ? undefined
            : createMockNodeData({ columns: toNodeColumns(currentColumns) }),
    },
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
      render(<ChangeSummary lineageGraph={lineageGraph} />);

      // 2 of each: one for code changes, one for column changes
      expect(screen.getAllByTestId("icon-added")).toHaveLength(2);
      expect(screen.getAllByTestId("icon-removed")).toHaveLength(2);
      expect(screen.getAllByTestId("icon-modified")).toHaveLength(2);
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
              from: "both",
              changeStatus: "modified",
              data: {
                base: createMockNodeData({ columns: undefined }),
                current: createMockNodeData({ columns: undefined }),
              },
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
