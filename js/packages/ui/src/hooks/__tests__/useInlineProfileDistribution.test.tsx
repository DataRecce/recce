/**
 * @file useInlineProfileDistribution.test.tsx
 * @description Tests for the inline profile-distribution hook (DRC-3390 PR 3).
 *
 * The hook is intentionally thin — submit a run, parse the payload, surface
 * loading / error / unsupported / data. Tests mock the API at the
 * `submitProfileDistribution` boundary so PR 2 doesn't need to be merged.
 */

import { vi } from "vitest";

// ----------------------------------------------------------------------
// Mocks (must be set up before imports)
// ----------------------------------------------------------------------

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../useApiConfig", () => ({
  useApiConfig: vi.fn(() => ({ apiClient: mockApiClient })),
}));

const mockSubmitProfileDistribution = vi.fn();
const mockTrack = vi.fn();

vi.mock("../../api/profileDistribution", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/profileDistribution")
  >("../../api/profileDistribution");
  return {
    ...actual,
    submitProfileDistribution: (
      ...args: Parameters<typeof actual.submitProfileDistribution>
    ) => mockSubmitProfileDistribution(...args),
  };
});

vi.mock("../../lib/api/track", () => ({
  trackProfileDistribution: (...args: unknown[]) => mockTrack(...args),
}));

// ----------------------------------------------------------------------
// Imports
// ----------------------------------------------------------------------

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  countFailedColumns,
  useInlineProfileDistribution,
} from "../useInlineProfileDistribution";

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

const wrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

function mockRunResult(result: unknown) {
  return {
    run_id: "test-run-id",
    type: "profile_distribution",
    run_at: new Date().toISOString(),
    status: "Finished",
    result,
  };
}

// ----------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------

describe("useInlineProfileDistribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is disabled when enabled = false and never submits a run", async () => {
    const { result } = renderHook(
      () => useInlineProfileDistribution("model.x", false),
      { wrapper: wrapper() },
    );
    // Brief wait to ensure no submit fires asynchronously.
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSubmitProfileDistribution).not.toHaveBeenCalled();
    expect(result.current.distributions).toEqual({});
  });

  it("is disabled when model is undefined and never submits a run", async () => {
    const { result } = renderHook(
      () => useInlineProfileDistribution(undefined, true),
      { wrapper: wrapper() },
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSubmitProfileDistribution).not.toHaveBeenCalled();
    expect(result.current.distributions).toEqual({});
  });

  it("submits a run and parses a normal (status: ok) result", async () => {
    const payload = {
      status: "ok" as const,
      columns: {
        col_a: {
          kind: "histogram" as const,
          bin_edges: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          base_density: Array(11).fill(0.1),
          current_density: Array(11).fill(0.1),
          base_total: 100,
          current_total: 110,
        },
        col_b: {
          kind: "topk" as const,
          values: ["a", "b"],
          base_counts: [10, 5],
          current_counts: [12, 4],
          base_total: 15,
          current_total: 16,
          trimmed: false,
        },
      },
    };
    mockSubmitProfileDistribution.mockResolvedValue(mockRunResult(payload));

    const { result } = renderHook(
      () => useInlineProfileDistribution("model.orders", true),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.distributions.col_a).toBeDefined();
    expect(result.current.distributions.col_b).toBeDefined();
    expect(result.current.distributions.col_a.kind).toBe("histogram");
    expect(result.current.distributions.col_b.kind).toBe("topk");
    expect(result.current.isUnsupported).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("surfaces an unsupported envelope as isUnsupported + unsupportedReason", async () => {
    const payload = {
      status: "unsupported" as const,
      reason: "postgres lacks native HLL",
    };
    mockSubmitProfileDistribution.mockResolvedValue(mockRunResult(payload));

    const { result } = renderHook(
      () => useInlineProfileDistribution("model.x", true),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isUnsupported).toBe(true);
    expect(result.current.unsupportedReason).toBe("postgres lacks native HLL");
    expect(result.current.distributions).toEqual({});
  });

  it("surfaces a submit-time error as error", async () => {
    mockSubmitProfileDistribution.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(
      () => useInlineProfileDistribution("model.x", true),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error?.message).toBe("network down");
    expect(result.current.distributions).toEqual({});
  });

  it("emits a request event before the run submits and a result event after it returns", async () => {
    const payload = { status: "ok" as const, columns: {} };
    mockSubmitProfileDistribution.mockResolvedValue(mockRunResult(payload));

    const { result } = renderHook(
      () => useInlineProfileDistribution("model.x", true),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const phases = mockTrack.mock.calls.map((c) => c[0].phase);
    expect(phases).toContain("request");
    expect(phases).toContain("result");
  });

  it("emits a result event with cache_hit=false and error_count for null-kind slots", async () => {
    const payload = {
      status: "ok" as const,
      columns: {
        good_col: {
          kind: "topk" as const,
          values: ["a"],
          base_counts: [1],
          current_counts: [1],
          base_total: 1,
          current_total: 1,
          trimmed: false,
        },
        bad_col_1: { kind: null, reason: "div by zero" },
        bad_col_2: { kind: null, reason: "timeout" },
      },
    };
    mockSubmitProfileDistribution.mockResolvedValue(mockRunResult(payload));

    const { result } = renderHook(
      () => useInlineProfileDistribution("model.x", true),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const resultCall = mockTrack.mock.calls.find(
      (c) => c[0].phase === "result",
    );
    expect(resultCall).toBeTruthy();
    expect(resultCall![0].column_count).toBe(3);
    expect(resultCall![0].error_count).toBe(2);
    expect(resultCall![0].cache_hit).toBe(false);
  });

  it("countFailedColumns: counts only kind:null slots", () => {
    expect(
      countFailedColumns({
        status: "ok",
        columns: {
          good: {
            kind: "topk",
            values: [],
            base_counts: [],
            current_counts: [],
            base_total: 0,
            current_total: 0,
            trimmed: false,
          },
          bad: { kind: null },
        },
      }),
    ).toBe(1);

    expect(countFailedColumns(undefined)).toBe(0);
    expect(countFailedColumns({ status: "ok", columns: {} })).toBe(0);
  });
});
