import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockRunAction } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRunAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: () => ({ data: undefined }) };
});

vi.mock("../../../contexts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../contexts")>();
  return {
    ...actual,
    useLineageGraphContext: () => ({
      isActionAvailable: () => true,
      envInfo: { adapterType: "dbt" },
      lineageGraph: { nodes: [] },
      runsAggregated: undefined,
    }),
    useLineageViewContext: () => undefined,
    useRecceActionContext: () => ({ runAction: mockRunAction }),
    useRecceInstanceContext: () => ({
      singleEnv: false,
      featureToggles: { disableDatabaseQuery: false },
    }),
    useRouteConfig: () => ({ basePath: "" }),
  };
});

vi.mock("../../../hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../hooks")>();
  return {
    ...actual,
    useApiConfig: () => ({ apiClient: {} }),
    useModelColumns: () => ({ primaryKey: undefined }),
    useRecceQueryContext: () => ({
      setSqlQuery: vi.fn(),
      setPrimaryKeys: vi.fn(),
    }),
  };
});

vi.mock("../../../lib/api/track", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../lib/api/track")>();
  return { ...actual, trackExploreAction: vi.fn() };
});

vi.mock("../NodeView", () => ({
  NodeView: ({
    actionCallbacks,
  }: {
    actionCallbacks: { onHistogramDiffClick?: () => void };
  }) => (
    <button type="button" onClick={actionCallbacks.onHistogramDiffClick}>
      Histogram
    </button>
  ),
}));

import { NodeViewOss } from "../NodeViewOss";

describe("NodeViewOss Histogram launcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opts the model picker into one-step submission and model telemetry", async () => {
    render(
      <NodeViewOss
        node={
          {
            id: "model.test.orders",
            data: { name: "orders", resourceType: "model" },
          } as never
        }
        onCloseNode={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Histogram" }));

    expect(mockRunAction).toHaveBeenCalledWith(
      "histogram_diff",
      { model: "orders", column_name: "", column_type: "" },
      {
        showForm: true,
        submitOnSelection: true,
        trackProps: { source: "lineage_model_node" },
      },
    );
  });
});
