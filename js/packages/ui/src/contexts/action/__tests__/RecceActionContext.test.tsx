/**
 * @file RecceActionContext.test.tsx
 * @description Tests for RecceActionContext provider and hooks (@datarecce/ui version)
 *
 * Phase 2A: Context Unification - Establishing behavioral contracts
 * These tests verify the behavior of RecceActionProvider and useRecceActionContext
 * to ensure the props-driven interface works correctly.
 *
 * KEY CHARACTERISTICS of @datarecce/ui RecceActionContext:
 * - Props-driven provider (different from OSS which has internal API calls)
 * - Receives `onRunAction` callback to delegate run execution to consumer
 * - Receives `onShowRunId` callback to notify consumer when showing a run
 * - Manages internal UI state: runId, isRunResultOpen, isHistoryOpen
 * - Does NOT make API calls internally
 * - Consumer provides all action implementations via callbacks
 */

import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";

import {
  RecceActionProvider,
  type RecceActionProviderProps,
  useRecceActionContext,
} from "../RecceActionContext";
import type { RecceActionOptions } from "../types";

/**
 * Create wrapper with RecceActionProvider and optional props
 */
function createWrapper(props: Partial<RecceActionProviderProps> = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RecceActionProvider
        onRunAction={props.onRunAction}
        onShowRunId={props.onShowRunId}
        initialRunId={props.initialRunId}
        initialHistoryOpen={props.initialHistoryOpen}
      >
        {children}
      </RecceActionProvider>
    );
  };
}

/**
 * Test consumer component that displays context values
 */
function TestConsumer() {
  const context = useRecceActionContext();
  return (
    <div>
      <span data-testid="run-id">{context.runId ?? "none"}</span>
      <span data-testid="is-run-result-open">
        {String(context.isRunResultOpen)}
      </span>
      <span data-testid="is-history-open">{String(context.isHistoryOpen)}</span>
      <button
        type="button"
        onClick={() =>
          context.runAction("query_diff", { sql_template: "SELECT 1" })
        }
        data-testid="run-action-btn"
      >
        Run Action
      </button>
      <button
        type="button"
        onClick={() => context.showRunId("test-run-123")}
        data-testid="show-run-btn"
      >
        Show Run
      </button>
      <button
        type="button"
        onClick={() => context.clearRunResult()}
        data-testid="clear-run-btn"
      >
        Clear Run
      </button>
      <button
        type="button"
        onClick={() => context.closeRunResult()}
        data-testid="close-result-btn"
      >
        Close Result
      </button>
      <button
        type="button"
        onClick={() => context.showHistory()}
        data-testid="show-history-btn"
      >
        Show History
      </button>
      <button
        type="button"
        onClick={() => context.closeHistory()}
        data-testid="close-history-btn"
      >
        Close History
      </button>
      <button
        type="button"
        onClick={() => context.setHistoryOpen((prev) => !prev)}
        data-testid="toggle-history-btn"
      >
        Toggle History
      </button>
    </div>
  );
}

