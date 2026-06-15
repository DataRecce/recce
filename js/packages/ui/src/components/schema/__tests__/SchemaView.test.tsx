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
import { SchemaLegend, SchemaView } from "../SchemaView";

const { flags, distribution, lineageViewContext } = vi.hoisted(() => ({
  flags: {
    current: { new_cll_experience: true, inline_profile: true } as Record<
      string,
      boolean
    >,
  },
  // biome-ignore lint/suspicious/noExplicitAny: minimal hook-return stub
  distribution: { current: {} as any },
  lineageViewContext: {
    current: {
      impactedColumnIds: new Set<string>(),
      wholeModelChangedNodeIds: new Set<string>(),
      viewOptions: {},
      showColumnLevelLineage: vi.fn(),
    } as unknown,
  },
}));

vi.mock("../../../contexts", () => ({
  useRecceServerFlag: () => ({ data: flags.current }),
  useLineageViewContext: () => lineageViewContext.current,
  useLineageGraphContext: () => ({
    lineageGraph: { catalogMetadata: { base: {}, current: {} } },
    isActionAvailable: () => true,
  }),
}));

vi.mock("../../../hooks/useInlineProfileDistribution", () => ({
  useInlineProfileDistribution: () => distribution.current,
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

const wrapLegend = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <SchemaLegend />
  </ThemeProvider>
);

describe("SchemaLegend", () => {
  it("always shows the added / removed / changed entries", () => {
    render(wrapLegend());
    expect(screen.getByText("added")).toBeInTheDocument();
    expect(screen.getByText("removed")).toBeInTheDocument();
    expect(screen.getByText("changed")).toBeInTheDocument();
  });

  it("documents the whole-model and additive badges when new_cll_experience is on", () => {
    flags.current = { new_cll_experience: true };
    render(wrapLegend());
    expect(screen.getByLabelText("whole-model")).toHaveTextContent("ALL");
    expect(screen.getByLabelText("additive change")).toHaveTextContent("ADD");
    expect(
      screen.getByText(/every row in this model can be affected/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/adds a column; existing rows unchanged/),
    ).toBeInTheDocument();
  });

  it("hides the whole-model and additive badges when new_cll_experience is off", () => {
    flags.current = { new_cll_experience: false };
    render(wrapLegend());
    expect(screen.queryByLabelText("whole-model")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("additive change")).not.toBeInTheDocument();
  });
});
