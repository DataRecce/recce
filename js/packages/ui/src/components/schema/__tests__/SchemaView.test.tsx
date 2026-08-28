/**
 * @file SchemaView.test.tsx
 * @description Wiring tests for the schema-diff view's inline-profile controls:
 * the "Profile all columns" button gate, the unsupported banner, and the
 * node-scoped opt-in reset. The pure scope decision is covered in
 * selectInlineProfileScope.test.ts; this pins how SchemaView wires it up.
 *
 * Nodes are given empty `columns` so the grid (ag-grid) never renders — the
 * button and banner sit above it and render regardless, so we can exercise the
 * wiring without standing up the full grid.
 */

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeData } from "../../../api";
import { theme } from "../../../theme";
import { SchemaView } from "../SchemaView";

const { flags, distribution, lineageGraph, lineageViewContext } = vi.hoisted(
  () => ({
    flags: {
      current: { new_cll_experience: true, inline_profile: true } as Record<
        string,
        boolean
      >,
    },
    distribution: { current: {} as Record<string, unknown> },
    lineageGraph: {
      current: {
        nodes: {},
        catalogMetadata: { base: {}, current: {} },
        schemaCoverage: {
          status: "complete",
          unchecked_nodes: [],
          unchecked_node_count: 0,
          more: false,
        },
      } as unknown,
    },
    lineageViewContext: {
      current: {
        impactedColumnIds: new Set<string>(),
        wholeModelChangedNodeIds: new Set<string>(),
        viewOptions: {},
        showColumnLevelLineage: vi.fn(),
      } as unknown,
    },
  }),
);

vi.mock("../../../contexts", () => ({
  useRecceServerFlag: () => ({ data: flags.current }),
  useLineageViewContext: () => lineageViewContext.current,
  useLineageGraphContext: () => ({
    lineageGraph: lineageGraph.current,
    isActionAvailable: () => true,
  }),
}));

vi.mock("../../../hooks/useInlineProfileDistribution", () => ({
  useInlineProfileDistribution: () => distribution.current,
}));

vi.mock("ag-grid-react", () => ({
  AgGridReact: ({ rowData = [] }: { rowData?: Array<{ name: string }> }) => (
    <div>
      {rowData.map((row) => (
        <span key={row.name}>{row.name}</span>
      ))}
    </div>
  ),
}));

const model = (id: string): NodeData =>
  ({
    id,
    name: id.split(".").pop(),
    resource_type: "model",
    columns: {},
  }) as NodeData;

const wrap = (node: NodeData) => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <SchemaView base={node} current={node} />
  </ThemeProvider>
);

const BUTTON = { name: "Profile all columns" } as const;

beforeEach(() => {
  flags.current = { new_cll_experience: true, inline_profile: true };
  distribution.current = {
    status: "disabled",
    columns: {},
    baseTotal: 0,
    currentTotal: 0,
    unsupportedReason: undefined,
    error: undefined,
    isLoading: false,
  };
  lineageGraph.current = {
    nodes: {},
    catalogMetadata: { base: {}, current: {} },
    schemaCoverage: {
      status: "complete",
      unchecked_nodes: [],
      unchecked_node_count: 0,
      more: false,
    },
  };
});

describe("SchemaView comparison coverage", () => {
  it("labels an unchecked current-side comparison and renders no removed row", () => {
    const nodeId = "model.shop.orders";
    const base = {
      ...model(nodeId),
      columns: {
        id: { name: "id", type: "INT" },
        legacy: { name: "legacy", type: "VARCHAR" },
      },
    };
    const current = {
      ...model(nodeId),
      columns: { id: { name: "id", type: "INT" } },
    };
    lineageGraph.current = {
      nodes: {
        [nodeId]: {
          data: { schemaComparisonStatus: "unchecked" },
        },
      },
      catalogMetadata: { base: {}, current: {} },
      artifactHealth: {
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
          missing_nodes: [nodeId],
          missing_more: false,
          orphan_node_count: 0,
          orphan_nodes: [],
          orphan_more: false,
        },
      },
      schemaCoverage: {
        status: "partial",
        unchecked_nodes: [nodeId],
        unchecked_node_count: 1,
        more: false,
      },
    };

    // Render explicit base/current evidence rather than the helper's identical pair.
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SchemaView base={base as NodeData} current={current as NodeData} />
      </ThemeProvider>,
    );

    const warning = screen.getByRole("alert", {
      name: "Incomplete schema comparison",
    });
    expect(warning).toHaveTextContent("current environment");
    expect(warning).toHaveTextContent("1 node was not checked");
    expect(warning).toHaveTextContent("Regenerate the current catalog");
    expect(warning).toHaveTextContent("dbt docs generate");
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.queryByText("legacy")).not.toBeInTheDocument();
  });

  it("renders no comparison warning for complete healthy evidence", () => {
    const nodeId = "model.shop.orders";
    lineageGraph.current = {
      nodes: {
        [nodeId]: { data: { schemaComparisonStatus: "complete" } },
      },
      catalogMetadata: { base: {}, current: {} },
      schemaCoverage: {
        status: "complete",
        unchecked_nodes: [],
        unchecked_node_count: 0,
        more: false,
      },
    };

    render(wrap(model(nodeId)));

    expect(
      screen.queryByRole("alert", { name: "Incomplete schema comparison" }),
    ).not.toBeInTheDocument();
  });
});

describe("SchemaView inline-profile wiring", () => {
  it("shows the 'Profile all columns' button when both flags are on for a model node", () => {
    render(wrap(model("model.shop.orders")));
    expect(screen.getByRole("button", BUTTON)).toBeInTheDocument();
  });

  it("hides the button when new_cll_experience is off", () => {
    flags.current = { new_cll_experience: false, inline_profile: true };
    render(wrap(model("model.shop.orders")));
    expect(screen.queryByRole("button", BUTTON)).not.toBeInTheDocument();
  });

  it("hides the button when inline_profile is off", () => {
    flags.current = { new_cll_experience: true, inline_profile: false };
    render(wrap(model("model.shop.orders")));
    expect(screen.queryByRole("button", BUTTON)).not.toBeInTheDocument();
  });

  it("renders the unsupported banner when the run is unsupported", () => {
    distribution.current = {
      ...distribution.current,
      status: "unsupported",
      unsupportedReason: "Adapter 'snowflake' lacks APPROX_PERCENTILE.",
    };
    render(wrap(model("model.shop.orders")));
    expect(
      screen.getByTestId("profile-distribution-unsupported-banner"),
    ).toBeInTheDocument();
  });

  it("clears the all-columns opt-in when navigating to a different node", async () => {
    const user = userEvent.setup();
    distribution.current = { ...distribution.current, status: "ok" };
    const { rerender } = render(wrap(model("model.shop.orders")));

    // Opt in → the button hides (the run now covers every column).
    await user.click(screen.getByRole("button", BUTTON));
    expect(screen.queryByRole("button", BUTTON)).not.toBeInTheDocument();

    // Navigate to a different node → the opt-in must NOT carry over; the
    // changed-columns default is restored, so the button returns.
    rerender(wrap(model("model.shop.customers")));
    expect(screen.getByRole("button", BUTTON)).toBeInTheDocument();
  });
});
