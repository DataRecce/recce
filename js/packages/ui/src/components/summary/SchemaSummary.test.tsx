import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LineageGraph } from "../../contexts";
import { SchemaSummary } from "./SchemaSummary";

function graphWithCoverage(
  schemaCoverage: LineageGraph["schemaCoverage"],
  artifactHealth?: LineageGraph["artifactHealth"],
): LineageGraph {
  return {
    nodes: {},
    edges: {},
    modifiedSet: [],
    manifestMetadata: {},
    catalogMetadata: {},
    schemaCoverage,
    artifactHealth,
  };
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
});
