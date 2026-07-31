import type { LineageGraph, LineageGraphNode } from "@datarecce/ui";
import { SchemaSummary } from "@datarecce/ui/components/summary";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@datarecce/ui/components/schema", () => ({
  SchemaView: () => <div />,
}));

// Recorded, not blanked: the card's whole job beyond the schema table is to
// wire each node into these two tags, and a bare <span /> would let that wiring
// be deleted silently.
vi.mock("@datarecce/ui/components/lineage", () => ({
  NodeTag: ({
    resourceType,
    materialized,
  }: {
    resourceType?: string;
    materialized?: string;
  }) => (
    <span
      data-testid="node-tag"
      data-resource-type={resourceType}
      data-materialized={materialized}
    />
  ),
  RowCountDiffTag: ({ node }: { node: { id: string } }) => (
    <span data-testid="row-count-diff-tag" data-node-id={node.id} />
  ),
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
  dataOverrides: Partial<LineageGraphNode["data"]> = {},
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
      ...dataOverrides,
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

  it("tags each card with the node's own resource type and materialization", async () => {
    const graph = createGraph([
      createNode(
        "model.changed",
        "changed_model",
        { new_column: "added" },
        { materialized: "incremental" },
      ),
    ]);

    render(<SchemaSummary lineageGraph={graph} />);

    const nodeTag = await screen.findByTestId("node-tag");
    expect(nodeTag).toHaveAttribute("data-resource-type", "model");
    expect(nodeTag).toHaveAttribute("data-materialized", "incremental");
  });

  it("shows the row count diff for models only", async () => {
    const graph = createGraph([
      createNode("model.changed", "changed_model", { new_column: "added" }),
      createNode(
        "seed.changed",
        "changed_seed",
        { new_column: "added" },
        { resourceType: "seed" },
      ),
    ]);

    render(<SchemaSummary lineageGraph={graph} />);

    // Both cards render; only the model one may claim a row count, because a
    // seed has no base/current row count to diff.
    await screen.findByText("changed_seed");
    const rowCountTags = screen.getAllByTestId("row-count-diff-tag");
    expect(rowCountTags).toHaveLength(1);
    expect(rowCountTags[0]).toHaveAttribute("data-node-id", "model.changed");
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