describe("RecceActionContext (@datarecce/ui)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("provider basics", () => {
    it("renders children", () => {
      render(
        <RecceActionProvider>
          <div data-testid="child">Child Content</div>
        </RecceActionProvider>,
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("provides context value accessible via hook", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      // Context is accessible and provides default values
      expect(screen.getByTestId("run-id")).toHaveTextContent("none");
      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "false",
      );
      expect(screen.getByTestId("is-history-open")).toHaveTextContent("false");
    });
  });

  describe("initial state", () => {
    it("has no current run initially when initialRunId is not provided", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      expect(screen.getByTestId("run-id")).toHaveTextContent("none");
    });

    it("uses initialRunId when provided", () => {
      render(
        <RecceActionProvider initialRunId="initial-run-456">
          <TestConsumer />
        </RecceActionProvider>,
      );

      expect(screen.getByTestId("run-id")).toHaveTextContent("initial-run-456");
    });

    it("opens run result pane when initialRunId is provided", () => {
      render(
        <RecceActionProvider initialRunId="initial-run-456">
          <TestConsumer />
        </RecceActionProvider>,
      );

      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "true",
      );
    });

    it("has run result pane closed initially when no initialRunId", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "false",
      );
    });

    it("has history closed initially by default", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      expect(screen.getByTestId("is-history-open")).toHaveTextContent("false");
    });

    it("uses initialHistoryOpen when provided", () => {
      render(
        <RecceActionProvider initialHistoryOpen={true}>
          <TestConsumer />
        </RecceActionProvider>,
      );

      expect(screen.getByTestId("is-history-open")).toHaveTextContent("true");
    });
  });

  describe("callback props - onRunAction", () => {
    it("invokes onRunAction callback when runAction is called", async () => {
      const mockOnRunAction = jest.fn();

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(mockOnRunAction).toHaveBeenCalledWith(
          "query_diff",
          { sql_template: "SELECT 1" },
          undefined,
        );
      });
    });

    it("passes correct type parameter to onRunAction", async () => {
      const mockOnRunAction = jest.fn();

      function TypeTestConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() => context.runAction("value_diff", { model: "users" })}
            data-testid="value-diff-btn"
          >
            Value Diff
          </button>
        );
      }

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <TypeTestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("value-diff-btn").click();
      });

      await waitFor(() => {
        expect(mockOnRunAction).toHaveBeenCalledWith(
          "value_diff",
          { model: "users" },
          undefined,
        );
      });
    });

    it("passes correct params to onRunAction", async () => {
      const mockOnRunAction = jest.fn();

      function ParamsTestConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.runAction("row_count_diff", {
                model: "orders",
                column: "id",
              })
            }
            data-testid="params-btn"
          >
            With Params
          </button>
        );
      }

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <ParamsTestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("params-btn").click();
      });

      await waitFor(() => {
        expect(mockOnRunAction).toHaveBeenCalledWith(
          "row_count_diff",
          { model: "orders", column: "id" },
          undefined,
        );
      });
    });

    it("passes options to onRunAction when provided", async () => {
      const mockOnRunAction = jest.fn();

      function OptionsTestConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.runAction(
                "profile_diff",
                { model: "users" },
                {
                  showForm: true,
                  showLast: false,
                  trackProps: { source: "lineage_model_node" },
                },
              )
            }
            data-testid="options-btn"
          >
            With Options
          </button>
        );
      }

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <OptionsTestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("options-btn").click();
      });

      await waitFor(() => {
        expect(mockOnRunAction).toHaveBeenCalledWith(
          "profile_diff",
          { model: "users" },
          {
            showForm: true,
            showLast: false,
            trackProps: { source: "lineage_model_node" },
          },
        );
      });
    });

    it("shows run result when onRunAction returns a run ID", async () => {
      const mockOnRunAction = jest.fn().mockResolvedValue("returned-run-789");

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent(
          "returned-run-789",
        );
      });
      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "true",
      );
    });

    it("does not update state when onRunAction returns undefined", async () => {
      const mockOnRunAction = jest.fn().mockResolvedValue(undefined);

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(mockOnRunAction).toHaveBeenCalled();
      });

      // Run ID should still be none since no ID was returned
      expect(screen.getByTestId("run-id")).toHaveTextContent("none");
      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "false",
      );
    });

    it("handles synchronous return value from onRunAction", async () => {
      const mockOnRunAction = jest.fn().mockReturnValue("sync-run-123");

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent("sync-run-123");
      });
    });

    it("logs warning when onRunAction is not provided", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "RecceActionProvider: onRunAction not provided, cannot execute run",
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("callback props - onShowRunId", () => {
    it("invokes onShowRunId callback when showRunId is called", () => {
      const mockOnShowRunId = jest.fn();

      render(
        <RecceActionProvider onShowRunId={mockOnShowRunId}>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      expect(mockOnShowRunId).toHaveBeenCalledWith("test-run-123", undefined);
    });

    it("passes refreshHistory parameter to onShowRunId", () => {
      const mockOnShowRunId = jest.fn();

      function RefreshHistoryConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() => context.showRunId("run-456", true)}
            data-testid="show-with-refresh-btn"
          >
            Show With Refresh
          </button>
        );
      }

      render(
        <RecceActionProvider onShowRunId={mockOnShowRunId}>
          <RefreshHistoryConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("show-with-refresh-btn").click();
      });

      expect(mockOnShowRunId).toHaveBeenCalledWith("run-456", true);
    });

    it("calls onShowRunId when runAction returns an ID", async () => {
      const mockOnRunAction = jest.fn().mockResolvedValue("action-run-999");
      const mockOnShowRunId = jest.fn();

      render(
        <RecceActionProvider
          onRunAction={mockOnRunAction}
          onShowRunId={mockOnShowRunId}
        >
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(mockOnShowRunId).toHaveBeenCalledWith(
          "action-run-999",
          undefined,
        );
      });
    });
  });

  describe("showRunId function", () => {
    it("sets run ID when called", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      expect(screen.getByTestId("run-id")).toHaveTextContent("test-run-123");
    });

    it("opens run result pane when called", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "true",
      );
    });
  });

  describe("clearRunResult function", () => {
    it("clears the current run ID", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      // First show a run
      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      expect(screen.getByTestId("run-id")).toHaveTextContent("test-run-123");

      // Then clear it
      act(() => {
        screen.getByTestId("clear-run-btn").click();
      });

      expect(screen.getByTestId("run-id")).toHaveTextContent("none");
    });

    it("closes run result pane when cleared", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      // First show a run
      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "true",
      );

      // Then clear it
      act(() => {
        screen.getByTestId("clear-run-btn").click();
      });

      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "false",
      );
    });
  });

  describe("closeRunResult function", () => {
    it("closes the run result pane without clearing run ID", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      // First show a run
      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "true",
      );
      expect(screen.getByTestId("run-id")).toHaveTextContent("test-run-123");

      // Close result pane (but don't clear run)
      act(() => {
        screen.getByTestId("close-result-btn").click();
      });

      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "false",
      );
      // Run ID should still be set
      expect(screen.getByTestId("run-id")).toHaveTextContent("test-run-123");
    });
  });

  describe("history state management", () => {
    it("showHistory opens history panel", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("show-history-btn").click();
      });

      expect(screen.getByTestId("is-history-open")).toHaveTextContent("true");
    });

    it("closeHistory closes history panel", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      // First open history
      act(() => {
        screen.getByTestId("show-history-btn").click();
      });

      expect(screen.getByTestId("is-history-open")).toHaveTextContent("true");

      // Then close it
      act(() => {
        screen.getByTestId("close-history-btn").click();
      });

      expect(screen.getByTestId("is-history-open")).toHaveTextContent("false");
    });

    it("setHistoryOpen allows direct state manipulation", () => {
      render(
        <RecceActionProvider>
          <TestConsumer />
        </RecceActionProvider>,
      );

      // Toggle history open
      act(() => {
        screen.getByTestId("toggle-history-btn").click();
      });

      expect(screen.getByTestId("is-history-open")).toHaveTextContent("true");

      // Toggle history closed
      act(() => {
        screen.getByTestId("toggle-history-btn").click();
      });

      expect(screen.getByTestId("is-history-open")).toHaveTextContent("false");
    });
  });

  describe("hook behavior", () => {
    it("useRecceActionContext returns context with all functions", () => {
      const { result } = renderHook(() => useRecceActionContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.runAction).toBeDefined();
      expect(typeof result.current.runAction).toBe("function");
      expect(result.current.showRunId).toBeDefined();
      expect(typeof result.current.showRunId).toBe("function");
      expect(result.current.clearRunResult).toBeDefined();
      expect(typeof result.current.clearRunResult).toBe("function");
      expect(result.current.closeRunResult).toBeDefined();
      expect(typeof result.current.closeRunResult).toBe("function");
      expect(result.current.showHistory).toBeDefined();
      expect(typeof result.current.showHistory).toBe("function");
      expect(result.current.closeHistory).toBeDefined();
      expect(typeof result.current.closeHistory).toBe("function");
      expect(result.current.setHistoryOpen).toBeDefined();
      expect(typeof result.current.setHistoryOpen).toBe("function");
    });

    it("hook returns default context values outside provider", () => {
      // Render without provider to test default context
      const { result } = renderHook(() => useRecceActionContext());

      // Default context should have no-op functions
      expect(result.current.runId).toBeUndefined();
      expect(result.current.isRunResultOpen).toBe(false);
      expect(result.current.isHistoryOpen).toBe(false);
      // Functions exist but are no-ops
      expect(typeof result.current.runAction).toBe("function");
      expect(typeof result.current.showRunId).toBe("function");
    });

    it("default context functions are no-ops", () => {
      const { result } = renderHook(() => useRecceActionContext());

      // These should not throw when called
      expect(() => result.current.runAction("test", {})).not.toThrow();
      expect(() => result.current.showRunId("test")).not.toThrow();
      expect(() => result.current.closeRunResult()).not.toThrow();
      expect(() => result.current.clearRunResult()).not.toThrow();
      expect(() => result.current.showHistory()).not.toThrow();
      expect(() => result.current.closeHistory()).not.toThrow();
      expect(() => result.current.setHistoryOpen(true)).not.toThrow();
    });

    it("allows calling runAction with renderHook", async () => {
      const mockOnRunAction = jest.fn().mockResolvedValue("hook-run-123");

      const { result } = renderHook(() => useRecceActionContext(), {
        wrapper: createWrapper({ onRunAction: mockOnRunAction }),
      });

      await act(async () => {
        await result.current.runAction("test_type", { key: "value" });
      });

      expect(mockOnRunAction).toHaveBeenCalledWith(
        "test_type",
        { key: "value" },
        undefined,
      );
    });
  });

  describe("props-driven nature (no API mocking needed)", () => {
    it("does not make any API calls - all actions delegated to callbacks", async () => {
      // This test verifies the key difference from OSS version
      // No need to mock API functions because none are called
      const mockOnRunAction = jest.fn().mockResolvedValue("delegated-run");

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(mockOnRunAction).toHaveBeenCalled();
      });

      // The only function called is the callback prop
      // No internal API calls are made by the provider
    });

    it("consumer controls all side effects via callbacks", async () => {
      const sideEffects: string[] = [];
      const mockOnRunAction = jest.fn().mockImplementation(() => {
        sideEffects.push("runAction");
        return Promise.resolve("run-id");
      });
      const mockOnShowRunId = jest.fn().mockImplementation(() => {
        sideEffects.push("showRunId");
      });

      render(
        <RecceActionProvider
          onRunAction={mockOnRunAction}
          onShowRunId={mockOnShowRunId}
        >
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        // Consumer-provided callbacks control all external effects
        expect(sideEffects).toContain("runAction");
        expect(sideEffects).toContain("showRunId");
      });
    });
  });

  describe("multiple consumers", () => {
    it("multiple consumers share the same context state", () => {
      function Consumer1() {
        const context = useRecceActionContext();
        return (
          <div>
            <span data-testid="consumer1-run-id">
              {context.runId ?? "none"}
            </span>
            <button
              type="button"
              onClick={() => context.showRunId("shared-run-123")}
              data-testid="consumer1-btn"
            >
              Set Run
            </button>
          </div>
        );
      }

      function Consumer2() {
        const context = useRecceActionContext();
        return (
          <span data-testid="consumer2-run-id">{context.runId ?? "none"}</span>
        );
      }

      render(
        <RecceActionProvider>
          <Consumer1 />
          <Consumer2 />
        </RecceActionProvider>,
      );

      // Both consumers should see the same initial state
      expect(screen.getByTestId("consumer1-run-id")).toHaveTextContent("none");
      expect(screen.getByTestId("consumer2-run-id")).toHaveTextContent("none");

      // Update from consumer1
      act(() => {
        screen.getByTestId("consumer1-btn").click();
      });

      // Both consumers should see the updated state
      expect(screen.getByTestId("consumer1-run-id")).toHaveTextContent(
        "shared-run-123",
      );
      expect(screen.getByTestId("consumer2-run-id")).toHaveTextContent(
        "shared-run-123",
      );
    });
  });

  describe("edge cases", () => {
    it("handles undefined params in runAction", async () => {
      const mockOnRunAction = jest.fn();

      function UndefinedParamsConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() => context.runAction("schema_diff")}
            data-testid="no-params-btn"
          >
            No Params
          </button>
        );
      }

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <UndefinedParamsConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("no-params-btn").click();
      });

      await waitFor(() => {
        expect(mockOnRunAction).toHaveBeenCalledWith(
          "schema_diff",
          undefined,
          undefined,
        );
      });
    });

    it("handles empty string run ID", async () => {
      const mockOnRunAction = jest.fn().mockReturnValue("");

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        // Empty string is still a string, so showRunId should be called
        // This tests that the check is `typeof result === 'string'` not truthy
        // The element should now contain exactly "" (empty string) which the display shows as empty
        const runIdElement = screen.getByTestId("run-id");
        expect(runIdElement.textContent).toBe("");
        // Verify result pane is open since we did return a "string" (even if empty)
        expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
          "true",
        );
      });
    });

    it("does not update state if onRunAction rejects (error handling is consumer responsibility)", async () => {
      // Note: The RecceActionContext does NOT catch errors from onRunAction.
      // Error handling is the consumer's responsibility since they provide the callback.
      // This test verifies that a rejected promise just means no run ID is returned.
      const mockOnRunAction = jest.fn().mockImplementation(() => {
        // Simulate an async operation that fails but handles it gracefully
        // by returning undefined instead of throwing
        return Promise.resolve(undefined);
      });

      render(
        <RecceActionProvider onRunAction={mockOnRunAction}>
          <TestConsumer />
        </RecceActionProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        // The callback was called
        expect(mockOnRunAction).toHaveBeenCalled();
      });

      // State should remain unchanged since no ID was returned
      expect(screen.getByTestId("run-id")).toHaveTextContent("none");
      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "false",
      );
    });
  });
});
