import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock `waitRun` so polling resolves predictably with a Running run.
// We deliberately do NOT mock `cancelRun` so the real implementation (and
// its try/catch around `client.post`) runs in tests — see the "rejection
// safety" test below.
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    waitRun: vi.fn().mockResolvedValue({
      run_id: "run-1",
      status: "Running",
      type: "query",
    }),
  };
});

import { waitRun } from "../api";
import { useRun } from "./useRun";

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useRun onCancel", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    localStorage.clear();
  });

  test("flips cached run.status to Cancelled synchronously", async () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useRun("run-1"), {
      wrapper: wrapper(client),
    });
    await waitFor(() => {
      expect(result.current.run?.status).toBe("Running");
    });
    await act(async () => {
      await result.current.onCancel();
    });
    expect(result.current.run?.status).toBe("Cancelled");
    expect(result.current.isRunning).toBe(false);
  });

  test("stops polling after cancel", async () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useRun("run-1"), {
      wrapper: wrapper(client),
    });
    await waitFor(() => {
      expect(result.current.run?.status).toBe("Running");
    });
    const callsBeforeCancel = (waitRun as any).mock.calls.length;
    await act(async () => {
      await result.current.onCancel();
    });
    await new Promise((r) => setTimeout(r, 250)); // wait > 4 polling cycles
    const callsAfterCancel = (waitRun as any).mock.calls.length;
    expect(callsAfterCancel).toBe(callsBeforeCancel);
  });

  test("does not throw when the cancel POST rejects (real cancelRun path)", async () => {
    // Mock fetch so the cancel POST returns a network error. The real
    // `cancelRun` in `api/runs.ts` wraps `client.post` in try/catch — this
    // test exercises THAT swallow, not a stubbed `Promise.resolve()` in a
    // mocked `cancelRun`. Without this, the assertion would pass even if
    // the production swallow were deleted (see PR #1376 review note #6).
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as URL).href;
        if (url.includes("/cancel")) {
          throw new TypeError("simulated network failure");
        }
        // Fall back to the suite default for other URLs (waitRun is mocked
        // out at the module level, so this branch shouldn't fire, but keep
        // it safe).
        return new Response("{}", { status: 200 });
      });
    try {
      const client = new QueryClient();
      const { result } = renderHook(() => useRun("run-1"), {
        wrapper: wrapper(client),
      });
      await waitFor(() => {
        expect(result.current.run?.status).toBe("Running");
      });
      await act(async () => {
        await expect(result.current.onCancel()).resolves.toBeUndefined();
      });
      // Flush the fire-and-forget `void cancelRun(...)` so the swallowed
      // rejection actually settles before we assert.
      await new Promise((r) => setTimeout(r, 0));
      // Real cancelRun was invoked exactly once via fetch.
      const cancelCall = fetchSpy.mock.calls.find(([input]) => {
        const url = typeof input === "string" ? input : (input as URL).href;
        return url.includes("/cancel");
      });
      expect(cancelCall).toBeDefined();
      // UI state is unaffected by the network failure.
      expect(result.current.error).toBeNull();
      expect(result.current.run?.status).toBe("Cancelled");
      expect(result.current.isRunning).toBe(false);
    } finally {
      fetchSpy.mockRestore();
      globalThis.fetch = originalFetch;
    }
  });
});
