/**
 * @file useRun.test.tsx
 * @description Comprehensive tests for useRun hook from @datarecce/ui
 *
 * Tests verify:
 * - Initialization with correct default states
 * - Polling lifecycle (stops when run completes with result/error/status)
 * - Race condition prevention (completedRunIdRef prevents infinite polling)
 * - New run submission (resets isRunning and completedRunIdRef)
 * - RunResultView component resolution
 * - Cancel functionality
 * - Aggregated runs refetch for row_count types
 */

import { vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock ApiClient
const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Mock useApiConfig
vi.mock("../useApiConfig", () => ({
  useApiConfig: vi.fn(() => ({ apiClient: mockApiClient })),
}));

// Mock API functions
const mockWaitRun = vi.fn();
const mockCancelRun = vi.fn();

vi.mock("../../api", () => ({
  cacheKeys: { run: (id: string) => ["run", id] },
  waitRun: (...args: unknown[]) => mockWaitRun(...args),
  cancelRun: (...args: unknown[]) => mockCancelRun(...args),
  runTypeHasRef: (type: string) =>
    ["row_count", "row_count_diff", "value_diff"].includes(type),
}));

// Mock useRunsAggregated
const mockRefetchRunsAggregated = vi.fn();
vi.mock("../../contexts", () => ({
  useRunsAggregated: vi.fn(() => [null, mockRefetchRunsAggregated]),
}));

// Mock findByRunType
const mockRunResultView = vi.fn(() => null);
vi.mock("../../components/run", () => ({
  findByRunType: vi.fn(() => ({ RunResultView: mockRunResultView })),
}));

// ============================================================================
// Imports
// ============================================================================

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Run } from "../../api";
import { useRun } from "../useRun";

// ============================================================================
// Test Fixtures
// ============================================================================

// Mock run factory - uses unknown to bypass discriminated union type checking
// since we're testing runtime behavior, not TypeScript types
interface MockRunOverrides {
  run_id?: string;
  type?: string;
  run_at?: string;
  result?: unknown;
  error?: string;
  status?: "Running" | "Finished" | "Failed" | "Cancelled";
}

const createMockRun = (overrides: MockRunOverrides = {}): Run =>
  ({
    run_id: "test-run-id",
    type: "row_count_diff",
    run_at: new Date().toISOString(),
    result: null,
    error: undefined,
    status: "Running" as const,
    ...overrides,
  }) as unknown as Run;

