/**
 * @file RecceActionAdapter.test.tsx
 * @description Tests for RecceActionAdapter - the bridge between OSS and @datarecce/ui
 *
 * The adapter wraps @datarecce/ui's RecceActionProvider and provides:
 * - OSS-specific submitRun API calls
 * - RunModal UI rendering
 * - Cache invalidation via useQueryClient
 * - findByRunType registry lookup
 *
 * These tests verify the adapter preserves all OSS RecceActionContext behaviors
 * while delegating state management to the @datarecce/ui provider.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";

// Mock the API functions from @datarecce/ui/api
jest.mock("@datarecce/ui/api", () => {
  const actual = jest.requireActual("@datarecce/ui/api");
  return {
    ...actual,
    submitRun: jest.fn(),
    searchRuns: jest.fn(),
    cacheKeys: actual.cacheKeys,
  };
});

// Mock the toaster
jest.mock("@datarecce/ui/components/ui/Toaster", () => ({
  toaster: {
    create: jest.fn(),
  },
}));

// Mock the run registry
jest.mock("@datarecce/ui/components/run", () => ({
  findByRunType: jest.fn((type: string) => ({
    title: `${type} Title`,
    icon: () => null,
    RunResultView: () => <div>Result View</div>,
    RunForm: undefined,
  })),
  RunModalOss: jest.fn(({ isOpen, onClose, title }) =>
    isOpen ? (
      <div data-testid="run-modal">
        <span data-testid="modal-title">{title}</span>
        <button type="button" onClick={onClose} data-testid="modal-close">
          Close
        </button>
      </div>
    ) : null,
  ),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/lineage"),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock RunModal component

import { searchRuns, submitRun } from "@datarecce/ui/api";
import { findByRunType } from "@datarecce/ui/components/run";
import { toaster } from "@datarecce/ui/components/ui/Toaster";
import { useRecceActionContext } from "@datarecce/ui/contexts";
import { RecceActionAdapter } from "@datarecce/ui/hooks";
import { usePathname, useRouter } from "next/navigation";

const mockSubmitRun = submitRun as jest.MockedFunction<typeof submitRun>;
const mockSearchRuns = searchRuns as jest.MockedFunction<typeof searchRuns>;
const mockFindByRunType = findByRunType as jest.Mock;
const mockToaster = toaster as jest.Mocked<typeof toaster>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

const createMockRouter = (
  overrides: Partial<ReturnType<typeof useRouter>> = {},
) => ({
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
  push: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
  ...overrides,
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/**
 * Create wrapper with all required providers
 */
function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <RecceActionAdapter>{children}</RecceActionAdapter>
      </QueryClientProvider>
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
    </div>
  );
}

