/**
 * @file RecceQueryContext.test.tsx
 * @description Tests for RowCountStateContext provider and hook (OSS version)
 *
 * NOTE: After Phase 2A context unification, RecceQueryContext.tsx now only contains
 * RowCountStateContext. The QueryContext functionality has been moved to
 * QueryContextAdapter.tsx which uses @datarecce/ui's QueryProvider.
 *
 * RowCountStateContext manages node fetching state:
 * - `isNodesFetching: string[]` - array of node IDs currently fetching
 * - `setIsNodesFetching: (nodes: string[]) => void` - update fetching nodes
 */

import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  RowCountStateContextProvider,
  useRowCountStateContext,
} from "../RecceQueryContext";

/**
 * Test consumer component that displays row count state context values
 */
function RowCountTestConsumer() {
  const { isNodesFetching, setIsNodesFetching } = useRowCountStateContext();

  return (
    <div>
      <span data-testid="fetching-nodes">
        {JSON.stringify(isNodesFetching)}
      </span>
      <button
        type="button"
        onClick={() => setIsNodesFetching(["node-1", "node-2"])}
        data-testid="set-fetching-nodes"
      >
        Set Fetching Nodes
      </button>
      <button
        type="button"
        onClick={() => setIsNodesFetching([])}
        data-testid="clear-fetching-nodes"
      >
        Clear Fetching Nodes
      </button>
    </div>
  );
}

/**
 * Create wrapper with RowCountStateContextProvider
 */
function createRowCountWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RowCountStateContextProvider>{children}</RowCountStateContextProvider>
    );
  };
}

