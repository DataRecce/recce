/**
 * @file RunList.test.tsx
 * @description Tests for RunList OSS wrapper component
 *
 * Tests verify the OSS wrapper functionality:
 * - Data fetching integration
 * - OSS-specific tracking
 * - Context integration (RecceActionContext, RecceInstanceContext)
 * - Navigation and check creation
 *
 * Note: Presentation logic is tested in @datarecce/ui RunList tests.
 * These tests focus on OSS-specific behavior injected through the wrapper.
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @datarecce/ui/api
jest.mock("@datarecce/ui/api", () => ({
  cacheKeys: {
    runs: () => ["runs"],
    run: (runId: string) => ["run", runId],
    checks: () => ["checks"],
  },
  listRuns: jest.fn(),
  waitRun: jest.fn(),
  createCheckByRun: jest.fn(),
}));

// Mock contexts
jest.mock("@datarecce/ui/contexts", () => ({
  useRecceInstanceContext: jest.fn(() => ({
    featureToggles: {
      disableUpdateChecklist: false,
    },
  })),
  useRecceActionContext: jest.fn(() => ({
    closeHistory: jest.fn(),
    showRunId: jest.fn(),
    runId: undefined,
  })),
}));

jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: jest.fn(() => false),
}));

jest.mock("@datarecce/ui/hooks", () => ({
  useApiConfig: jest.fn(() => ({
    apiClient: {},
  })),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock track functions
jest.mock("@datarecce/ui/lib/api/track", () => ({
  EXPLORE_ACTION: {
    ROW_COUNT: "row_count",
    ROW_COUNT_DIFF: "row_count_diff",
    VALUE_DIFF: "value_diff",
  },
  EXPLORE_SOURCE: {
    LINEAGE_VIEW_TOP_BAR: "lineage_view_top_bar",
  },
  trackHistoryAction: jest.fn(),
  trackExploreAction: jest.fn(),
}));

// Mock registry
jest.mock("@datarecce/ui/components/run/RunList", () => ({
  RunList: ({
    runs,
    isLoading,
    onRunSelect,
    onAddToChecklist,
    onGoToCheck,
    getRunIcon,
    hideAddToChecklist,
    title,
    headerActions,
    emptyMessage,
    loadingMessage,
  }: {
    runs: Array<{
      id: string;
      name?: string;
      type: string;
      checkId?: string | null;
    }>;
    isLoading?: boolean;
    onRunSelect?: (runId: string) => void;
    onAddToChecklist?: (runId: string) => void;
    onGoToCheck?: (checkId: string) => void;
    getRunIcon?: (runType: string) => React.ReactNode;
    hideAddToChecklist?: boolean;
    title?: string;
    headerActions?: React.ReactNode;
    emptyMessage?: string;
    loadingMessage?: string;
  }) => (
    <div>
      <div>
        <span>{title}</span>
        {headerActions}
      </div>
      {isLoading ? (
        <div>{loadingMessage}</div>
      ) : runs.length === 0 ? (
        <div>{emptyMessage}</div>
      ) : (
        <div>
          {runs.map((run) => {
            const name =
              typeof run.name === "string" && run.name.trim().length > 0
                ? run.name
                : "<no name>";
            return (
              <div
                key={run.id}
                className="MuiBox-root"
                onClick={() => onRunSelect?.(run.id)}
              >
                <span>{name}</span>
                {getRunIcon?.(run.type)}
                {!hideAddToChecklist && !run.checkId ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddToChecklist?.(run.id);
                    }}
                  >
                    Add to Checklist
                  </button>
                ) : null}
                {run.checkId ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onGoToCheck?.(run.checkId ?? "");
                    }}
                  >
                    Go to Check
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  ),
}));

jest.mock("@datarecce/ui/components/run/registry", () => ({
  findByRunType: jest.fn((type: string) => ({
    icon: () => <span data-testid={`${type}-icon`}>{type}</span>,
    title: type.replace(/_/g, " "),
  })),
}));

// ============================================================================
// Imports
// ============================================================================

import { createCheckByRun, listRuns, type Run } from "@datarecce/ui/api";
import { RunListOss } from "@datarecce/ui/components/run";
import { trackHistoryAction } from "@datarecce/ui/lib/api/track";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Cast to jest mocks
const mockListRuns = listRuns as jest.Mock;
const mockCreateCheckByRun = createCheckByRun as jest.Mock;
const mockTrackHistoryAction = trackHistoryAction as jest.Mock;

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockRun = (overrides: Partial<Run> = {}): Run => {
  const baseRun: Run = {
    run_id: "test-run-1",
    run_at: new Date().toISOString(),
    status: "finished",
    type: "query",
    params: {},
    name: "Test Run",
    result: null,
    error: null,
    ...overrides,
  } as Run;
  return baseRun;
};

const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );
};

// ============================================================================
// Test Setup
// ============================================================================

describe("RunList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Basic Rendering Tests
  // ==========================================================================

  describe("basic rendering", () => {
    it("renders the header with title", async () => {
      mockListRuns.mockResolvedValue([]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByText("History")).toBeInTheDocument();
      });
    });

    it("renders close button", async () => {
      mockListRuns.mockResolvedValue([]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        const closeButton = screen.getByRole("button", {
          name: /Close History/i,
        });
        expect(closeButton).toBeInTheDocument();
      });
    });

    it("calls closeHistory when close button is clicked", async () => {
      const mockCloseHistory = jest.fn();
      const useRecceActionContext =
        require("@datarecce/ui/contexts").useRecceActionContext;
      useRecceActionContext.mockReturnValue({
        closeHistory: mockCloseHistory,
        showRunId: jest.fn(),
        runId: undefined,
      });

      mockListRuns.mockResolvedValue([]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        const closeButton = screen.getByRole("button", {
          name: /Close History/i,
        });
        fireEvent.click(closeButton);
      });

      expect(mockCloseHistory).toHaveBeenCalled();
    });

    it("tracks hide action when close button is clicked", async () => {
      const mockCloseHistory = jest.fn();
      const useRecceActionContext =
        require("@datarecce/ui/contexts").useRecceActionContext;
      useRecceActionContext.mockReturnValue({
        closeHistory: mockCloseHistory,
        showRunId: jest.fn(),
        runId: undefined,
      });

      mockListRuns.mockResolvedValue([]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        const closeButton = screen.getByRole("button", {
          name: /Close History/i,
        });
        fireEvent.click(closeButton);
      });

      expect(mockTrackHistoryAction).toHaveBeenCalledWith({ name: "hide" });
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe("loading state", () => {
    it("shows loading text while fetching runs", () => {
      mockListRuns.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      );

      renderWithQueryClient(<RunListOss />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe("empty state", () => {
    it("shows empty state when no runs exist", async () => {
      mockListRuns.mockResolvedValue([]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByText("No runs")).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // List Rendering Tests
  // ==========================================================================

  describe("list rendering", () => {
    it("renders single run correctly", async () => {
      const run = createMockRun({ name: "Test Query Run" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByText("Test Query Run")).toBeInTheDocument();
      });
    });

    it("renders multiple runs correctly", async () => {
      const runs = [
        createMockRun({ run_id: "1", name: "Run 1" }),
        createMockRun({ run_id: "2", name: "Run 2" }),
        createMockRun({ run_id: "3", name: "Run 3" }),
      ];
      mockListRuns.mockResolvedValue(runs);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByText("Run 1")).toBeInTheDocument();
        expect(screen.getByText("Run 2")).toBeInTheDocument();
        expect(screen.getByText("Run 3")).toBeInTheDocument();
      });
    });

    it("shows placeholder for runs without names", async () => {
      const run = createMockRun({ name: "" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByText("<no name>")).toBeInTheDocument();
      });
    });

    it("shows placeholder for runs with whitespace-only names", async () => {
      const run = createMockRun({ name: "   " });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByText("<no name>")).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Run Icon Tests
  // ==========================================================================

  describe("run icons", () => {
    it("displays icon for query run type", async () => {
      const run = createMockRun({ type: "query" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByTestId("query-icon")).toBeInTheDocument();
      });
    });

    it("displays icon for value_diff run type", async () => {
      const run = createMockRun({ type: "value_diff" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByTestId("value_diff-icon")).toBeInTheDocument();
      });
    });

    it("displays icon for profile_diff run type", async () => {
      const run = createMockRun({ type: "profile_diff" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByTestId("profile_diff-icon")).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Selection Tests
  // ==========================================================================

  describe("selection", () => {
    it("calls showRunId when run is clicked", async () => {
      const mockShowRunId = jest.fn();
      const useRecceActionContext =
        require("@datarecce/ui/contexts").useRecceActionContext;
      useRecceActionContext.mockReturnValue({
        closeHistory: jest.fn(),
        showRunId: mockShowRunId,
        runId: undefined,
      });

      const run = createMockRun({ name: "Clickable Run" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByText("Clickable Run")).toBeInTheDocument();
      });

      const runElement = screen.getByText("Clickable Run");
      const clickTarget = runElement.closest(".MuiBox-root");
      if (clickTarget) {
        fireEvent.click(clickTarget);
      }

      await waitFor(() => {
        expect(mockShowRunId).toHaveBeenCalledWith(run.run_id, false);
      });
    });

    it("tracks click_run action when run is selected", async () => {
      const mockShowRunId = jest.fn();
      const useRecceActionContext =
        require("@datarecce/ui/contexts").useRecceActionContext;
      useRecceActionContext.mockReturnValue({
        closeHistory: jest.fn(),
        showRunId: mockShowRunId,
        runId: undefined,
      });

      const run = createMockRun({ name: "Trackable Run" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByText("Trackable Run")).toBeInTheDocument();
      });

      const runElement = screen.getByText("Trackable Run");
      const clickTarget = runElement.closest(".MuiBox-root");
      if (clickTarget) {
        fireEvent.click(clickTarget);
      }

      await waitFor(() => {
        expect(mockTrackHistoryAction).toHaveBeenCalledWith({
          name: "click_run",
        });
      });
    });
  });

  // ==========================================================================
  // Add to Checklist Tests
  // ==========================================================================

  describe("add to checklist", () => {
    it("shows add to checklist button for runs without check_id", async () => {
      const run = createMockRun({ check_id: undefined });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        const element = screen.getByRole("button", {
          name: /Add to Checklist/i,
        });
        expect(element).toBeInTheDocument();
      });
    });

    it("calls createCheckByRun when add to checklist is clicked", async () => {
      const run = createMockRun({ run_id: "test-run", check_id: undefined });
      mockListRuns.mockResolvedValue([run]);
      mockCreateCheckByRun.mockResolvedValue({ check_id: "new-check" });

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Add to Checklist/i }),
        ).toBeInTheDocument();
      });

      const element = screen.getByRole("button", { name: /Add to Checklist/i });
      fireEvent.click(element);

      await waitFor(() => {
        expect(mockCreateCheckByRun).toHaveBeenCalledWith(
          "test-run",
          undefined,
          {},
        );
      });
    });

    it("tracks add_to_checklist action when button is clicked", async () => {
      const run = createMockRun({ run_id: "test-run", check_id: undefined });
      mockListRuns.mockResolvedValue([run]);
      mockCreateCheckByRun.mockResolvedValue({ check_id: "new-check" });

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Add to Checklist/i }),
        ).toBeInTheDocument();
      });

      const element = screen.getByRole("button", { name: /Add to Checklist/i });
      fireEvent.click(element);

      await waitFor(() => {
        expect(mockTrackHistoryAction).toHaveBeenCalledWith({
          name: "add_to_checklist",
        });
      });
    });

    it("navigates to check after adding to checklist", async () => {
      const mockPush = jest.fn();
      const useRouter = require("next/navigation").useRouter;
      useRouter.mockReturnValue({ push: mockPush });

      const run = createMockRun({ run_id: "test-run", check_id: undefined });
      mockListRuns.mockResolvedValue([run]);
      mockCreateCheckByRun.mockResolvedValue({ check_id: "new-check-id" });

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Add to Checklist/i }),
        ).toBeInTheDocument();
      });

      const element = screen.getByRole("button", { name: /Add to Checklist/i });
      fireEvent.click(element);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/checks/?id=new-check-id");
      });
    });

    it("hides add to checklist when feature is disabled", async () => {
      const run = createMockRun({ check_id: undefined });
      mockListRuns.mockResolvedValue([run]);

      // Mock disabled feature
      const useRecceInstanceContext =
        require("@datarecce/ui/contexts").useRecceInstanceContext;
      useRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableUpdateChecklist: true,
        },
      });

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        const button = screen.queryByRole("button", {
          name: /Add to Checklist/i,
        });
        expect(button).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Go to Check Tests
  // ==========================================================================

  describe("go to check", () => {
    it("shows go to check button for runs with check_id", async () => {
      const run = createMockRun({ check_id: "existing-check" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        const element = screen.getByRole("button", { name: /Go to Check/i });
        expect(element).toBeInTheDocument();
      });
    });

    it("navigates to check when go to check is clicked", async () => {
      const mockPush = jest.fn();
      const useRouter = require("next/navigation").useRouter;
      useRouter.mockReturnValue({ push: mockPush });

      const run = createMockRun({ check_id: "existing-check" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Go to Check/i }),
        ).toBeInTheDocument();
      });

      const element = screen.getByRole("button", { name: /Go to Check/i });
      fireEvent.click(element);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/checks/?id=existing-check");
      });
    });

    it("tracks go_to_check action when button is clicked", async () => {
      const mockPush = jest.fn();
      const useRouter = require("next/navigation").useRouter;
      useRouter.mockReturnValue({ push: mockPush });

      const run = createMockRun({ check_id: "existing-check" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Go to Check/i }),
        ).toBeInTheDocument();
      });

      const element = screen.getByRole("button", { name: /Go to Check/i });
      fireEvent.click(element);

      await waitFor(() => {
        expect(mockTrackHistoryAction).toHaveBeenCalledWith({
          name: "go_to_check",
        });
      });
    });

    it("does not show add to checklist when check_id exists", async () => {
      const run = createMockRun({ check_id: "existing-check" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        const addButton = screen.queryByRole("button", {
          name: /Add to Checklist/i,
        });
        expect(addButton).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles runs with missing data gracefully", async () => {
      const run = {
        run_id: "incomplete-run",
        run_at: new Date().toISOString(),
        type: "query" as const,
        params: {},
      };
      mockListRuns.mockResolvedValue([run as Run]);

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(screen.getByText("<no name>")).toBeInTheDocument();
      });
    });

    it("handles API errors gracefully", async () => {
      mockListRuns.mockRejectedValue(new Error("API Error"));

      renderWithQueryClient(<RunListOss />);

      // Should not crash, but may not show runs
      await waitFor(() => {
        expect(screen.getByText("History")).toBeInTheDocument();
      });
    });

    it("stops event propagation when clicking add to checklist", async () => {
      const mockShowRunId = jest.fn();
      const useRecceActionContext =
        require("@datarecce/ui/contexts").useRecceActionContext;
      useRecceActionContext.mockReturnValue({
        closeHistory: jest.fn(),
        showRunId: mockShowRunId,
        runId: undefined,
      });

      // Ensure the feature toggle is set correctly (may have been modified by previous test)
      const useRecceInstanceContext =
        require("@datarecce/ui/contexts").useRecceInstanceContext;
      useRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableUpdateChecklist: false,
        },
      });

      const run = createMockRun({ check_id: undefined });
      mockListRuns.mockResolvedValue([run]);
      mockCreateCheckByRun.mockResolvedValue({ check_id: "new-check" });

      renderWithQueryClient(<RunListOss />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Add to Checklist/i }),
        ).toBeInTheDocument();
      });

      const element = screen.getByRole("button", { name: /Add to Checklist/i });
      fireEvent.click(element);

      // Should not also trigger run selection (event propagation stopped)
      expect(mockShowRunId).not.toHaveBeenCalled();
    });
  });
});