// ============================================================================
// Test Setup
// ============================================================================

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWaitRun.mockReset();
    mockCancelRun.mockReset();
    mockRefetchRunsAggregated.mockReset();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe("initialization", () => {
    it("initializes isRunning to true when runId is provided", () => {
      mockWaitRun.mockResolvedValue(createMockRun());

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      expect(result.current.isRunning).toBe(true);
    });

    it("initializes isRunning to false when runId is undefined", () => {
      const { result } = renderHook(() => useRun(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isRunning).toBe(false);
    });

    it("initializes aborting to false", () => {
      mockWaitRun.mockResolvedValue(createMockRun());

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      expect(result.current.aborting).toBe(false);
    });

    it("initializes error to null", () => {
      mockWaitRun.mockResolvedValue(createMockRun());

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(null);
    });
  });

  // ==========================================================================
  // Polling Lifecycle Tests
  // ==========================================================================

  describe("polling lifecycle", () => {
    it("stops polling when run.result is received", async () => {
      const completedRun = createMockRun({
        result: { total: 100 },
        status: "Finished",
      });
      mockWaitRun.mockResolvedValue(completedRun);

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(result.current.run?.result).toEqual({ total: 100 });
    });

    it("stops polling when run.error is received", async () => {
      const errorRun = createMockRun({
        error: "Execution failed",
        status: "Failed",
      });
      mockWaitRun.mockResolvedValue(errorRun);

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(result.current.run?.error).toBe("Execution failed");
    });

    it("stops polling when status changes to Finished", async () => {
      const finishedRun = createMockRun({
        result: { data: [] },
        status: "Finished",
      });
      mockWaitRun.mockResolvedValue(finishedRun);

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(result.current.run?.status).toBe("Finished");
    });

    it("stops polling when status changes to Failed", async () => {
      const failedRun = createMockRun({
        error: "Database error",
        status: "Failed",
      });
      mockWaitRun.mockResolvedValue(failedRun);

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(result.current.run?.status).toBe("Failed");
    });

    it("stops polling when status changes to Cancelled", async () => {
      const cancelledRun = createMockRun({
        status: "Cancelled",
      });
      mockWaitRun.mockResolvedValue(cancelledRun);

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(result.current.run?.status).toBe("Cancelled");
    });

    it("continues polling while status is Running", async () => {
      let callCount = 0;
      mockWaitRun.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve(createMockRun({ status: "Running" }));
        }
        return Promise.resolve(
          createMockRun({ result: { done: true }, status: "Finished" }),
        );
      });

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(callCount).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================================================
  // Race Condition Prevention Tests
  // ==========================================================================

  describe("race condition prevention", () => {
    it("does not restart polling after completion even with fast polling interval", async () => {
      const completedRun = createMockRun({
        run_id: "completed-run",
        result: { total: 100 },
        status: "Finished",
      });

      let callCount = 0;
      mockWaitRun.mockImplementation(() => {
        callCount++;
        return Promise.resolve(completedRun);
      });

      const { result } = renderHook(() => useRun("completed-run"), {
        wrapper: createWrapper(),
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      const callCountAfterCompletion = callCount;

      // Wait additional time to ensure no more polling
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should not have made many more calls after completion
      // (may have 1-2 in-flight requests completing)
      expect(callCount).toBeLessThanOrEqual(callCountAfterCompletion + 2);
      expect(result.current.isRunning).toBe(false);
    });

    it("setIsRunning(false) is called only once per completed run", async () => {
      const completedRun = createMockRun({
        run_id: "single-complete-run",
        result: { data: "test" },
        status: "Finished",
      });

      mockWaitRun.mockResolvedValue(completedRun);

      const { result } = renderHook(() => useRun("single-complete-run"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      // Wait and verify it stays false (not toggling)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(result.current.isRunning).toBe(false);
    });

    it("completedRunIdRef prevents re-triggering for same run_id", async () => {
      const completedRun = createMockRun({
        run_id: "same-run-id",
        result: { value: 42 },
        status: "Finished",
      });

      // Return the same completed run multiple times (simulating fast polling)
      mockWaitRun.mockResolvedValue(completedRun);

      const { result } = renderHook(() => useRun("same-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      // Force multiple render cycles
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // isRunning should stay false (completedRunIdRef prevents re-trigger)
      expect(result.current.isRunning).toBe(false);
    });
  });

  // ==========================================================================
  // New Run Submission Tests
  // ==========================================================================

  describe("new run submission", () => {
    it("resets isRunning to true when runId changes", async () => {
      const completedRun = createMockRun({
        run_id: "first-run",
        result: { done: true },
        status: "Finished",
      });

      mockWaitRun.mockResolvedValue(completedRun);

      const { result, rerender } = renderHook(({ runId }) => useRun(runId), {
        wrapper: createWrapper(),
        initialProps: { runId: "first-run" },
      });

      // Wait for first run to complete
      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      // Now change runId to simulate new run
      const newRun = createMockRun({
        run_id: "second-run",
        status: "Running",
      });
      mockWaitRun.mockResolvedValue(newRun);

      rerender({ runId: "second-run" });

      // isRunning should be true for new run
      expect(result.current.isRunning).toBe(true);
    });

    it("clears completedRunIdRef when runId changes", async () => {
      // First run completes
      const firstRun = createMockRun({
        run_id: "run-1",
        result: { data: 1 },
        status: "Finished",
      });

      mockWaitRun.mockResolvedValue(firstRun);

      const { result, rerender } = renderHook(({ runId }) => useRun(runId), {
        wrapper: createWrapper(),
        initialProps: { runId: "run-1" },
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      // Second run starts and completes
      const secondRun = createMockRun({
        run_id: "run-2",
        result: { data: 2 },
        status: "Finished",
      });
      mockWaitRun.mockResolvedValue(secondRun);

      rerender({ runId: "run-2" });

      // Should detect new run starting
      expect(result.current.isRunning).toBe(true);

      // Should detect new run completing
      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(result.current.run?.run_id).toBe("run-2");
    });
  });

  // ==========================================================================
  // RunResultView Tests
  // ==========================================================================

  describe("RunResultView", () => {
    it("returns correct RunResultView component for run types with ref", async () => {
      const runWithRef = createMockRun({
        type: "row_count_diff",
        result: { total: 100 },
        status: "Finished",
      });
      mockWaitRun.mockResolvedValue(runWithRef);

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.run).toBeDefined();
      });

      expect(result.current.RunResultView).toBeDefined();
    });

    it("returns undefined for run types without ref", async () => {
      // Mock runTypeHasRef to return false for this type
      const runWithoutRef = createMockRun({
        type: "query",
        result: { data: [] },
        status: "Finished",
      });
      mockWaitRun.mockResolvedValue(runWithoutRef);

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.run).toBeDefined();
      });

      // query type doesn't have ref per our mock
      expect(result.current.RunResultView).toBeUndefined();
    });
  });

  // ==========================================================================
  // Cancel Tests
  // ==========================================================================

  describe("cancel functionality", () => {
    it("sets aborting to true when onCancel is called", async () => {
      mockWaitRun.mockResolvedValue(createMockRun({ status: "Running" }));
      mockCancelRun.mockResolvedValue({});

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.onCancel();
      });

      expect(result.current.aborting).toBe(true);
    });

    it("calls cancelRun API with correct runId", async () => {
      mockWaitRun.mockResolvedValue(createMockRun({ status: "Running" }));
      mockCancelRun.mockResolvedValue({});

      const { result } = renderHook(() => useRun("my-run-to-cancel"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.onCancel();
      });

      expect(mockCancelRun).toHaveBeenCalledWith(
        "my-run-to-cancel",
        mockApiClient,
      );
    });

    it("does not call cancelRun when runId is undefined", async () => {
      const { result } = renderHook(() => useRun(undefined), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.onCancel();
      });

      expect(mockCancelRun).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Aggregated Runs Refetch Tests
  // ==========================================================================

  describe("aggregated runs refetch", () => {
    it("refetches aggregated runs when row_count_diff completes", async () => {
      const rowCountDiffRun = createMockRun({
        type: "row_count_diff",
        result: { diff: 10 },
        status: "Finished",
      });
      mockWaitRun.mockResolvedValue(rowCountDiffRun);

      renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockRefetchRunsAggregated).toHaveBeenCalled();
      });
    });

    it("refetches aggregated runs when row_count completes", async () => {
      const rowCountRun = createMockRun({
        type: "row_count",
        result: { total: 100 },
        status: "Finished",
      });
      mockWaitRun.mockResolvedValue(rowCountRun);

      renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockRefetchRunsAggregated).toHaveBeenCalled();
      });
    });

    it("does not refetch aggregated runs for other run types", async () => {
      const valueDiffRun = createMockRun({
        type: "value_diff",
        result: { diff: [] },
        status: "Finished",
      });
      mockWaitRun.mockResolvedValue(valueDiffRun);

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false);
      });

      expect(mockRefetchRunsAggregated).not.toHaveBeenCalled();
    });

    it("refetches aggregated runs when row_count_diff errors", async () => {
      const errorRun = createMockRun({
        type: "row_count_diff",
        error: "Failed to count rows",
        status: "Failed",
      });
      mockWaitRun.mockResolvedValue(errorRun);

      renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockRefetchRunsAggregated).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe("error handling", () => {
    it("exposes query error when API call fails", async () => {
      mockWaitRun.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useRun("test-run-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe("Network error");
    });
  });
});
