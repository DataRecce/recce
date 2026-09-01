import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LineageGraph } from "../../contexts";
import { SchemaSummary } from "./SchemaSummary";

vi.mock("../../hooks", () => ({
  useApiConfig: () => ({ apiClient: undefined }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
}));
// The card's children pull in lineage/instance contexts this suite does not
// stand up. Stubbed so the assertions stay on what the summary itself decides
// to render.
vi.mock("../lineage", () => ({
  NodeTag: () => null,
  RowCountDiffTag: () => null,
}));
vi.mock("../schema", () => ({ SchemaView: () => null }));

function graphWithCoverage(
  schemaCoverage: LineageGraph["schemaCoverage"],
  artifactHealth?: LineageGraph["artifactHealth"],
  overrides?: Partial<LineageGraph>,
): LineageGraph {
  return {
    nodes: {},
    edges: {},
    modifiedSet: [],
    manifestMetadata: {},
    catalogMetadata: {},
    schemaCoverage,
    artifactHealth,
    ...overrides,
  };
}

function health(status: string) {
  return {
    status,
    expected_count: 1,
    covered_count: status === "complete" ? 1 : 0,
    catalog_entry_count: status === "complete" ? 1 : 0,
    missing_node_count: status === "complete" ? 0 : 1,
    missing_nodes: status === "complete" ? [] : ["model.shop.orders"],
    missing_more: false,
    orphan_node_count: 0,
    orphan_nodes: [],
    orphan_more: false,
  } as NonNullable<LineageGraph["artifactHealth"]>["base"];
}

/** A model with a verified column change, so a card must render for it. */
function graphWithAVerifiedChange(
  schemaCoverage: LineageGraph["schemaCoverage"],
  artifactHealth?: LineageGraph["artifactHealth"],
): LineageGraph {
  const nodeId = "model.shop.verified";
  const node = {
    id: nodeId,
    position: { x: 0, y: 0 },
    data: {
      id: nodeId,
      name: "verified",
      resourceType: "model",
      packageName: "shop",
      changeStatus: "modified",
      change: { columns: { amount: { changeStatus: "modified" } } },
      children: {},
      parents: {},
    },
  } as unknown as LineageGraph["nodes"][string];
  return graphWithCoverage(schemaCoverage, artifactHealth, {
    modifiedSet: [nodeId],
    nodes: { [nodeId]: node },
  });
}

describe("SchemaSummary comparison coverage", () => {
  it("reports an incomplete comparison instead of claiming no changes", () => {
    render(
      <SchemaSummary
        lineageGraph={graphWithCoverage(
          {
            status: "partial",
            unchecked_nodes: ["model.shop.orders", "model.shop.customers"],
            unchecked_node_count: 3,
            more: true,
          },
          {
            base: {
              status: "complete",
              expected_count: 1,
              covered_count: 1,
              catalog_entry_count: 1,
              missing_node_count: 0,
              missing_nodes: [],
              missing_more: false,
              orphan_node_count: 0,
              orphan_nodes: [],
              orphan_more: false,
            },
            current: {
              status: "partial",
              expected_count: 1,
              covered_count: 0,
              catalog_entry_count: 0,
              missing_node_count: 1,
              missing_nodes: ["model.shop.orders"],
              missing_more: false,
              orphan_node_count: 0,
              orphan_nodes: [],
              orphan_more: false,
            },
          },
        )}
      />,
    );

    const warning = screen.getByRole("alert", {
      name: "Incomplete schema comparison",
    });
    expect(warning).toHaveTextContent("Schema comparison incomplete");
    expect(warning).toHaveTextContent("3 nodes were not checked");
    expect(warning).toHaveTextContent("model.shop.orders");
    expect(warning).toHaveTextContent("model.shop.customers");
    expect(warning).toHaveTextContent("and 1 more");
    expect(warning).toHaveTextContent("Regenerate the current catalog");
    expect(warning).toHaveTextContent("dbt docs generate");
    expect(
      screen.queryByText("No schema changes detected."),
    ).not.toBeInTheDocument();
  });

  it("keeps the healthy no-change result free of warnings", () => {
    render(
      <SchemaSummary
        lineageGraph={graphWithCoverage({
          status: "complete",
          unchecked_nodes: [],
          unchecked_node_count: 0,
          more: false,
        })}
      />,
    );

    expect(screen.getByText("No schema changes detected.")).toBeInTheDocument();
    expect(
      screen.queryByRole("alert", { name: "Incomplete schema comparison" }),
    ).not.toBeInTheDocument();
  });

  it("keeps verified change cards visible while the comparison is partial", () => {
    // AC3/AC5: partial coverage must narrow the answer, not erase it. Warning
    // and verified evidence have to coexist, or "fail closed" degenerates into
    // suppressing every finding.
    render(
      <SchemaSummary
        lineageGraph={graphWithAVerifiedChange(
          {
            status: "partial",
            unchecked_nodes: ["model.shop.orders"],
            unchecked_node_count: 1,
            more: false,
          },
          { base: health("complete"), current: health("partial") },
        )}
      />,
    );

    expect(
      screen.getByRole("alert", { name: "Incomplete schema comparison" }),
    ).toBeInTheDocument();
    expect(screen.getByText("verified")).toBeInTheDocument();
    expect(
      screen.queryByText("No schema changes detected."),
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      "base",
      health("partial"),
      health("complete"),
      "Regenerate the base catalog",
    ],
    [
      "current",
      health("complete"),
      health("partial"),
      "Regenerate the current catalog",
    ],
    [
      "both",
      health("partial"),
      health("empty"),
      "Regenerate the base and current catalogs",
    ],
  ])(
    "names the %s side in the remediation",
    (_side, base, current, expected) => {
      // AC2: base-only, current-only and both-side degradation each get their
      // own remediation. Telling a reviewer to regenerate the wrong catalog is
      // a dead end.
      render(
        <SchemaSummary
          lineageGraph={graphWithCoverage(
            {
              status: "partial",
              unchecked_nodes: ["model.shop.orders"],
              unchecked_node_count: 1,
              more: false,
            },
            { base, current },
          )}
        />,
      );

      expect(
        screen.getByRole("alert", { name: "Incomplete schema comparison" }),
      ).toHaveTextContent(expected);
    },
  );

  it.each([
    ["an absent coverage block", undefined],
    [
      "an explicit unknown status",
      {
        status: "unknown" as const,
        unchecked_nodes: [],
        unchecked_node_count: 0,
        more: false,
      },
    ],
  ])("warns rather than claiming no changes for %s", (_case, coverage) => {
    // AC8: unknown must never read as healthy. A legacy server sends no
    // schema_coverage at all, which normalizes to "unknown" — the gate has to
    // treat that like partial, not like complete.
    render(
      <SchemaSummary
        lineageGraph={graphWithCoverage(
          coverage as LineageGraph["schemaCoverage"],
        )}
      />,
    );

    expect(
      screen.getByRole("alert", { name: "Incomplete schema comparison" }),
    ).toHaveTextContent("The number of unchecked nodes is unknown.");
    expect(
      screen.queryByText("No schema changes detected."),
    ).not.toBeInTheDocument();
  });
});
