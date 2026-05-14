import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock the API client BEFORE importing useRun.
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    cancelRun: vi.fn().mockResolvedValue(undefined),
    waitRun: vi.fn().mockResolvedValue({
      run_id: "run-1",
      status: "Running",
      type: "query",
    }),
  };
});

import { cancelRun, waitRun } from "../api";
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

  test("does not throw if cancelRun POST rejects", async () => {
    (cancelRun as any).mockRejectedValueOnce(new Error("network"));
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
    expect(result.current.error).toBeNull();
  });
});
