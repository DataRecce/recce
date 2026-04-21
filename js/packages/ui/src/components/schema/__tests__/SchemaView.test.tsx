/**
 * @file SchemaView.test.tsx
 * @description Component tests for PrivateSchemaView inline-profile gating.
 */

import { vi } from "vitest";

// Mock ag-grid-community (ESM parsing)
vi.mock("ag-grid-community", () => ({
  themeQuartz: { withParams: vi.fn(() => "mocked-theme") },
  AllCommunityModule: {},
  ModuleRegistry: { registerModules: vi.fn() },
}));

// Mock the schemaCells module to avoid JSX in generator
vi.mock("../../ui/dataGrid/schemaCells", () => ({
  createSchemaColumnNameRenderer: vi.fn(() => vi.fn()),
  createSingleEnvColumnNameRenderer: vi.fn(() => vi.fn()),
  renderIndexCell: vi.fn(),
}));

// Mock the ScreenshotDataGrid primitive — we inspect props, not DOM
const mockScreenshotDataGrid = vi.fn((_props: unknown) => null);
vi.mock("../../../primitives", () => ({
  ScreenshotDataGrid: (props: unknown) => mockScreenshotDataGrid(props),
  EmptyRowsRenderer: () => null,
}));

// Mock useRecceServerFlag and lineage contexts
const mockUseRecceServerFlag = vi.fn();
const mockUseLineageViewContext = vi.fn();
const mockUseLineageGraphContext = vi.fn();
vi.mock("../../../contexts", () => ({
  useRecceServerFlag: () => mockUseRecceServerFlag(),
  useLineageViewContext: () => mockUseLineageViewContext(),
  useLineageGraphContext: () => mockUseLineageGraphContext(),
}));

// Mock the inline profile hook
const mockUseInlineProfile = vi.fn();
vi.mock("../../../hooks", () => ({
  useInlineProfile: (args: unknown) => mockUseInlineProfile(args),
}));

// Stub trackColumnLevelLineage
vi.mock("../../../lib/api/track", () => ({
  trackColumnLevelLineage: vi.fn(),
}));

import { render } from "@testing-library/react";
import { createRef } from "react";
import type { DataGridHandle } from "../../../primitives";
import { SchemaView } from "../SchemaView";

function baseNode() {
  return {
    id: "model.jaffle.orders",
    name: "orders",
    resource_type: "model",
    columns: {
      status: { type: "text", name: "status", index: 0 },
      amount: { type: "number", name: "amount", index: 1 },
    },
  } as unknown as Parameters<typeof SchemaView>[0]["current"];
}

function setup(overrides: {
  inlineProfile?: boolean;
  newCll?: boolean;
  impactedColumnIds?: Set<string>;
  profileByColumn?: Map<string, unknown>;
  isLoading?: boolean;
  error?: unknown;
}) {
  mockUseRecceServerFlag.mockReturnValue({
    data: {
      new_cll_experience: overrides.newCll ?? true,
      inline_profile: overrides.inlineProfile ?? true,
    },
  });
  mockUseLineageViewContext.mockReturnValue({
    viewOptions: { column_level_lineage: undefined },
    impactedColumnIds: overrides.impactedColumnIds ?? new Set<string>(),
    showColumnLevelLineage: vi.fn(),
  });
  mockUseLineageGraphContext.mockReturnValue({
    lineageGraph: { catalogMetadata: { base: {}, current: {} } },
    isActionAvailable: () => true,
  });
  mockUseInlineProfile.mockReturnValue({
    profileByColumn: overrides.profileByColumn ?? new Map(),
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
  });
}

describe("PrivateSchemaView inline profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScreenshotDataGrid.mockClear();
  });

  it("does not call useInlineProfile when inline_profile flag is off", () => {
    setup({ inlineProfile: false });
    render(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={baseNode()}
        current={baseNode()}
      />,
    );
    expect(mockUseInlineProfile).toHaveBeenCalled();
    const args = mockUseInlineProfile.mock.calls[0][0];
    expect(args.enabled).toBe(false);
  });

  it("does not call useInlineProfile when new_cll_experience flag is off", () => {
    setup({ newCll: false });
    render(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={baseNode()}
        current={baseNode()}
      />,
    );
    const args = mockUseInlineProfile.mock.calls[0][0];
    expect(args.enabled).toBe(false);
  });

  it("calls useInlineProfile with impacted columns when both flags are on", () => {
    setup({
      impactedColumnIds: new Set(["model.jaffle.orders_status"]),
    });
    render(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={baseNode()}
        current={baseNode()}
      />,
    );
    const args = mockUseInlineProfile.mock.calls.at(-1)?.[0];
    expect(args.enabled).toBe(true);
    expect(args.modelName).toBe("orders");
    expect(args.columns).toEqual(["status"]);
  });

  it("does not enable the hook when the impacted-column set is empty", () => {
    setup({ impactedColumnIds: new Set() });
    render(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={baseNode()}
        current={baseNode()}
      />,
    );
    const args = mockUseInlineProfile.mock.calls.at(-1)?.[0];
    expect(args.enabled).toBe(false);
  });

  it("passes profileByColumn from the hook through to the grid", () => {
    const profile = new Map<string, unknown>([
      ["status", { base: {}, current: {} }],
    ]);
    setup({
      impactedColumnIds: new Set(["model.jaffle.orders_status"]),
      profileByColumn: profile,
    });
    render(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={baseNode()}
        current={baseNode()}
      />,
    );
    const lastCall = mockScreenshotDataGrid.mock.calls.at(-1);
    const gridProps = (lastCall ? lastCall[0] : undefined) as unknown as {
      columns: unknown[];
    };
    const fields = (gridProps.columns as { field?: string }[])
      .map((c) => c.field)
      .filter(Boolean);
    expect(fields).toContain("not_null_proportion");
    expect(fields).toContain("is_unique");
  });
});

