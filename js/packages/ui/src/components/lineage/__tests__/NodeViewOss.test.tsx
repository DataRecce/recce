import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPush,
  mockRunAction,
  mockShowRunId,
  mockUseQuery,
  capturedNodeViewProps,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRunAction: vi.fn(),
  mockShowRunId: vi.fn(),
  mockUseQuery: vi.fn((_options?: { queryKey?: string[] }) => ({
    data: undefined as unknown,
  })),
  capturedNodeViewProps: {
    current: undefined as Record<string, unknown> | undefined,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: mockUseQuery };
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
    useRecceActionContext: () => ({
      runAction: mockRunAction,
      showRunId: mockShowRunId,
    }),
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
  NodeView: (props: {
    actionCallbacks: { onHistogramDiffClick?: () => void };
  }) => {
    capturedNodeViewProps.current = props as unknown as Record<string, unknown>;
    return (
      <button
        type="button"
        onClick={props.actionCallbacks.onHistogramDiffClick}
      >
        Histogram
      </button>
    );
  },
}));

import { NodeViewOss } from "../NodeViewOss";

describe("NodeViewOss Histogram launcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: undefined });
    capturedNodeViewProps.current = undefined;
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

  it("passes only prior analysis runs for the focused model, newest first", async () => {
    mockUseQuery.mockImplementation((options?: { queryKey?: string[] }) => {
      if (options?.queryKey?.[0] !== "runs") return { data: undefined };
      return {
        data: [
          {
            run_id: "orders-profile-failed",
            type: "profile_diff",
            run_at: "2026-08-24T10:00:00Z",
            status: "Failed",
            params: { model: "orders" },
          },
          {
            run_id: "customers-profile",
            type: "profile_diff",
            run_at: "2026-08-26T11:59:00Z",
            status: "Finished",
            params: { model: "customers" },
          },
          {
            run_id: "orders-histogram",
            type: "histogram_diff",
            run_at: "2026-08-26T11:00:00Z",
            status: "Finished",
            params: { model: "orders", column_name: "status" },
          },
          {
            run_id: "orders-running",
            type: "top_k_diff",
            run_at: "2026-08-26T12:00:00Z",
            status: "Running",
            params: { model: "orders", column_name: "state" },
          },
          {
            run_id: "orders-row-count",
            type: "row_count_diff",
            run_at: "2026-08-26T10:00:00Z",
            status: "Finished",
            params: { node_names: ["orders"] },
          },
          {
            run_id: "orders-value",
            type: "value_diff",
            run_at: "2026-08-25T10:00:00Z",
            status: "Finished",
            params: { model: "orders" },
          },
        ],
      };
    });

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

    await waitFor(() => {
      expect(capturedNodeViewProps.current?.recentAnalysisRuns).toEqual([
        {
          id: "orders-histogram",
          type: "histogram_diff",
          runAt: "2026-08-26T11:00:00Z",
          columnName: "status",
        },
        {
          id: "orders-value",
          type: "value_diff",
          runAt: "2026-08-25T10:00:00Z",
          columnName: undefined,
        },
        {
          id: "orders-profile-failed",
          type: "profile_diff",
          runAt: "2026-08-24T10:00:00Z",
          columnName: undefined,
        },
      ]);
    });
  });

  it("reopens a recent analysis result in the existing bottom pane", () => {
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

    const onViewAnalysisRun = capturedNodeViewProps.current
      ?.onViewAnalysisRun as ((runId: string) => void) | undefined;
    onViewAnalysisRun?.("orders-histogram");

    expect(mockShowRunId).toHaveBeenCalledWith("orders-histogram", false);
  });
});
