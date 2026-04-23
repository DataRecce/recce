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

import { vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("@datarecce/ui", async () => {
  const actual = await vi.importActual("@datarecce/ui");
  return {
    ...(actual as Record<string, unknown>),
  };
});

vi.mock("@datarecce/ui/api", async () => {
  const actual = await vi.importActual("@datarecce/ui/api");
  return {
    ...(actual as Record<string, unknown>),
  };
});

vi.mock("@datarecce/ui/utils", () => ({
  mergeKeysWithStatus: vi.fn((baseKeys, currentKeys) => {
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

vi.mock("@datarecce/ui/components/schema", () => ({
  SchemaView: ({ base, current }: { base?: unknown; current?: unknown }) => (
    <div data-testid="schema-view">
      <span>{base ? "Has Base" : "No Base"}</span>
      <span>{current ? "Has Current" : "No Current"}</span>
    </div>
  ),
}));

vi.mock("@datarecce/ui/components/lineage", () => ({
  NodeTag: ({ resourceType }: { resourceType: string }) => (
    <span>{resourceType}</span>
  ),
  RowCountDiffTag: () => <span data-testid="row-count-diff-tag">RowCount</span>,
}));

vi.mock("@datarecce/ui/hooks", () => ({
  useApiConfig: vi.fn(() => ({ apiClient: { get: vi.fn() } })),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
  };
});

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraph, LineageGraphNode } from "@datarecce/ui";
import { SchemaSummary } from "@datarecce/ui/components/summary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Compute a simple column diff to populate node.data.change.columns
 */
function computeColumnChanges(
  baseColumns: Record<string, { type: string }> | undefined,
  currentColumns: Record<string, { type: string }> | undefined,
): Record<string, "added" | "removed" | "modified"> | null {
  if (!baseColumns && !currentColumns) return null;
  const base = baseColumns ?? {};
  const current = currentColumns ?? {};
  const changes: Record<string, "added" | "removed" | "modified"> = {};
  for (const col of Object.keys(current)) {
    if (!(col in base)) changes[col] = "added";
    else if (base[col].type !== current[col].type) changes[col] = "modified";
  }
  for (const col of Object.keys(base)) {
    if (!(col in current)) changes[col] = "removed";
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

const createMockNode = (
  id: string,
  name: string,
  baseColumns: Record<string, { type: string }> | undefined,
  currentColumns: Record<string, { type: string }> | undefined,
  resourceType: "model" | "source" | "seed" | "snapshot" = "model",
): LineageGraphNode => {
  const columnChanges = computeColumnChanges(baseColumns, currentColumns);
  return {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name,
      changeStatus: "modified",
      resourceType,
      packageName: "test",
      parents: {},
      children: {},
      ...(columnChanges
        ? {
            change: {
              category: "non_breaking" as const,
              columns: columnChanges,
            },
          }
        : {}),
    },
  };
};

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
      render(<SchemaSummary lineageGraph={lineageGraph} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByText("Schema Summary")).toBeInTheDocument();
    });

    it('displays "No schema changes detected" when no changes', async () => {
      const lineageGraph = createMockLineageGraph([]);
      render(<SchemaSummary lineageGraph={lineageGraph} />, {
        wrapper: Wrapper,
      });

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

      render(<SchemaSummary lineageGraph={lineageGraph} />, {
        wrapper: Wrapper,
      });

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

      render(<SchemaSummary lineageGraph={lineageGraph} />, {
        wrapper: Wrapper,
      });

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

      render(<SchemaSummary lineageGraph={lineageGraph} />, {
        wrapper: Wrapper,
      });

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

      render(<SchemaSummary lineageGraph={lineageGraph} />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(
          screen.getByText("No schema changes detected."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("integration", () => {
    it("displays NodeTag with resource type", async () => {
      const lineageGraph = createMockLineageGraph([
        createMockNode(
          "node1",
          "test_model",
          { col1: { type: "STRING" } },
          { col1: { type: "STRING" }, col2: { type: "INT" } },
        ),
      ]);

      render(<SchemaSummary lineageGraph={lineageGraph} />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(screen.getByText("model")).toBeInTheDocument();
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

      render(<SchemaSummary lineageGraph={lineageGraph} />, {
        wrapper: Wrapper,
      });

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

      render(<SchemaSummary lineageGraph={lineageGraph} />, {
        wrapper: Wrapper,
      });

      // Without change.columns, the node is not considered a schema change
      await waitFor(() => {
        expect(
          screen.getByText("No schema changes detected."),
        ).toBeInTheDocument();
      });
    });

    it("handles empty modifiedSet", async () => {
      const lineageGraph = createMockLineageGraph([]);

      render(<SchemaSummary lineageGraph={lineageGraph} />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(
          screen.getByText("No schema changes detected."),
        ).toBeInTheDocument();
      });
    });
  });
});