describe("RecceActionAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset router mocks
    mockUsePathname.mockReturnValue("/lineage");
    mockUseRouter.mockReturnValue(createMockRouter());
  });

  describe("provider basics", () => {
    it("renders children", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <div data-testid="child">Child Content</div>
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("provides context value accessible via hook", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
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
    it("has no current run initially", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("run-id")).toHaveTextContent("none");
    });

    it("has run result pane closed initially", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "false",
      );
    });

    it("has history closed initially", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("is-history-open")).toHaveTextContent("false");
    });
  });

  describe("runAction function", () => {
    it("submits run with type and params when no form", async () => {
      mockFindByRunType.mockReturnValue({
        title: "Query Diff",
        icon: () => null,
        RunResultView: () => <div>Result</div>,
        RunForm: undefined, // No form, direct submission
      });
      mockSubmitRun.mockResolvedValue({ run_id: "new-run-123" });

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(mockSubmitRun).toHaveBeenCalledWith(
          "query_diff",
          { sql_template: "SELECT 1" },
          expect.objectContaining({ nowait: true }),
          expect.anything(),
        );
      });
    });

    it("shows run result after successful submission", async () => {
      mockFindByRunType.mockReturnValue({
        title: "Query Diff",
        icon: () => null,
        RunResultView: () => <div>Result</div>,
        RunForm: undefined,
      });
      mockSubmitRun.mockResolvedValue({ run_id: "new-run-456" });

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent("new-run-456");
      });
      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "true",
      );
    });

    it("shows toast on submission failure", async () => {
      mockFindByRunType.mockReturnValue({
        title: "Query Diff",
        icon: () => null,
        RunResultView: () => <div>Result</div>,
        RunForm: undefined,
      });
      mockSubmitRun.mockRejectedValue(new Error("Network error"));

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(mockToaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to submit a run",
            type: "error",
          }),
        );
      });
    });

    it("shows modal when RunForm is defined and showForm is true", async () => {
      const MockRunForm = () => <div data-testid="mock-run-form">Form</div>;
      mockFindByRunType.mockReturnValue({
        title: "Profile Diff",
        icon: () => null,
        RunResultView: () => <div>Result</div>,
        RunForm: MockRunForm,
      });

      const queryClient = createTestQueryClient();

      // Create consumer that triggers action with showForm: true
      function FormTestConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.runAction(
                "profile_diff",
                { model: "test" },
                { showForm: true },
              )
            }
            data-testid="run-with-form-btn"
          >
            Run With Form
          </button>
        );
      }

      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <FormTestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("run-with-form-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-modal")).toBeInTheDocument();
      });
      expect(screen.getByTestId("modal-title")).toHaveTextContent(
        "Profile Diff",
      );
    });

    it("searches for last run when showLast option is true", async () => {
      const existingRun = {
        run_id: "existing-run-789",
        type: "query_diff" as const,
        run_at: "2024-01-01T00:00:00Z",
      };
      mockSearchRuns.mockResolvedValue([existingRun]);
      mockFindByRunType.mockReturnValue({
        title: "Query Diff",
        icon: () => null,
        RunResultView: () => <div>Result</div>,
        RunForm: () => <div>Form</div>,
      });

      const queryClient = createTestQueryClient();

      function ShowLastTestConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.runAction(
                "query_diff",
                { sql_template: "SELECT 1" },
                { showForm: true, showLast: true },
              )
            }
            data-testid="run-show-last-btn"
          >
            Run Show Last
          </button>
        );
      }

      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <ShowLastTestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("run-show-last-btn").click();
      });

      await waitFor(() => {
        expect(mockSearchRuns).toHaveBeenCalledWith(
          "query_diff",
          { sql_template: "SELECT 1" },
          1,
          expect.anything(),
        );
      });
    });
  });

  describe("showRunId function", () => {
    it("sets run ID when called", async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent("test-run-123");
      });
    });

    it("opens run result pane when called", async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
          "true",
        );
      });
    });
  });

  describe("clearRunResult function", () => {
    it("clears the current run ID", async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      // First show a run
      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent("test-run-123");
      });

      // Then clear it
      act(() => {
        screen.getByTestId("clear-run-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent("none");
      });
    });

    it("closes run result pane when cleared", async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      // First show a run
      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
          "true",
        );
      });

      // Then clear it
      act(() => {
        screen.getByTestId("clear-run-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
          "false",
        );
      });
    });
  });

  describe("closeRunResult function", () => {
    it("closes the run result pane without clearing run ID", async () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      // First show a run
      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
          "true",
        );
        expect(screen.getByTestId("run-id")).toHaveTextContent("test-run-123");
      });

      // Close result pane (but don't clear run)
      act(() => {
        screen.getByTestId("close-result-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
          "false",
        );
      });
      // Run ID should still be set
      expect(screen.getByTestId("run-id")).toHaveTextContent("test-run-123");
    });
  });

  describe("history state management", () => {
    it("showHistory opens history drawer", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("show-history-btn").click();
      });

      expect(screen.getByTestId("is-history-open")).toHaveTextContent("true");
    });

    it("closeHistory closes history drawer", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
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
  });

  describe("integration with RunModal", () => {
    it("modal is not rendered when no action is set", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      expect(screen.queryByTestId("run-modal")).not.toBeInTheDocument();
    });

    it("modal is rendered when action requires form", async () => {
      const MockRunForm = () => <div>Form Content</div>;
      mockFindByRunType.mockReturnValue({
        title: "Value Diff",
        icon: () => null,
        RunResultView: () => <div>Result</div>,
        RunForm: MockRunForm,
      });

      const queryClient = createTestQueryClient();

      function ModalTestConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.runAction(
                "value_diff",
                { model: "test" },
                { showForm: true },
              )
            }
            data-testid="trigger-modal-btn"
          >
            Trigger Modal
          </button>
        );
      }

      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <ModalTestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      expect(screen.queryByTestId("run-modal")).not.toBeInTheDocument();

      act(() => {
        screen.getByTestId("trigger-modal-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-modal")).toBeInTheDocument();
      });
    });
  });

  describe("error handling", () => {
    it("handles run type without RunResultView", async () => {
      mockFindByRunType.mockReturnValue({
        title: "Schema Diff",
        icon: () => null,
        RunResultView: undefined, // No result view
        RunForm: undefined,
      });

      const queryClient = createTestQueryClient();

      function NoResultViewConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() => context.runAction("schema_diff", {})}
            data-testid="no-result-view-btn"
          >
            Run Schema Diff
          </button>
        );
      }

      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <NoResultViewConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("no-result-view-btn").click();
      });

      // Should show error toast for missing result view
      await waitFor(() => {
        expect(mockToaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to submit a run",
            type: "error",
          }),
        );
      });
    });

    it("includes error message in toast description", async () => {
      mockFindByRunType.mockReturnValue({
        title: "Query Diff",
        icon: () => null,
        RunResultView: () => <div>Result</div>,
        RunForm: undefined,
      });
      mockSubmitRun.mockRejectedValue(new Error("API timeout"));

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(mockToaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "API timeout",
          }),
        );
      });
    });
  });

  describe("timing regression tests", () => {
    /**
     * REGRESSION TEST: Verify state is set correctly with navigation on lineage paths
     *
     * This test captures a critical bug where the order of operations changed:
     * - Original: showRunId(run_id) → setLocation("/lineage")
     * - Broken: setLocation("/lineage") → return run_id → provider calls showRunId
     *
     * The incorrect order caused:
     * 1. Empty ResultView pane when running diffs
     * 2. NodeView unable to close after running profile diff
     * 3. State not being set before navigation-triggered re-renders
     *
     * The fix ensures showRunId is called BEFORE setLocation in handleRunAction,
     * and the handler returns undefined (not the run_id) to prevent double calls.
     */
    it("sets run result state and navigates when on lineage subpath", async () => {
      const mockPush = jest.fn();
      mockUsePathname.mockReturnValue("/lineage/node/test");
      mockUseRouter.mockReturnValue(createMockRouter({ push: mockPush }));

      mockFindByRunType.mockReturnValue({
        title: "Profile Diff",
        icon: () => null,
        RunResultView: () => <div>Result</div>,
        RunForm: undefined, // No form = direct submission
      });
      mockSubmitRun.mockResolvedValue({ run_id: "timing-test-run-123" });

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      // Initial state - pane should be closed
      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "false",
      );
      expect(screen.getByTestId("run-id")).toHaveTextContent("none");

      // Trigger the run action
      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      // Wait for the run to complete and state to be set
      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent(
          "timing-test-run-123",
        );
      });

      // CRITICAL: Verify both state IS set AND navigation happened
      // Before the fix, one or both of these would fail
      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "true",
      );
      expect(mockPush).toHaveBeenCalledWith("/lineage");
    });

    it("does not navigate when not on lineage path", async () => {
      const mockPush = jest.fn();
      mockUsePathname.mockReturnValue("/checks");
      mockUseRouter.mockReturnValue(createMockRouter({ push: mockPush }));

      mockFindByRunType.mockReturnValue({
        title: "Query Diff",
        icon: () => null,
        RunResultView: () => <div>Result</div>,
        RunForm: undefined,
      });
      mockSubmitRun.mockResolvedValue({ run_id: "no-nav-run-456" });

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TestConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent(
          "no-nav-run-456",
        );
      });

      // State should be set
      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "true",
      );

      // But push should NOT have been called since we're not on /lineage
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("track props", () => {
    it("passes trackProps to submitRun when provided", async () => {
      mockFindByRunType.mockReturnValue({
        title: "Query Diff",
        icon: () => null,
        RunResultView: () => <div>Result</div>,
        RunForm: undefined,
      });
      mockSubmitRun.mockResolvedValue({ run_id: "tracked-run-123" });

      const queryClient = createTestQueryClient();

      function TrackPropsConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.runAction(
                "query_diff",
                { sql_template: "SELECT 1" },
                {
                  showForm: false,
                  trackProps: {
                    source: "lineage_model_node",
                    breaking_change_analysis: true,
                  },
                },
              )
            }
            data-testid="track-props-btn"
          >
            Run With Track Props
          </button>
        );
      }

      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionAdapter>
            <TrackPropsConsumer />
          </RecceActionAdapter>
        </QueryClientProvider>,
      );

      act(() => {
        screen.getByTestId("track-props-btn").click();
      });

      await waitFor(() => {
        expect(mockSubmitRun).toHaveBeenCalledWith(
          "query_diff",
          { sql_template: "SELECT 1" },
          expect.objectContaining({
            nowait: true,
            trackProps: expect.objectContaining({
              source: "lineage_model_node",
              breaking_change_analysis: true,
            }),
          }),
          expect.anything(),
        );
      });
    });
  });
});
