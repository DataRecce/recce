/**
 * @file useInlineProfileDistribution.test.tsx
 * @description DRC-3390 Stage C — the inline-distribution hook gates on the
 * server flag, submits the run synchronously, narrows the result envelope,
 * emits a single timing event, and reports transport failures to Sentry.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockServerFlag, mockSubmit, mockTrack, mockCapture, mockApiClient } =
  vi.hoisted(() => ({
    mockServerFlag: vi.fn(),
    mockSubmit: vi.fn(),
    mockTrack: vi.fn(),
    mockCapture: vi.fn(),
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
}));

vi.mock("../../lib/api/track", () => ({
  trackProfileDistribution: (...args: unknown[]) => mockTrack(...args),
}));

vi.mock("@sentry/react", () => ({
  captureException: (...args: unknown[]) => mockCapture(...args),
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

  it("submits synchronously and surfaces an ok result with parsed columns", async () => {
    flagOn();
    mockSubmit.mockResolvedValue({
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
    // The submit fires without `nowait` so the server returns the resolved run.
    expect(mockSubmit).toHaveBeenCalledWith(
      { model: "orders", columns: undefined },
      { trackProps: { source: "schema_view" } },
      mockApiClient,
    );
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
    mockSubmit.mockResolvedValue({
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

  it("keeps the prior histograms visible while a wider same-node query loads", async () => {
    flagOn();
    const histogram = {
      kind: "histogram" as const,
      base_bin_edges: [0, 1],
      current_bin_edges: [0, 1],
      base_density: [1],
      current_density: [1],
      base_total: 1,
      current_total: 1,
    };
    const okRun = (runId: string, columns: Record<string, unknown>) => ({
      run_id: runId,
      type: "profile_distribution",
      status: "Finished",
      result: {
        status: "ok",
        strategy: "approx_all",
        base_total: 1,
        current_total: 1,
        columns,
      },
    });

    // First (scoped) run resolves immediately; the second (widened) run is held
    // pending so we can observe the placeholder window.
    let resolveWide: (() => void) | undefined;
    mockSubmit
      .mockResolvedValueOnce(okRun("r1", { a: histogram }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveWide = () =>
              resolve(okRun("r2", { a: histogram, b: histogram }));
          }),
      );

    const { result, rerender } = renderHook(
      (props: { columns?: string[] }) =>
        useInlineProfileDistribution({ model: "orders", ...props }),
      {
        wrapper: createWrapper(),
        initialProps: { columns: ["a"] } as { columns?: string[] },
      },
    );

    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(result.current.columns.a).toBeDefined();

    // Widen to every column (the "Profile all columns" path).
    rerender({ columns: undefined });

    // While the wider run is in flight the prior histogram stays on screen
    // (status stays "ok", column `a` still present) rather than blanking out.
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.status).toBe("ok");
    expect(result.current.columns.a).toBeDefined();
    expect(result.current.columns.b).toBeUndefined();

    // Once it resolves the new column streams in alongside the kept one.
    resolveWide?.();
    await waitFor(() => expect(result.current.columns.b).toBeDefined());
    expect(result.current.columns.a).toBeDefined();
  });

  it("reports a transport failure to Sentry and surfaces the error state", async () => {
    flagOn();
    const boom = new Error("Request timed out");
    mockSubmit.mockRejectedValue(boom);

    const { result } = renderHook(
      () => useInlineProfileDistribution({ model: "orders" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(boom);
    // Flagged in Sentry so slow-run timeouts are visible.
    expect(mockCapture).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        tags: { feature: "inline_profile_distribution" },
      }),
    );
    // And a single error timing event is emitted.
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" }),
    );
  });
});
