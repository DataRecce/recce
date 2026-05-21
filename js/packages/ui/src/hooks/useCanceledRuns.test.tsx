import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useCanceledRuns } from "./useCanceledRuns";

const KEY = "recce:canceledRuns";

describe("useCanceledRuns", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  test("add() persists run_id to localStorage", () => {
    const { result } = renderHook(() => useCanceledRuns());
    act(() => {
      result.current.add("run-1");
    });
    expect(result.current.has("run-1")).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toContain("run-1");
  });

  test("add() is idempotent", () => {
    const { result } = renderHook(() => useCanceledRuns());
    act(() => {
      result.current.add("run-1");
      result.current.add("run-1");
    });
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toEqual(["run-1"]);
  });

  test("FIFO evicts oldest at 201st entry", () => {
    const { result } = renderHook(() => useCanceledRuns());
    act(() => {
      for (let i = 0; i < 201; i++) {
        result.current.add(`run-${i}`);
      }
    });
    expect(result.current.has("run-0")).toBe(false);
    expect(result.current.has("run-200")).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]").length).toBe(200);
  });

  test("storage event updates state cross-tab", () => {
    const { result } = renderHook(() => useCanceledRuns());
    act(() => {
      const ev = new StorageEvent("storage", {
        key: KEY,
        newValue: JSON.stringify(["run-cross-tab"]),
        oldValue: null,
        storageArea: localStorage,
      });
      window.dispatchEvent(ev);
    });
    expect(result.current.has("run-cross-tab")).toBe(true);
  });

  test("ignores malformed localStorage values", () => {
    localStorage.setItem(KEY, "{not json");
    const { result } = renderHook(() => useCanceledRuns());
    expect(result.current.has("anything")).toBe(false);
  });

  /**
   * Regression: sibling hook instances in the SAME tab must observe each
   * other's add() calls. Before the same-tab broadcast was added, RunView's
   * useCanceledRuns kept stale `ids` after useRun.onCancel called
   * canceledRuns.add(runId) — the `storage` event only fires cross-tab.
   * That stale state is what allowed the in-flight waitRun poll to revert
   * the UI from Cancelled back to Running on PR #1376.
   */
  test("add() broadcasts to sibling instances in the same tab", () => {
    const { result: a } = renderHook(() => useCanceledRuns());
    const { result: b } = renderHook(() => useCanceledRuns());
    expect(a.current.has("run-sibling")).toBe(false);
    expect(b.current.has("run-sibling")).toBe(false);
    act(() => {
      a.current.add("run-sibling");
    });
    // Both instances must see it.
    expect(a.current.has("run-sibling")).toBe(true);
    expect(b.current.has("run-sibling")).toBe(true);
  });
});
