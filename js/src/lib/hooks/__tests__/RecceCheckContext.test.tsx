/**
 * @file RecceCheckContext.test.tsx
 * @description Tests for RecceCheckContext provider and hooks (OSS version)
 *
 * Phase 2A: Context Unification - Establishing behavioral contracts
 * These tests verify the behavior of RecceCheckContextProvider and useRecceCheckContext
 * to ensure nothing breaks during migration.
 *
 * KEY CHARACTERISTICS of OSS RecceCheckContext:
 * - MINIMAL interface - only selection state
 * - `latestSelectedCheckId: string` - tracks selected check (initialized to empty string)
 * - `setLatestSelectedCheckId: (selectCheckId: string) => void` - updates selection
 *
 * This is different from @datarecce/ui's CheckContext which has full CRUD
 * (checks array, create, update, delete, reorder).
 */

import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  RecceCheckContextProvider,
  useRecceCheckContext,
} from "../RecceCheckContext";

/**
 * Test consumer component that displays context values
 */
function TestConsumer() {
  const { latestSelectedCheckId, setLatestSelectedCheckId } =
    useRecceCheckContext();
  return (
    <div>
      <span data-testid="selected-id">{latestSelectedCheckId}</span>
      <button
        type="button"
        onClick={() => setLatestSelectedCheckId("check-1")}
        data-testid="select-check-1"
      >
        Select Check 1
      </button>
      <button
        type="button"
        onClick={() => setLatestSelectedCheckId("check-2")}
        data-testid="select-check-2"
      >
        Select Check 2
      </button>
      <button
        type="button"
        onClick={() => setLatestSelectedCheckId("")}
        data-testid="clear-selection"
      >
        Clear Selection
      </button>
    </div>
  );
}

/**
 * Create wrapper with provider
 */
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <RecceCheckContextProvider>{children}</RecceCheckContextProvider>;
  };
}

