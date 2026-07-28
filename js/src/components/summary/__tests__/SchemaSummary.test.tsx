import type { LineageGraph, LineageGraphNode } from "@datarecce/ui";
import { SchemaSummary } from "@datarecce/ui/components/summary";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@datarecce/ui/components/schema", () => ({
  SchemaView: () => <div />,
}));

vi.mock("@datarecce/ui/components/lineage", () => ({
  NodeTag: () => <span />,
  RowCountDiffTag: () => <span />,
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

type ColumnChanges = Record<
  string,
  "added" | "removed" | "modified" | "unknown"
>;

function createNode(
  id: string,
  name: string,
  columnChanges?: ColumnChanges,
): LineageGraphNode {
  return {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name,
      changeStatus: "modified",
      resourceType: "model",
      packageName: "test",
      parents: {},
      children: {},
      ...(columnChanges === undefined
        ? {}
        : {
            change: {
              category: "non_breaking" as const,
              columns: columnChanges,
            },
          }),
    },
  };
}

function createGraph(
  nodes: LineageGraphNode[],
  modifiedSet = nodes.map(({ id }) => id),
): LineageGraph {
  return {
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    edges: {},
    modifiedSet,
    manifestMetadata: { base: undefined, current: undefined },
    catalogMetadata: { base: undefined, current: undefined },
  };
}

describe("SchemaSummary", () => {
  it("shows the empty state when the graph has no schema changes", () => {
    render(<SchemaSummary lineageGraph={createGraph([])} />);

    expect(screen.getByText("No schema changes detected.")).toBeInTheDocument();
  });

  it("shows only modified-set nodes with non-empty wire column changes", async () => {
    const graph = createGraph([
      createNode("model.changed", "changed_model", {
        new_column: "added",
        old_column: "removed",
      }),
      createNode("model.empty", "empty_change_model", {}),
      createNode("model.no-change-field", "no_change_field_model"),
    ]);

    render(<SchemaSummary lineageGraph={graph} />);

    expect(await screen.findByText("changed_model")).toBeInTheDocument();
    expect(screen.queryByText("empty_change_model")).not.toBeInTheDocument();
    expect(screen.queryByText("no_change_field_model")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No schema changes detected."),
    ).not.toBeInTheDocument();
  });

  it("does not show a changed node outside modifiedSet", () => {
    const changedNode = createNode("model.changed", "changed_model", {
      ambiguous_column: "unknown",
    });

    render(<SchemaSummary lineageGraph={createGraph([changedNode], [])} />);

    expect(screen.queryByText("changed_model")).not.toBeInTheDocument();
    expect(screen.getByText("No schema changes detected.")).toBeInTheDocument();
  });
});
