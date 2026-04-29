/**
 * @file useModelColumns.test.tsx
 * @description Tests for the useModelColumns hook (DRC-3343).
 *
 * Verifies:
 * - The hook resolves columns + primary_key from the /api/models/{id} payload.
 * - When useModelColumns and a sibling useQuery({queryKey: ["modelDetail", id]})
 *   mount under one QueryClient, only ONE network request fires
 *   (regression guard for DRC-3343, where the panel double-fetched).
 * - The hook returns isLoading=false when no model resolves (matches the
 *   prior hook contract).
 */

import { vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

const mockGetModelInfo = vi.fn();

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    getModelInfo: (...args: unknown[]) => mockGetModelInfo(...args),
  };
});

const mockUseLineageGraphContext = vi.fn();
vi.mock("../../contexts/lineage", () => ({
  useLineageGraphContext: () => mockUseLineageGraphContext(),
}));

vi.mock("../../providers", () => ({
  useApiConfigOptional: () => ({ apiClient: mockApiClient }),
}));

// ============================================================================
// Imports
// ============================================================================

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useModelColumns } from "../useModelColumns";

// ============================================================================
// Test Setup
// ============================================================================

const NODE_ID = "model.test.my_model";
const MODEL_NAME = "my_model";

const lineageNode = {
  id: NODE_ID,
  data: { id: NODE_ID, name: MODEL_NAME },
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const fakeModelInfo = {
  model: {
    base: {
      columns: { id: { name: "id", type: "INT" } },
      primary_key: "id",
    },
    current: {
      columns: {
        id: { name: "id", type: "INT" },
        name: { name: "name", type: "TEXT" },
      },
      primary_key: "id",
    },
  },
};

describe("useModelColumns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetModelInfo.mockReset();
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph: { nodes: [lineageNode] },
    });
  });

  it("resolves columns and primaryKey from /api/models/{id}", async () => {
    mockGetModelInfo.mockResolvedValue(fakeModelInfo);

    const { result } = renderHook(() => useModelColumns(MODEL_NAME), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetModelInfo).toHaveBeenCalledTimes(1);
    expect(mockGetModelInfo).toHaveBeenCalledWith(NODE_ID, mockApiClient);
    expect(result.current.columns.map((c) => c.name)).toEqual(["id", "name"]);
    expect(result.current.primaryKey).toBe("id");
    expect(result.current.error).toBe(null);
  });

  it("dedupes the /api/models/{id} fetch when a sibling useQuery shares the cache key (DRC-3343)", async () => {
    mockGetModelInfo.mockResolvedValue(fakeModelInfo);

    // One QueryClient shared by both hooks — the dedupe under test.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Sibling query in the same render — same shape NodeViewOss uses today.
    const useBothQueries = () => {
      const cols = useModelColumns(MODEL_NAME);
      const sibling = useQuery({
        queryKey: ["modelDetail", NODE_ID],
        queryFn: () => mockGetModelInfo(NODE_ID, mockApiClient),
        staleTime: 5 * 60 * 1000,
      });
      return { cols, sibling };
    };

    const { result } = renderHook(useBothQueries, { wrapper });

    await waitFor(() => {
      expect(result.current.cols.isLoading).toBe(false);
      expect(result.current.sibling.isLoading).toBe(false);
    });

    // Critical assertion: ONE network call across both hooks.
    expect(mockGetModelInfo).toHaveBeenCalledTimes(1);
  });

  it("returns isLoading=false and no fetch when model is undefined", () => {
    const { result } = renderHook(() => useModelColumns(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.columns).toEqual([]);
    expect(result.current.primaryKey).toBeUndefined();
    expect(mockGetModelInfo).not.toHaveBeenCalled();
  });

  it("surfaces fetch errors as Error instances", async () => {
    mockGetModelInfo.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useModelColumns(MODEL_NAME), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
  });
});
