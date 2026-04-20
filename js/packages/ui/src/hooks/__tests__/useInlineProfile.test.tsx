/**
 * @file useInlineProfile.test.tsx
 * @description Tests for useInlineProfile hook.
 */

import { vi } from "vitest";

// Mocks must be declared before imports that use them
const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../useApiConfig", () => ({
  useApiConfig: vi.fn(() => ({ apiClient: mockApiClient })),
}));

const mockSubmitRun = vi.fn();
const mockWaitRun = vi.fn();

vi.mock("../../api", () => ({
  submitRun: (...args: unknown[]) => mockSubmitRun(...args),
  waitRun: (...args: unknown[]) => mockWaitRun(...args),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useInlineProfile } from "../useInlineProfile";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const resultWithTwoColumns = {
  base: {
    columns: [
      { key: "column_name", name: "column_name", type: "text" },
      {
        key: "not_null_proportion",
        name: "not_null_proportion",
        type: "number",
      },
      { key: "min", name: "min", type: "text" },
      { key: "max", name: "max", type: "text" },
      { key: "avg", name: "avg", type: "number" },
      { key: "is_unique", name: "is_unique", type: "boolean" },
    ],
    data: [
      ["status", 1.0, "pending", "completed", null, false],
      ["amount", 0.95, "10", "500", 123.4, false],
    ],
  },
  current: {
    columns: [
      { key: "column_name", name: "column_name", type: "text" },
      {
        key: "not_null_proportion",
        name: "not_null_proportion",
        type: "number",
      },
      { key: "min", name: "min", type: "text" },
      { key: "max", name: "max", type: "text" },
      { key: "avg", name: "avg", type: "number" },
      { key: "is_unique", name: "is_unique", type: "boolean" },
    ],
    data: [
      ["status", 0.98, "pending", "completed", null, false],
      ["amount", 0.95, "10", "500", 123.4, false],
    ],
  },
};

describe("useInlineProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitRun.mockReset();
    mockWaitRun.mockReset();
  });

  it("does not submit when disabled", () => {
    renderHook(
      () =>
        useInlineProfile({
          modelName: "orders",
          columns: ["status"],
          enabled: false,
        }),
      { wrapper: createWrapper() },
    );
    expect(mockSubmitRun).not.toHaveBeenCalled();
  });

  it("does not submit when modelName is undefined", () => {
    renderHook(
      () =>
        useInlineProfile({
          modelName: undefined,
          columns: ["status"],
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );
    expect(mockSubmitRun).not.toHaveBeenCalled();
  });

  it("does not submit when columns array is empty", () => {
    renderHook(
      () =>
        useInlineProfile({
          modelName: "orders",
          columns: [],
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );
    expect(mockSubmitRun).not.toHaveBeenCalled();
  });

  it("submits profile_diff and returns profileByColumn map on success", async () => {
    mockSubmitRun.mockResolvedValue({ run_id: "run-1" });
    mockWaitRun.mockResolvedValue({
      run_id: "run-1",
      status: "Finished",
      result: resultWithTwoColumns,
    });

    const { result } = renderHook(
      () =>
        useInlineProfile({
          modelName: "orders",
          columns: ["status", "amount"],
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSubmitRun).toHaveBeenCalledWith(
      "profile_diff",
      { model: "orders", columns: ["status", "amount"] },
      { nowait: true },
      mockApiClient,
    );
    const status = result.current.profileByColumn.get("status");
    expect(status?.base?.not_null_proportion).toBe(1.0);
    expect(status?.current?.not_null_proportion).toBe(0.98);
    expect(status?.current?.min).toBe("pending");
    expect(status?.current?.max).toBe("completed");
    expect(status?.current?.is_unique).toBe(false);
  });

  it("handles uppercase DataFrame keys (Snowflake)", async () => {
    mockSubmitRun.mockResolvedValue({ run_id: "run-2" });
    mockWaitRun.mockResolvedValue({
      run_id: "run-2",
      status: "Finished",
      result: {
        base: {
          columns: [
            { key: "COLUMN_NAME", name: "COLUMN_NAME", type: "text" },
            {
              key: "NOT_NULL_PROPORTION",
              name: "NOT_NULL_PROPORTION",
              type: "number",
            },
            { key: "IS_UNIQUE", name: "IS_UNIQUE", type: "boolean" },
          ],
          data: [["STATUS", 1.0, true]],
        },
        current: {
          columns: [
            { key: "COLUMN_NAME", name: "COLUMN_NAME", type: "text" },
            {
              key: "NOT_NULL_PROPORTION",
              name: "NOT_NULL_PROPORTION",
              type: "number",
            },
            { key: "IS_UNIQUE", name: "IS_UNIQUE", type: "boolean" },
          ],
          data: [["STATUS", 0.9, true]],
        },
      },
    });

    const { result } = renderHook(
      () =>
        useInlineProfile({
          modelName: "orders",
          columns: ["status"],
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const status = result.current.profileByColumn.get("status");
    expect(status?.base?.not_null_proportion).toBe(1.0);
    expect(status?.current?.not_null_proportion).toBe(0.9);
    expect(status?.current?.is_unique).toBe(true);
  });

  it("reports error when the run returns an error", async () => {
    mockSubmitRun.mockResolvedValue({ run_id: "run-3" });
    mockWaitRun.mockResolvedValue({
      run_id: "run-3",
      status: "Failed",
      error: "boom",
    });

    const { result } = renderHook(
      () =>
        useInlineProfile({
          modelName: "orders",
          columns: ["status"],
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.profileByColumn.size).toBe(0);
  });

  it("polls waitRun until a result is produced", async () => {
    mockSubmitRun.mockResolvedValue({ run_id: "run-4" });
    mockWaitRun
      .mockResolvedValueOnce({ run_id: "run-4", status: "Running" })
      .mockResolvedValueOnce({
        run_id: "run-4",
        status: "Finished",
        result: resultWithTwoColumns,
      });

    const { result } = renderHook(
      () =>
        useInlineProfile({
          modelName: "orders",
          columns: ["status", "amount"],
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockWaitRun).toHaveBeenCalledTimes(2);
    expect(result.current.profileByColumn.size).toBe(2);
  });
});