describe("RecceCheckContext (OSS)", () => {
  describe("provider basics", () => {
    it("renders children", () => {
      render(
        <RecceCheckContextProvider>
          <div data-testid="child">Child Content</div>
        </RecceCheckContextProvider>,
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("provides context value accessible via hook", () => {
      render(
        <RecceCheckContextProvider>
          <TestConsumer />
        </RecceCheckContextProvider>,
      );

      // Context is accessible and provides default values
      expect(screen.getByTestId("selected-id")).toBeInTheDocument();
    });
  });

  describe("initial state", () => {
    it("has empty string as initial latestSelectedCheckId", () => {
      render(
        <RecceCheckContextProvider>
          <TestConsumer />
        </RecceCheckContextProvider>,
      );

      expect(screen.getByTestId("selected-id")).toHaveTextContent("");
    });

    it("returns empty string from hook on initial render", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.latestSelectedCheckId).toBe("");
    });
  });

  describe("setLatestSelectedCheckId function", () => {
    it("updates latestSelectedCheckId when called", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLatestSelectedCheckId("check-123");
      });

      expect(result.current.latestSelectedCheckId).toBe("check-123");
    });

    it("updates via click interaction", () => {
      render(
        <RecceCheckContextProvider>
          <TestConsumer />
        </RecceCheckContextProvider>,
      );

      act(() => {
        screen.getByTestId("select-check-1").click();
      });

      expect(screen.getByTestId("selected-id")).toHaveTextContent("check-1");
    });

    it("handles multiple updates correctly", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLatestSelectedCheckId("check-1");
      });
      expect(result.current.latestSelectedCheckId).toBe("check-1");

      act(() => {
        result.current.setLatestSelectedCheckId("check-2");
      });
      expect(result.current.latestSelectedCheckId).toBe("check-2");

      act(() => {
        result.current.setLatestSelectedCheckId("check-3");
      });
      expect(result.current.latestSelectedCheckId).toBe("check-3");
    });

    it("clears selection when set to empty string", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      // First select something
      act(() => {
        result.current.setLatestSelectedCheckId("check-123");
      });
      expect(result.current.latestSelectedCheckId).toBe("check-123");

      // Then clear it
      act(() => {
        result.current.setLatestSelectedCheckId("");
      });
      expect(result.current.latestSelectedCheckId).toBe("");
    });

    it("clears selection via click interaction", () => {
      render(
        <RecceCheckContextProvider>
          <TestConsumer />
        </RecceCheckContextProvider>,
      );

      // First select a check
      act(() => {
        screen.getByTestId("select-check-1").click();
      });
      expect(screen.getByTestId("selected-id")).toHaveTextContent("check-1");

      // Then clear selection
      act(() => {
        screen.getByTestId("clear-selection").click();
      });
      expect(screen.getByTestId("selected-id")).toHaveTextContent("");
    });
  });

  describe("hook behavior", () => {
    it("useRecceCheckContext returns context with all expected values", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.latestSelectedCheckId).toBeDefined();
      expect(result.current.setLatestSelectedCheckId).toBeDefined();
      expect(typeof result.current.setLatestSelectedCheckId).toBe("function");
    });

    it("hook returns default context values outside provider", () => {
      // Render without provider to test default context
      const { result } = renderHook(() => useRecceCheckContext());

      // Default context values from createContext
      expect(result.current.latestSelectedCheckId).toBe("");
      expect(typeof result.current.setLatestSelectedCheckId).toBe("function");
    });

    it("default setLatestSelectedCheckId is a no-op outside provider", () => {
      const { result } = renderHook(() => useRecceCheckContext());

      // Should not throw when called outside provider
      expect(() => {
        result.current.setLatestSelectedCheckId("test-id");
      }).not.toThrow();

      // Value should not change (no-op)
      expect(result.current.latestSelectedCheckId).toBe("");
    });
  });

  describe("state persistence", () => {
    it("selection persists across re-renders", () => {
      const { result, rerender } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLatestSelectedCheckId("persistent-check");
      });

      // Trigger re-render
      rerender();

      expect(result.current.latestSelectedCheckId).toBe("persistent-check");
    });

    it("multiple consumers share same selection state", () => {
      function Consumer1() {
        const { latestSelectedCheckId } = useRecceCheckContext();
        return <span data-testid="consumer-1">{latestSelectedCheckId}</span>;
      }

      function Consumer2() {
        const { latestSelectedCheckId, setLatestSelectedCheckId } =
          useRecceCheckContext();
        return (
          <div>
            <span data-testid="consumer-2">{latestSelectedCheckId}</span>
            <button
              type="button"
              onClick={() => setLatestSelectedCheckId("shared-check")}
              data-testid="set-shared"
            >
              Set Shared
            </button>
          </div>
        );
      }

      render(
        <RecceCheckContextProvider>
          <Consumer1 />
          <Consumer2 />
        </RecceCheckContextProvider>,
      );

      // Both consumers start with empty selection
      expect(screen.getByTestId("consumer-1")).toHaveTextContent("");
      expect(screen.getByTestId("consumer-2")).toHaveTextContent("");

      // Update from Consumer2
      act(() => {
        screen.getByTestId("set-shared").click();
      });

      // Both consumers should see the update
      expect(screen.getByTestId("consumer-1")).toHaveTextContent(
        "shared-check",
      );
      expect(screen.getByTestId("consumer-2")).toHaveTextContent(
        "shared-check",
      );
    });
  });

  describe("context interface", () => {
    it("exports CheckContext interface type", () => {
      // This test verifies the interface exists and has expected shape
      // The type checking happens at compile time, this is a runtime sanity check
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      const contextKeys = Object.keys(result.current);
      expect(contextKeys).toContain("latestSelectedCheckId");
      expect(contextKeys).toContain("setLatestSelectedCheckId");
      expect(contextKeys.length).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("handles special characters in check ID", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      const specialId = "check-123-!@#$%^&*()_+-=[]{}|;':\",./<>?";

      act(() => {
        result.current.setLatestSelectedCheckId(specialId);
      });

      expect(result.current.latestSelectedCheckId).toBe(specialId);
    });

    it("handles very long check ID", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      const longId = "check-" + "x".repeat(1000);

      act(() => {
        result.current.setLatestSelectedCheckId(longId);
      });

      expect(result.current.latestSelectedCheckId).toBe(longId);
    });

    it("handles setting same ID twice", () => {
      const { result } = renderHook(() => useRecceCheckContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLatestSelectedCheckId("same-check");
      });
      expect(result.current.latestSelectedCheckId).toBe("same-check");

      act(() => {
        result.current.setLatestSelectedCheckId("same-check");
      });
      expect(result.current.latestSelectedCheckId).toBe("same-check");
    });
  });
});
