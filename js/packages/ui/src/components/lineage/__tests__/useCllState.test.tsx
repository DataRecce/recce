import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ColumnLineageData } from "../../../api/cll";
import type { ApiClient } from "../../../lib/fetchClient";
import { useCllState } from "../useCllState";

const CLL_RESULT: ColumnLineageData = {
  current: {
    nodes: {},
    columns: {},
    parent_map: {},
    child_map: {},
  },
};

function createApiClient(): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: CLL_RESULT }),
    patch: vi.fn(),
    delete: vi.fn(),
  } as ApiClient;
}

describe("useCllState", () => {
  let apiClient: ApiClient;
  let queryClient: QueryClient;

  beforeEach(() => {
    apiClient = createApiClient();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("fetches CLL and commits the accepted result", async () => {
    const { result } = renderHook(() =>
      useCllState({ apiClient, queryClient }),
    );

    let resolution: Awaited<ReturnType<typeof result.current.refresh>>;
    await act(async () => {
      resolution = await result.current.refresh({
        cllInput: { node_id: "model.orders" },
        changeAnalysis: false,
      });
      result.current.commit(resolution.cll);
    });

    expect(resolution!.cll).toEqual(CLL_RESULT);
    expect(result.current.cll).toEqual(CLL_RESULT);
  });

  it("preserves optional inputs in LIFO history", () => {
    const { result } = renderHook(() =>
      useCllState({ apiClient, queryClient }),
    );

    act(() => {
      result.current.history.push(undefined);
      result.current.history.push({
        node_id: "model.orders",
        column: "id",
      });
    });

    expect(result.current.history.peek()).toEqual({
      input: { node_id: "model.orders", column: "id" },
    });
    expect(result.current.history.pop()).toEqual({
      input: { node_id: "model.orders", column: "id" },
    });
    expect(result.current.history.pop()).toEqual({ input: undefined });
    expect(result.current.history.pop()).toBeUndefined();
  });

  it("resets current CLL, history, and impact snapshots", () => {
    const { result } = renderHook(() =>
      useCllState({ apiClient, queryClient }),
    );

    act(() => {
      result.current.commit(CLL_RESULT);
      result.current.history.push({ node_id: "model.orders" });
      result.current.publishImpactSets({
        nodeIds: new Set(["model.orders"]),
        columnIds: new Set(["model.orders:id"]),
        wholeModelImpactedNodeIds: new Set(["model.orders"]),
        wholeModelChangedNodeIds: new Set(),
      });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.cll).toBeUndefined();
    expect(result.current.history.peek()).toBeUndefined();
    expect(result.current.impactedNodeIds).toEqual(new Set());
    expect(result.current.impactedColumnIds).toEqual(new Set());
    expect(result.current.wholeModelImpactedNodeIds).toEqual(new Set());
    expect(result.current.wholeModelChangedNodeIds).toEqual(new Set());
  });
});