describe("RowCountStateContext (OSS)", () => {
  describe("provider basics", () => {
    it("renders children", () => {
      render(
        <RowCountStateContextProvider>
          <div data-testid="child">Child Content</div>
        </RowCountStateContextProvider>,
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("provides context value accessible via hook", () => {
      render(
        <RowCountStateContextProvider>
          <RowCountTestConsumer />
        </RowCountStateContextProvider>,
      );

      expect(screen.getByTestId("fetching-nodes")).toBeInTheDocument();
    });
  });

  describe("isNodesFetching state", () => {
    it("has empty array as initial isNodesFetching", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      expect(result.current.isNodesFetching).toEqual([]);
    });

    it("renders empty array for initial isNodesFetching in UI", () => {
      render(
        <RowCountStateContextProvider>
          <RowCountTestConsumer />
        </RowCountStateContextProvider>,
      );

      expect(screen.getByTestId("fetching-nodes")).toHaveTextContent("[]");
    });

    it("updates isNodesFetching when setIsNodesFetching called", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      act(() => {
        result.current.setIsNodesFetching(["node-1", "node-2", "node-3"]);
      });

      expect(result.current.isNodesFetching).toEqual([
        "node-1",
        "node-2",
        "node-3",
      ]);
    });

    it("updates isNodesFetching via click interaction", () => {
      render(
        <RowCountStateContextProvider>
          <RowCountTestConsumer />
        </RowCountStateContextProvider>,
      );

      act(() => {
        screen.getByTestId("set-fetching-nodes").click();
      });

      expect(screen.getByTestId("fetching-nodes")).toHaveTextContent(
        '["node-1","node-2"]',
      );
    });

    it("clears isNodesFetching when set to empty array", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      // First set some nodes
      act(() => {
        result.current.setIsNodesFetching(["node-1", "node-2"]);
      });
      expect(result.current.isNodesFetching).toEqual(["node-1", "node-2"]);

      // Then clear them
      act(() => {
        result.current.setIsNodesFetching([]);
      });
      expect(result.current.isNodesFetching).toEqual([]);
    });

    it("clears isNodesFetching via click interaction", () => {
      render(
        <RowCountStateContextProvider>
          <RowCountTestConsumer />
        </RowCountStateContextProvider>,
      );

      // First set some nodes
      act(() => {
        screen.getByTestId("set-fetching-nodes").click();
      });
      expect(screen.getByTestId("fetching-nodes")).toHaveTextContent(
        '["node-1","node-2"]',
      );

      // Then clear them
      act(() => {
        screen.getByTestId("clear-fetching-nodes").click();
      });
      expect(screen.getByTestId("fetching-nodes")).toHaveTextContent("[]");
    });

    it("handles single node in array", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      act(() => {
        result.current.setIsNodesFetching(["single-node"]);
      });

      expect(result.current.isNodesFetching).toEqual(["single-node"]);
    });

    it("handles many nodes in array", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      const manyNodes = Array.from({ length: 100 }, (_, i) => `node-${i}`);

      act(() => {
        result.current.setIsNodesFetching(manyNodes);
      });

      expect(result.current.isNodesFetching).toEqual(manyNodes);
      expect(result.current.isNodesFetching.length).toBe(100);
    });
  });

  describe("hook behavior", () => {
    it("useRowCountStateContext returns context with all expected values", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      expect(result.current.isNodesFetching).toBeDefined();
      expect(result.current.setIsNodesFetching).toBeDefined();
      expect(typeof result.current.setIsNodesFetching).toBe("function");
    });

    it("hook returns default context values outside provider", () => {
      const { result } = renderHook(() => useRowCountStateContext());

      expect(result.current.isNodesFetching).toEqual([]);
      expect(typeof result.current.setIsNodesFetching).toBe("function");
    });

    it("default setIsNodesFetching is a no-op outside provider", () => {
      const { result } = renderHook(() => useRowCountStateContext());

      // Should not throw when called outside provider
      expect(() => {
        result.current.setIsNodesFetching(["test-node"]);
      }).not.toThrow();

      // Value should not change (no-op)
      expect(result.current.isNodesFetching).toEqual([]);
    });
  });

  describe("state persistence", () => {
    it("isNodesFetching persists across re-renders", () => {
      const { result, rerender } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      act(() => {
        result.current.setIsNodesFetching(["persistent-node"]);
      });

      // Trigger re-render
      rerender();

      expect(result.current.isNodesFetching).toEqual(["persistent-node"]);
    });

    it("multiple consumers share same state", () => {
      function Consumer1() {
        const { isNodesFetching } = useRowCountStateContext();
        return (
          <span data-testid="consumer-1">
            {JSON.stringify(isNodesFetching)}
          </span>
        );
      }

      function Consumer2() {
        const { setIsNodesFetching } = useRowCountStateContext();
        return (
          <button
            type="button"
            onClick={() => setIsNodesFetching(["shared-node"])}
            data-testid="set-shared"
          >
            Set Shared
          </button>
        );
      }

      render(
        <RowCountStateContextProvider>
          <Consumer1 />
          <Consumer2 />
        </RowCountStateContextProvider>,
      );

      // Consumer1 starts with empty array
      expect(screen.getByTestId("consumer-1")).toHaveTextContent("[]");

      // Update from Consumer2
      act(() => {
        screen.getByTestId("set-shared").click();
      });

      // Consumer1 should see the update
      expect(screen.getByTestId("consumer-1")).toHaveTextContent(
        '["shared-node"]',
      );
    });
  });

  describe("context interface", () => {
    it("exports RowCountStateContext interface with expected shape", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      const contextKeys = Object.keys(result.current);
      expect(contextKeys).toContain("isNodesFetching");
      expect(contextKeys).toContain("setIsNodesFetching");
      expect(contextKeys.length).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("handles special characters in node IDs", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      const specialNodes = [
        "node-with-dash",
        "node_with_underscore",
        "node.with.dot",
      ];

      act(() => {
        result.current.setIsNodesFetching(specialNodes);
      });

      expect(result.current.isNodesFetching).toEqual(specialNodes);
    });

    it("handles replacing array completely", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      act(() => {
        result.current.setIsNodesFetching(["node-1", "node-2"]);
      });
      expect(result.current.isNodesFetching).toEqual(["node-1", "node-2"]);

      act(() => {
        result.current.setIsNodesFetching(["node-3", "node-4", "node-5"]);
      });
      expect(result.current.isNodesFetching).toEqual([
        "node-3",
        "node-4",
        "node-5",
      ]);
    });

    it("handles setting same array twice", () => {
      const { result } = renderHook(() => useRowCountStateContext(), {
        wrapper: createRowCountWrapper(),
      });

      act(() => {
        result.current.setIsNodesFetching(["same-node"]);
      });
      expect(result.current.isNodesFetching).toEqual(["same-node"]);

      act(() => {
        result.current.setIsNodesFetching(["same-node"]);
      });
      expect(result.current.isNodesFetching).toEqual(["same-node"]);
    });
  });
});
