/**
 * @file SchemaDiffView.test.tsx
 * @description Regression test for DRC-4197. `/api/models/` does not return
 * `resource_type`, so the schema-diff check view has to graft it on from the
 * lineage node before handing `base`/`current` to `SchemaView`. Without it
 * `SchemaView`'s `profileNode` is undefined, `toSchemaDataGrid` drops the name
 * cell renderer, and the grid paints the raw valueGetter string
 * (`order_id|false|false|false`) instead of the column name.
 *
 * Both arms are asserted: an added node arrives with `base = {}` and a removed
 * node with `current = {}`, so a fix applied to only one arm still regresses.
 */

import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { Check } from "../../../api";
import type { LineageGraph, LineageGraphNode } from "../../../contexts";
import { SchemaDiffView } from "../SchemaDiffView";

// Recorded, not blanked: the whole point of this view is which `resource_type`
// reaches `SchemaView`, so the mock reports it back as data attributes.
vi.mock("../../schema", () => ({
  SchemaView: ({
    base,
    current,
  }: {
    base?: { resource_type?: string };
    current?: { resource_type?: string };
  }) => (
    <span
      data-testid="schema-view"
      data-base-resource-type={base?.resource_type}
      data-current-resource-type={current?.resource_type}
    />
  ),
}));

vi.mock("../../..", () => ({
  getModelInfo: vi.fn(),
  HSplit: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="hsplit">{children}</div>
  ),
}));

vi.mock("../../../api", () => ({
  cacheKeys: { check: (checkId: string) => ["check", checkId] },
  select: vi.fn(),
}));

vi.mock("../../../hooks", () => ({
  useApiConfig: vi.fn(() => ({ apiClient: { get: vi.fn() } })),
  useIsDark: vi.fn(() => false),
}));

vi.mock("../../lineage", () => ({
  getIconForChangeStatus: vi.fn(() => ({ icon: undefined, color: undefined })),
  getIconForResourceType: vi.fn(() => ({ icon: undefined })),
}));

vi.mock("../../run", () => ({
  findByRunType: vi.fn(() => ({ icon: undefined })),
}));

const mockLineageGraph = vi.fn<() => LineageGraph | undefined>();

vi.mock("../../../contexts", () => ({
  useLineageGraphContext: () => ({ lineageGraph: mockLineageGraph() }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: vi.fn() };
});

const NODE_ID = "snapshot.jaffle_shop.orders_snapshot";

function createNode(): LineageGraphNode {
  return {
    id: NODE_ID,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id: NODE_ID,
      name: "orders_snapshot",
      changeStatus: "modified",
      // Deliberately not "model": the assertion then proves the value is read
      // off the node rather than defaulted somewhere downstream.
      resourceType: "snapshot",
      packageName: "jaffle_shop",
      parents: {},
      children: {},
      change: {
        category: "non_breaking",
        columns: { order_id: "modified" },
      },
    },
  };
}

function createGraph(node: LineageGraphNode): LineageGraph {
  return {
    nodes: { [node.id]: node },
    edges: {},
    modifiedSet: [node.id],
    manifestMetadata: { base: undefined, current: undefined },
    catalogMetadata: { base: undefined, current: undefined },
  };
}

const check: Check = {
  check_id: "check-1",
  name: "Schema Diff",
  type: "schema_diff",
  params: { node_id: NODE_ID },
};

/**
 * The view issues two queries: the `select` query for the node list (unused
 * here — `params.node_id` pins the node) and the `modelDetail` query whose
 * payload stands in for `/api/models/`.
 */
function mockQueries(model: Record<string, unknown>) {
  vi.mocked(useQuery).mockImplementation(
    (options: { queryKey?: readonly unknown[] }) => {
      if (options.queryKey?.[0] === "modelDetail") {
        return { data: { model }, isLoading: false } as unknown as ReturnType<
          typeof useQuery
        >;
      }
      return {
        data: undefined,
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useQuery>;
    },
  );
}

describe("SchemaDiffView", () => {
  beforeEach(() => {
    mockLineageGraph.mockReturnValue(createGraph(createNode()));
  });

  it("gives SchemaView the node's resource type, which the model detail response lacks", async () => {
    mockQueries({
      base: { columns: { order_id: { name: "order_id", type: "INT" } } },
      current: { columns: { order_id: { name: "order_id", type: "TEXT" } } },
    });

    render(<SchemaDiffView check={check} />);

    const schemaView = await screen.findByTestId("schema-view");
    expect(schemaView).toHaveAttribute("data-base-resource-type", "snapshot");
    expect(schemaView).toHaveAttribute(
      "data-current-resource-type",
      "snapshot",
    );
  });

  it("still gives the current arm a resource type when the node was added (empty base)", async () => {
    mockQueries({
      base: {},
      current: { columns: { order_id: { name: "order_id", type: "TEXT" } } },
    });

    render(<SchemaDiffView check={check} />);

    const schemaView = await screen.findByTestId("schema-view");
    expect(schemaView).not.toHaveAttribute("data-base-resource-type");
    expect(schemaView).toHaveAttribute(
      "data-current-resource-type",
      "snapshot",
    );
  });

  it("still gives the base arm a resource type when the node was removed (empty current)", async () => {
    mockQueries({
      base: { columns: { order_id: { name: "order_id", type: "INT" } } },
      current: {},
    });

    render(<SchemaDiffView check={check} />);

    const schemaView = await screen.findByTestId("schema-view");
    expect(schemaView).toHaveAttribute("data-base-resource-type", "snapshot");
    expect(schemaView).not.toHaveAttribute("data-current-resource-type");
  });
});
