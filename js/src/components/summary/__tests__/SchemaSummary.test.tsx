/**
 * @file SchemaSummary.simplified.test.tsx
 * @description Simplified tests for SchemaSummary component focusing on rendering and basic functionality
 *
 * Tests verify:
 * - Component renders without errors
 * - Displays schema changed nodes correctly
 * - Shows "No schema changes" message appropriately
 * - Integrates with SchemaView component
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

jest.mock("@datarecce/ui/utils", () => ({
  mergeKeysWithStatus: jest.fn((baseKeys, currentKeys) => {
    const result: Record<string, "added" | "removed" | undefined> = {};
    for (const key of baseKeys) {
      if (!currentKeys.includes(key)) {
        result[key] = "removed";
      } else {
        result[key] = undefined;
      }
    }
    for (const key of currentKeys) {
      if (!baseKeys.includes(key)) {
        result[key] = "added";
      } else if (result[key] === undefined) {
        result[key] = undefined;
      }
    }
    return result;
  }),
}));

jest.mock("@datarecce/ui/components/schema", () => ({
  SchemaView: ({ base, current }: { base?: unknown; current?: unknown }) => (
    <div data-testid="schema-view">
      <span>{base ? "Has Base" : "No Base"}</span>
      <span>{current ? "Has Current" : "No Current"}</span>
    </div>
  ),
}));

jest.mock("@datarecce/ui/components/lineage", () => ({
  ResourceTypeTag: ({ data }: { data: { resourceType: string } }) => (
    <span data-testid="resource-type-tag">{data.resourceType}</span>
  ),
  RowCountDiffTag: () => <span data-testid="row-count-diff-tag">RowCount</span>,
}));

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraph, LineageGraphNode } from "@datarecce/ui";
import type { NodeData } from "@datarecce/ui/api";
import { SchemaSummary } from "@datarecce/ui/components/summary";
import { render, screen, waitFor } from "@testing-library/react";

// ============================================================================
// Test Fixtures
// ============================================================================

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

const createMockNodeData = (
  columns: Record<string, { type: string }> = {},
  overrides: Partial<NodeData> = {},
): NodeData => ({
  id: "model.test.test_model",
  unique_id: "model.test.test_model",
  name: "test_model",
  resource_type: "model",
  package_name: "test",
  columns: toNodeColumns(columns),
  checksum: { name: "sha256", checksum: "abc123" },
  ...overrides,
});

const createMockNode = (
  id: string,
  name: string,
  baseColumns: Record<string, { type: string }> | undefined,
  currentColumns: Record<string, { type: string }> | undefined,
  resourceType: "model" | "source" | "seed" | "snapshot" = "model",
): LineageGraphNode => ({
  id,
  type: "lineageGraphNode",
  position: { x: 0, y: 0 },
  data: {
    id,
    name,
    from: "both",
    changeStatus: "modified",
    data: {
      base:
        baseColumns !== undefined
          ? createMockNodeData(baseColumns, {
              id,
              unique_id: id,
              name,
              resource_type: resourceType,
            })
          : undefined,
      current:
        currentColumns !== undefined
          ? createMockNodeData(currentColumns, {
              id,
              unique_id: id,
              name,
              resource_type: resourceType,
            })
          : undefined,
    },
    resourceType,
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

describe("SchemaSummary (Simplified)", () => {
  describe("rendering", () => {
    it("renders section title", () => {
      const lineageGraph = createMockLineageGraph([]);
      render(<SchemaSummary lineageGraph={lineageGraph} />);

      expect(screen.getByText("Schema Summary")).toBeInTheDocument();
    });

    it('displays "No schema changes detected" when no changes', async () => {
      const lineageGraph = createMockLineageGraph([]);
      render(<SchemaSummary lineageGraph={lineageGraph} />);

      await waitFor(() => {
        expect(
          screen.getByText("No schema changes detected."),
        ).toBeInTheDocument();
      });
    });

    it("renders cards for nodes with schema changes", async () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode(
          "node1",
          "test_model",
          { col1: { type: "STRING" } },
          { col1: { type: "STRING" }, col2: { type: "INT" } }, // Added col2
        ),
      ]);

      render(<SchemaSummary lineageGraph={lineageGraph} />);

      await waitFor(() => {
        expect(screen.getByText("test_model")).toBeInTheDocument();
        expect(screen.getByTestId("schema-view")).toBeInTheDocument();
      });
    });
  });

  describe("schema change detection", () => {
    it("detects added columns as schema change", async () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode(
          "node1",
          "test_model",
          { col1: { type: "STRING" } },
          { col1: { type: "STRING" }, col2: { type: "INT" } },
        ),
      ]);

      render(<SchemaSummary lineageGraph={lineageGraph} />);

      await waitFor(() => {
        expect(screen.getByText("test_model")).toBeInTheDocument();
      });
    });

    it("detects removed columns as schema change", async () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode(
          "node1",
          "test_model",
          { col1: { type: "STRING" }, col2: { type: "INT" } },
          { col1: { type: "STRING" } },
        ),
      ]);

      render(<SchemaSummary lineageGraph={lineageGraph} />);

      await waitFor(() => {
        expect(screen.getByText("test_model")).toBeInTheDocument();
      });
    });

    it("filters out nodes without schema changes", async () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode(
          "node1",
          "test_model",
          { col1: { type: "STRING" } },
          { col1: { type: "STRING" } }, // Same columns
        ),
      ]);

      render(<SchemaSummary lineageGraph={lineageGraph} />);

      await waitFor(() => {
        expect(
          screen.getByText("No schema changes detected."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("integration", () => {
    it("displays ResourceTypeTag", async () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode(
          "node1",
          "test_model",
          { col1: { type: "STRING" } },
          { col1: { type: "STRING" }, col2: { type: "INT" } },
        ),
      ]);

      render(<SchemaSummary lineageGraph={lineageGraph} />);

      await waitFor(() => {
        expect(screen.getByTestId("resource-type-tag")).toBeInTheDocument();
      });
    });

    it("displays RowCountDiffTag for model resources", async () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode(
          "node1",
          "test_model",
          { col1: { type: "STRING" } },
          { col1: { type: "STRING" }, col2: { type: "INT" } },
          "model",
        ),
      ]);

      render(<SchemaSummary lineageGraph={lineageGraph} />);

      await waitFor(() => {
        expect(screen.getByTestId("row-count-diff-tag")).toBeInTheDocument();
      });
    });
  });

  describe("edge cases", () => {
    it("handles undefined columns gracefully", async () => {
      const lineageGraph: LineageGraph = {
        nodes: {
          node1: {
            id: "node1",
            type: "lineageGraphNode",
            position: { x: 0, y: 0 },
            data: {
              id: "node1",
              name: "test_model",
              from: "both",
              changeStatus: "modified",
              data: {
                base: createMockNodeData({}, { columns: undefined }),
                current: createMockNodeData({ col1: { type: "STRING" } }),
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

      render(<SchemaSummary lineageGraph={lineageGraph} />);

      await waitFor(() => {
        expect(screen.getByText("test_model")).toBeInTheDocument();
      });
    });

    it("handles empty modifiedSet", async () => {
      const lineageGraph = createMockLineageGraph([]);

      render(<SchemaSummary lineageGraph={lineageGraph} />);

      await waitFor(() => {
        expect(
          screen.getByText("No schema changes detected."),
        ).toBeInTheDocument();
      });
    });
  });
});