describe("PrivateSchemaView expand button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScreenshotDataGrid.mockClear();
  });

  it("renders 'Profile all columns' when impacted set is empty", async () => {
    setup({ impactedColumnIds: new Set() });
    const { findByRole } = render(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={baseNode()}
        current={baseNode()}
      />,
    );
    const btn = await findByRole("button", { name: /profile all columns/i });
    expect(btn).toBeInTheDocument();
  });

  it("renders 'Profile remaining columns' when impacted set is populated", async () => {
    setup({
      impactedColumnIds: new Set(["model.jaffle.orders_status"]),
      profileByColumn: new Map([["status", { current: {} }]]),
    });
    const { findByRole } = render(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={baseNode()}
        current={baseNode()}
      />,
    );
    const btn = await findByRole("button", {
      name: /profile remaining columns/i,
    });
    expect(btn).toBeInTheDocument();
  });

  it("hides the button when every profilable column is already covered", () => {
    setup({
      impactedColumnIds: new Set([
        "model.jaffle.orders_status",
        "model.jaffle.orders_amount",
      ]),
      profileByColumn: new Map([
        ["status", { current: {} }],
        ["amount", { current: {} }],
      ]),
    });
    const { queryByRole } = render(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={baseNode()}
        current={baseNode()}
      />,
    );
    expect(
      queryByRole("button", { name: /profile (all|remaining) columns/i }),
    ).toBeNull();
  });

  it("clicking the button re-calls useInlineProfile with all columns", async () => {
    setup({
      impactedColumnIds: new Set(["model.jaffle.orders_status"]),
      profileByColumn: new Map([["status", { current: {} }]]),
    });
    const user = (await import("@testing-library/user-event")).default.setup();
    const { findByRole } = render(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={baseNode()}
        current={baseNode()}
      />,
    );
    const btn = await findByRole("button", {
      name: /profile remaining columns/i,
    });
    await user.click(btn);
    // Last call should now request both columns
    const lastArgs = mockUseInlineProfile.mock.calls.at(-1)?.[0];
    expect(lastArgs.columns).toEqual(
      expect.arrayContaining(["status", "amount"]),
    );
  });

  it("resets expand state when navigating to a different model", async () => {
    setup({
      // Impacted set contains "status" for both models, so after reset the
      // default scope is [status] (not empty).
      impactedColumnIds: new Set([
        "model.jaffle.orders_status",
        "model.jaffle.customers_status",
      ]),
      profileByColumn: new Map([["status", { current: {} }]]),
    });
    const user = (await import("@testing-library/user-event")).default.setup();
    const { findByRole, rerender } = render(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={baseNode()}
        current={baseNode()}
      />,
    );
    // Expand on model A
    const btn = await findByRole("button", {
      name: /profile remaining columns/i,
    });
    await user.click(btn);
    expect(mockUseInlineProfile.mock.calls.at(-1)?.[0].columns).toEqual(
      expect.arrayContaining(["status", "amount"]),
    );

    // Rerender with a different model — should fall back to impacted-only
    const otherNode = {
      id: "model.jaffle.customers",
      name: "customers",
      resource_type: "model",
      columns: {
        status: { type: "text", name: "status", index: 0 },
        amount: { type: "number", name: "amount", index: 1 },
      },
    } as unknown as Parameters<typeof SchemaView>[0]["current"];
    rerender(
      <SchemaView
        ref={createRef<DataGridHandle>()}
        base={otherNode}
        current={otherNode}
      />,
    );
    const lastArgs = mockUseInlineProfile.mock.calls.at(-1)?.[0];
    expect(lastArgs.columns).toEqual(["status"]);
  });
});
