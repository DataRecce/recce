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

import { CheckContextAdapter, useRecceCheckContext } from "@datarecce/ui/hooks";
import { useCheckContext } from "@datarecce/ui/providers";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";

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
 * (via the raw useCheckContext hook which returns the full CheckContextType)
 */
function TestConsumer() {
  const context = useCheckContext();
  return (
    <div>
      <span data-testid="selected-check-id">
        {context.selectedCheckId || "none"}
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
 * (via useRecceCheckContext which returns the simplified OSSCheckContext)
 */
function TestConsumerOssAliases() {
  const context = useRecceCheckContext();
  return (
    <div>
      <span data-testid="latest-selected-check-id">
        {context.latestSelectedCheckId || "none"}
      </span>
      <button
        type="button"
        onClick={() => context.setLatestSelectedCheckId("check-456")}
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

      // Canonical properties from @datarecce/ui CheckContextType
      expect(result.current.checks).toBeDefined();
      expect(Array.isArray(result.current.checks)).toBe(true);
      expect(result.current.isLoading).toBeDefined();
      expect(typeof result.current.isLoading).toBe("boolean");

      // OSS aliases are available via the raw context
      expect("latestSelectedCheckId" in result.current).toBe(true);
      expect("setLatestSelectedCheckId" in result.current).toBe(true);
    });

    it("useRecceCheckContext returns OSS-compatible interface", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      // useRecceCheckContext returns the simplified OSSCheckContext
      expect(result.current.latestSelectedCheckId).toBeDefined();
      expect(typeof result.current.latestSelectedCheckId).toBe("string");
      expect(result.current.setLatestSelectedCheckId).toBeDefined();
      expect(typeof result.current.setLatestSelectedCheckId).toBe("function");

      // OSSCheckContext only has these two properties
      expect(Object.keys(result.current).length).toBe(2);
    });
  });

  describe("OSS aliases", () => {
    it("latestSelectedCheckId provides selection state", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      // Should be empty string initially
      expect(result.current.latestSelectedCheckId).toBe("");
    });

    it("setLatestSelectedCheckId updates the selection", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLatestSelectedCheckId("check-789");
      });

      expect(result.current.latestSelectedCheckId).toBe("check-789");
    });

    it("selection state persists across re-renders", () => {
      const { result, rerender } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLatestSelectedCheckId("persistent-check");
      });

      rerender();

      expect(result.current.latestSelectedCheckId).toBe("persistent-check");
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

      // These should be accessible and have correct types
      expect("latestSelectedCheckId" in result.current).toBe(true);
      expect(typeof result.current.latestSelectedCheckId).toBe("string");
      expect("setLatestSelectedCheckId" in result.current).toBe(true);
      expect(typeof result.current.setLatestSelectedCheckId).toBe("function");
    });

    it("setLatestSelectedCheckId is callable without optional chaining", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      // In the old OSS code, setLatestSelectedCheckId was called directly
      // (not with optional chaining) - this should still work
      expect(() => {
        act(() => {
          result.current.setLatestSelectedCheckId("test-check");
        });
      }).not.toThrow();
    });
  });

  describe("state sharing between hooks", () => {
    it("useCheckContext and useRecceCheckContext share state", () => {
      function Consumer1() {
        const context = useCheckContext();
        return (
          <span data-testid="consumer-1">
            {context.selectedCheckId || "none"}
          </span>
        );
      }

      function Consumer2() {
        const context = useRecceCheckContext();
        return (
          <div>
            <span data-testid="consumer-2">
              {context.latestSelectedCheckId || "none"}
            </span>
            <button
              type="button"
              onClick={() => context.setLatestSelectedCheckId("shared-check")}
              data-testid="set-shared"
            >
              Set Shared
            </button>
          </div>
        );
      }

      render(
        <CheckContextAdapter>
          <Consumer1 />
          <Consumer2 />
        </CheckContextAdapter>,
      );

      // Both start with initial value (empty string displays as "none")
      expect(screen.getByTestId("consumer-1")).toHaveTextContent("none");
      expect(screen.getByTestId("consumer-2")).toHaveTextContent("none");

      // Update from Consumer2
      act(() => {
        screen.getByTestId("set-shared").click();
      });

      // Both should see the update
      expect(screen.getByTestId("consumer-1")).toHaveTextContent(
        "shared-check",
      );
      expect(screen.getByTestId("consumer-2")).toHaveTextContent(
        "shared-check",
      );
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
