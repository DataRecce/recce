/**
 * @file RecceActionContext.test.tsx
 * @description Tests for RecceActionContext provider and hooks (OSS version)
 *
 * Phase 2A: Context Unification - Establishing behavioral contracts
 * These tests verify the behavior of RecceActionContextProvider and useRecceActionContext
 * to ensure nothing breaks during migration.
 *
 * KEY CHARACTERISTICS of OSS RecceActionContext:
 * - Has internal `runAction(type, params, options)` function
 * - Manages `runId` state for current run
 * - Manages `isRunResultOpen` state for result pane visibility
 * - Manages `isHistoryOpen` state for history drawer
 * - Embeds `<RunModal />` component for run form display
 * - Uses `useQueryClient` for cache invalidation
 * - Uses `useAppLocation` for routing
 * - Uses `findByRunType` registry lookup
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

// Mock the API functions
jest.mock("../../api/runs", () => ({
  submitRun: jest.fn(),
  searchRuns: jest.fn(),
}));

// Mock the toaster
jest.mock("@/components/ui/toaster", () => ({
  toaster: {
    create: jest.fn(),
  },
}));

// Mock the ApiConfigContext
jest.mock("../ApiConfigContext", () => ({
  useApiConfig: jest.fn(() => ({
    apiPrefix: "",
    authToken: undefined,
    apiClient: {
      post: jest.fn(),
      get: jest.fn(),
    },
  })),
}));

// Mock the run registry
jest.mock("@/components/run/registry", () => ({
  findByRunType: jest.fn((type: string) => ({
    title: `${type} Title`,
    icon: () => null,
    RunResultView: () => <div>Result View</div>,
    RunForm: undefined,
  })),
}));

// Mock useAppLocation
jest.mock("../useAppRouter", () => ({
  useAppLocation: jest.fn(() => ["/lineage", jest.fn()]),
}));

// Mock RunModal component
jest.mock("@/components/run/RunModal", () => ({
  RunModal: jest.fn(({ isOpen, onClose, title }) =>
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

import { findByRunType } from "@/components/run/registry";
import { toaster } from "@/components/ui/toaster";
import { searchRuns, submitRun } from "../../api/runs";
import {
  RecceActionContextProvider,
  useRecceActionContext,
} from "../RecceActionContext";
import { useAppLocation } from "../useAppRouter";

const mockSubmitRun = submitRun as jest.MockedFunction<typeof submitRun>;
const mockSearchRuns = searchRuns as jest.MockedFunction<typeof searchRuns>;
// Use jest.Mock directly to avoid strict typing issues with complex generic types
const mockFindByRunType = findByRunType as jest.Mock;
const mockToaster = toaster as jest.Mocked<typeof toaster>;
const mockUseAppLocation = useAppLocation as jest.MockedFunction<
  typeof useAppLocation
>;

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
        <RecceActionContextProvider>{children}</RecceActionContextProvider>
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

describe("RecceActionContext (OSS)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset location mock
    const mockSetLocation = jest.fn();
    mockUseAppLocation.mockReturnValue(["/lineage", mockSetLocation]);
  });

  describe("provider basics", () => {
    it("renders children", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionContextProvider>
            <div data-testid="child">Child Content</div>
          </RecceActionContextProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("provides context value accessible via hook", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("run-id")).toHaveTextContent("none");
    });

    it("has run result pane closed initially", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <FormTestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <ShowLastTestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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

    it("hook returns default context values outside provider", () => {
      // Render without provider to test default context
      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useRecceActionContext(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      // Default context functions should be no-ops
      expect(result.current.runId).toBeUndefined();
      expect(result.current.isRunResultOpen).toBe(false);
      expect(result.current.isHistoryOpen).toBe(false);
      // Functions exist but are no-ops
      expect(typeof result.current.runAction).toBe("function");
      expect(typeof result.current.showRunId).toBe("function");
    });
  });

  describe("integration with RunModal", () => {
    it("modal is not rendered when no action is set", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <ModalTestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <NoResultViewConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TestConsumer />
          </RecceActionContextProvider>
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
          <RecceActionContextProvider>
            <TrackPropsConsumer />
          </RecceActionContextProvider>
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
