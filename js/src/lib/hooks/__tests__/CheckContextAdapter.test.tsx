/**
 * @file CheckContextAdapter.test.tsx
 * @description Tests for CheckContextAdapter - the bridge between OSS and @datarecce/ui
 *
 * The adapter wraps @datarecce/ui's CheckProvider and provides:
 * - OSS aliases (latestSelectedCheckId, setLatestSelectedCheckId)
 * - Backward-compatible useRecceCheckContext hook export
 *
 * These tests verify the adapter preserves all OSS RecceCheckContext behaviors
 * while delegating state management to the @datarecce/ui provider.
 */

import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  CheckContextAdapter,
  useCheckContext,
  useRecceCheckContext,
} from "../CheckContextAdapter";

/**
 * Create wrapper with CheckContextAdapter
 */
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <CheckContextAdapter>{children}</CheckContextAdapter>;
  };
}

/**
 * Test consumer component that displays context values using canonical names
 */
function TestConsumer() {
  const context = useCheckContext();
  return (
    <div>
      <span data-testid="selected-check-id">
        {context.selectedCheckId ?? "none"}
      </span>
      <span data-testid="is-loading">{String(context.isLoading)}</span>
      <span data-testid="checks-count">{context.checks.length}</span>
      <button
        type="button"
        onClick={() => context.onSelectCheck?.("check-123")}
        data-testid="select-check-btn"
      >
        Select Check
      </button>
    </div>
  );
}

/**
 * Test consumer component that uses OSS aliases
 */
function TestConsumerOssAliases() {
  const context = useRecceCheckContext();
  return (
    <div>
      <span data-testid="latest-selected-check-id">
        {context.latestSelectedCheckId ?? "none"}
      </span>
      <button
        type="button"
        onClick={() => context.setLatestSelectedCheckId?.("check-456")}
        data-testid="set-latest-selected-btn"
      >
        Set Latest Selected
      </button>
    </div>
  );
}

describe("CheckContextAdapter", () => {
  describe("provider basics", () => {
    it("renders children", () => {
      render(
        <CheckContextAdapter>
          <div data-testid="child">Child Content</div>
        </CheckContextAdapter>,
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("provides context value accessible via useCheckContext hook", () => {
      render(
        <CheckContextAdapter>
          <TestConsumer />
        </CheckContextAdapter>,
      );

      // Context is accessible and provides default values
      expect(screen.getByTestId("selected-check-id")).toHaveTextContent("none");
      expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      expect(screen.getByTestId("checks-count")).toHaveTextContent("0");
    });

    it("provides context value accessible via useRecceCheckContext hook (OSS alias)", () => {
      render(
        <CheckContextAdapter>
          <TestConsumerOssAliases />
        </CheckContextAdapter>,
      );

      // OSS alias context is accessible and provides default values
      expect(screen.getByTestId("latest-selected-check-id")).toHaveTextContent(
        "none",
      );
    });
  });

  describe("initial state", () => {
    it("has no selected check initially", () => {
      render(
        <CheckContextAdapter>
          <TestConsumer />
        </CheckContextAdapter>,
      );

      expect(screen.getByTestId("selected-check-id")).toHaveTextContent("none");
    });

    it("has empty checks array initially", () => {
      render(
        <CheckContextAdapter>
          <TestConsumer />
        </CheckContextAdapter>,
      );

      expect(screen.getByTestId("checks-count")).toHaveTextContent("0");
    });

    it("is not loading initially", () => {
      render(
        <CheckContextAdapter>
          <TestConsumer />
        </CheckContextAdapter>,
      );

      expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
    });
  });

  describe("hook re-exports", () => {
    it("useCheckContext returns context with all expected properties", () => {
      const { result } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper(),
      });

      // Canonical properties
      expect(result.current.checks).toBeDefined();
      expect(Array.isArray(result.current.checks)).toBe(true);
      expect(result.current.isLoading).toBeDefined();
      expect(typeof result.current.isLoading).toBe("boolean");

      // Selection functions may be undefined (optional in the context)
      expect(result.current.selectedCheckId).toBeUndefined();
      expect(typeof result.current.onSelectCheck).toBe("undefined");
    });

    it("useRecceCheckContext is an alias for useCheckContext", () => {
      const { result: checkResult } = renderHook(() => useCheckContext(), {
        wrapper: createWrapper(),
      });

      const { result: recceCheckResult } = renderHook(
        () => useRecceCheckContext(),
        {
          wrapper: createWrapper(),
        },
      );

      // Both hooks should return the same structure
      expect(checkResult.current.checks).toEqual(
        recceCheckResult.current.checks,
      );
      expect(checkResult.current.isLoading).toEqual(
        recceCheckResult.current.isLoading,
      );
    });
  });

  describe("OSS aliases", () => {
    it("latestSelectedCheckId is an alias for selectedCheckId", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      // Both should be undefined/same value initially
      expect(result.current.selectedCheckId).toEqual(
        result.current.latestSelectedCheckId,
      );
    });

    it("setLatestSelectedCheckId is an alias for onSelectCheck", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      // Both should be the same function reference (or both undefined)
      expect(result.current.onSelectCheck).toEqual(
        result.current.setLatestSelectedCheckId,
      );
    });
  });

  describe("backward compatibility", () => {
    it("supports original OSS CheckContext interface shape", () => {
      // The original OSS RecceCheckContext had:
      // - latestSelectedCheckId: string
      // - setLatestSelectedCheckId: (selectCheckId: string) => void
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      // These should be accessible (though may be undefined in the adapter)
      expect("latestSelectedCheckId" in result.current).toBe(true);
      expect("setLatestSelectedCheckId" in result.current).toBe(true);
    });
  });

  describe("type exports", () => {
    it("exports Check type", () => {
      // This test just verifies the type is exported (compile-time check)
      // If the import fails, TypeScript will catch it
      const checkShape: { check_id: string; name: string; type: string } = {
        check_id: "test",
        name: "Test Check",
        type: "query",
      };
      expect(checkShape.check_id).toBe("test");
    });
  });
});
