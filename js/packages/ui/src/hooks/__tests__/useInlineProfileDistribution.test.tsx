/**
 * @file useInlineProfileDistribution.test.tsx
 * @description DRC-3390 Stage C — the inline-distribution hook gates on the
 * server flag, submits + polls the run, narrows the result envelope, and
 * emits a single timing event.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockServerFlag, mockSubmit, mockWaitRun, mockTrack, mockApiClient } =
  vi.hoisted(() => ({
    mockServerFlag: vi.fn(),
    mockSubmit: vi.fn(),
    mockWaitRun: vi.fn(),
    mockTrack: vi.fn(),
    mockApiClient: { get: vi.fn(), post: vi.fn() },
  }));

vi.mock("../useApiConfig", () => ({
  useApiConfig: () => ({ apiClient: mockApiClient }),
}));

vi.mock("../../contexts", () => ({
  useRecceServerFlag: () => mockServerFlag(),
}));

vi.mock("../../api", () => ({
  submitProfileDistribution: (...args: unknown[]) => mockSubmit(...args),
  waitRun: (...args: unknown[]) => mockWaitRun(...args),
}));

vi.mock("../../lib/api/track", () => ({
  trackProfileDistribution: (...args: unknown[]) => mockTrack(...args),
}));

import { useInlineProfileDistribution } from "../useInlineProfileDistribution";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const flagOn = () =>
  mockServerFlag.mockReturnValue({ data: { inline_profile: true } });
const flagOff = () =>
  mockServerFlag.mockReturnValue({ data: { inline_profile: false } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useInlineProfileDistribution", () => {
  it("is disabled and never submits when the flag is off", async () => {
    flagOff();
    const { result } = renderHook(
      () => useInlineProfileDistribution({ model: "orders" }),
      { wrapper: createWrapper() },
    );
    expect(result.current.status).toBe("disabled");
    // Give any (incorrectly-enabled) query a tick to fire.
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("is disabled when no model is provided", () => {
    flagOn();
    const { result } = renderHook(() => useInlineProfileDistribution({}), {
      wrapper: createWrapper(),
    });
    expect(result.current.status).toBe("disabled");
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("submits, polls, and surfaces an ok result with parsed columns", async () => {
    flagOn();
    mockSubmit.mockResolvedValue({ run_id: "r1" });
    mockWaitRun.mockResolvedValue({
      run_id: "r1",
      type: "profile_distribution",
      status: "Finished",
      result: {
        status: "ok",
        strategy: "approx_all",
        base_total: 100,
        current_total: 90,
        cache_hit: false,
        columns: {
          amount: {
            kind: "histogram",
            base_bin_edges: [0, 1],
            current_bin_edges: [0, 1],
            base_density: [1],
            current_density: [1],
            base_total: 100,
            current_total: 90,
          },
          bad: { kind: null },
        },
      },
    });

    const { result } = renderHook(
      () => useInlineProfileDistribution({ model: "orders" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(result.current.columns.amount.kind).toBe("histogram");
    expect(result.current.baseTotal).toBe(100);
    expect(result.current.currentTotal).toBe(90);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    // Timing event fired once, with the per-column failure counted.
    await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(1));
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ok",
        strategy: "approx_all",
        column_count: 2,
        error_count: 1,
        cache_hit: false,
      }),
    );
  });

  it("surfaces the unsupported envelope with its reason", async () => {
    flagOn();
    mockSubmit.mockResolvedValue({ run_id: "r2" });
    mockWaitRun.mockResolvedValue({
      run_id: "r2",
      type: "profile_distribution",
      status: "Finished",
      result: {
        status: "unsupported",
        reason: "Adapter 'snowflake' does not support APPROX_PERCENTILE.",
        columns: {},
      },
    });

    const { result } = renderHook(
      () => useInlineProfileDistribution({ model: "orders" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.status).toBe("unsupported"));
    expect(result.current.unsupportedReason).toContain("snowflake");
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({ status: "unsupported" }),
      ),
    );
  });

  it("polls until the run leaves the Running state", async () => {
    flagOn();
    mockSubmit.mockResolvedValue({ run_id: "r3" });
    mockWaitRun
      .mockResolvedValueOnce({ run_id: "r3", status: "Running" })
      .mockResolvedValueOnce({
        run_id: "r3",
        type: "profile_distribution",
        status: "Finished",
        result: {
          status: "ok",
          strategy: "approx_all",
          base_total: 1,
          current_total: 1,
          columns: {},
        },
      });

    const { result } = renderHook(
      () => useInlineProfileDistribution({ model: "orders" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(mockWaitRun).toHaveBeenCalledTimes(2);
  });
});
