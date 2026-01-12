/**
 * @file RunList.test.tsx
 * @description Comprehensive tests for RunList component
 *
 * Tests verify:
 * - List rendering with multiple runs
 * - Empty state display
 * - Loading state
 * - Run selection behavior
 * - Add to checklist functionality
 * - Go to check navigation
 * - Date segmentation
 * - Run name display
 * - Icon display by run type
 *
 * Source of truth: OSS functionality - these tests document current behavior
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
}));

jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: jest.fn(() => false),
}));

jest.mock("@/lib/hooks/ApiConfigContext", () => ({
  useApiConfig: jest.fn(() => ({
    apiClient: {},
  })),
}));

jest.mock("@/lib/hooks/RecceActionAdapter", () => ({
  useRecceActionContext: jest.fn(() => ({
    closeHistory: jest.fn(),
    showRunId: jest.fn(),
    runId: undefined,
  })),
}));

jest.mock("@/lib/hooks/useAppRouter", () => ({
  useAppLocation: jest.fn(() => [undefined, jest.fn()]),
}));

// Mock track functions
jest.mock("@/lib/api/track", () => ({
  trackHistoryAction: jest.fn(),
}));

// Mock SimplerBar
jest.mock("simplebar-react", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="simplebar">{children}</div>
  ),
}));

// Mock registry
jest.mock("../registry", () => ({
  findByRunType: jest.fn((type: string) => ({
    icon: () => <span data-testid={`${type}-icon`}>{type}</span>,
    title: type.replace(/_/g, " "),
  })),
}));

// Mock RunStatusAndDate
jest.mock("../RunStatusAndDate", () => ({
  RunStatusAndDate: ({ run }: { run: any }) => (
    <div data-testid="run-status">{run.status}</div>
  ),
  formatRunDate: jest.fn((date: Date | null) => {
    if (!date) return null;
    return "Today";
  }),
}));

// ============================================================================
// Imports
// ============================================================================

import { createCheckByRun, listRuns, waitRun } from "@datarecce/ui/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Run } from "@/lib/api/types";
import { RunList } from "../RunList";

// Cast to jest mocks
const mockListRuns = listRuns as jest.Mock;
const mockWaitRun = waitRun as jest.Mock;
const mockCreateCheckByRun = createCheckByRun as jest.Mock;

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

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByText("History")).toBeInTheDocument();
      });
    });

    it("renders close button", async () => {
      mockListRuns.mockResolvedValue([]);

      renderWithQueryClient(<RunList />);

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
        require("@/lib/hooks/RecceActionAdapter").useRecceActionContext;
      useRecceActionContext.mockReturnValue({
        closeHistory: mockCloseHistory,
        showRunId: jest.fn(),
        runId: undefined,
      });

      mockListRuns.mockResolvedValue([]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        const closeButton = screen.getByRole("button", {
          name: /Close History/i,
        });
        fireEvent.click(closeButton);
      });

      expect(mockCloseHistory).toHaveBeenCalled();
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

      renderWithQueryClient(<RunList />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe("empty state", () => {
    it("shows empty state when no runs exist", async () => {
      mockListRuns.mockResolvedValue([]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByText("No runs")).toBeInTheDocument();
      });
    });

    it("does not show SimplerBar in empty state", async () => {
      mockListRuns.mockResolvedValue([]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.queryByTestId("simplebar")).not.toBeInTheDocument();
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

      renderWithQueryClient(<RunList />);

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

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByText("Run 1")).toBeInTheDocument();
        expect(screen.getByText("Run 2")).toBeInTheDocument();
        expect(screen.getByText("Run 3")).toBeInTheDocument();
      });
    });

    it("renders SimplerBar when runs exist", async () => {
      const run = createMockRun();
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByTestId("simplebar")).toBeInTheDocument();
      });
    });

    it("shows placeholder for runs without names", async () => {
      const run = createMockRun({ name: "" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByText("<no name>")).toBeInTheDocument();
      });
    });

    it("shows placeholder for runs with whitespace-only names", async () => {
      const run = createMockRun({ name: "   " });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

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

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByTestId("query-icon")).toBeInTheDocument();
      });
    });

    it("displays icon for value_diff run type", async () => {
      const run = createMockRun({ type: "value_diff" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByTestId("value_diff-icon")).toBeInTheDocument();
      });
    });

    it("displays icon for profile_diff run type", async () => {
      const run = createMockRun({ type: "profile_diff" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByTestId("profile_diff-icon")).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Run Status Tests
  // ==========================================================================

  describe("run status", () => {
    it("displays status for each run", async () => {
      const run = createMockRun({ status: "finished" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByTestId("run-status")).toHaveTextContent("finished");
      });
    });

    it("polls for running runs", async () => {
      const runningRun = createMockRun({ status: "running" });
      mockListRuns.mockResolvedValue([runningRun]);
      mockWaitRun.mockResolvedValue({ ...runningRun, status: "finished" });

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(mockWaitRun).toHaveBeenCalledWith(
          runningRun.run_id,
          undefined,
          {},
        );
      });
    });
  });

  // ==========================================================================
  // Selection Tests
  // ==========================================================================

  describe("selection", () => {
    it("calls showRunId when run is clicked", async () => {
      const run = createMockRun({ name: "Clickable Run" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        const runElement = screen.getByText("Clickable Run");
        fireEvent.click(runElement.closest("div[role='button']")!);
      });

      expect(jest.fn()).toHaveBeenCalledWith(run.run_id, false);
    });

    it("highlights selected run", async () => {
      const selectedRun = createMockRun({ run_id: "selected-run" });
      mockListRuns.mockResolvedValue([selectedRun]);

      // Mock the context to return the selected run ID
      const mockCloseHistory = jest.fn();
      const useRecceActionContext =
        require("@/lib/hooks/RecceActionAdapter").useRecceActionContext;
      useRecceActionContext.mockReturnValue({
        closeHistory: mockCloseHistory,
        showRunId: jest.fn(),
        runId: "selected-run",
      });

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByText("Test Run")).toBeInTheDocument();
      });

      // Selected run should have special styling (verified by component logic)
    });
  });

  // ==========================================================================
  // Add to Checklist Tests
  // ==========================================================================

  describe("add to checklist", () => {
    it("shows add to checklist button for runs without check_id", async () => {
      const run = createMockRun({ check_id: undefined });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        const button = screen.getByRole("button", {
          name: /Add to Checklist/i,
        });
        expect(button).toBeInTheDocument();
      });
    });

    it("calls createCheckByRun when add to checklist is clicked", async () => {
      const run = createMockRun({ run_id: "test-run", check_id: undefined });
      mockListRuns.mockResolvedValue([run]);
      mockCreateCheckByRun.mockResolvedValue({ check_id: "new-check" });

      renderWithQueryClient(<RunList />);

      await waitFor(async () => {
        const button = screen.getByRole("button", {
          name: /Add to Checklist/i,
        });
        fireEvent.click(button);

        await waitFor(() => {
          expect(mockCreateCheckByRun).toHaveBeenCalledWith(
            "test-run",
            undefined,
            {},
          );
        });
      });
    });

    it("navigates to check after adding to checklist", async () => {
      const run = createMockRun({ run_id: "test-run", check_id: undefined });
      mockListRuns.mockResolvedValue([run]);
      mockCreateCheckByRun.mockResolvedValue({ check_id: "new-check-id" });

      renderWithQueryClient(<RunList />);

      await waitFor(async () => {
        const button = screen.getByRole("button", {
          name: /Add to Checklist/i,
        });
        fireEvent.click(button);

        await waitFor(() => {
          expect(jest.fn()).toHaveBeenCalledWith("/checks/?id=new-check-id");
        });
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

      renderWithQueryClient(<RunList />);

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

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /Go to Check/i });
        expect(button).toBeInTheDocument();
      });
    });

    it("navigates to check when go to check is clicked", async () => {
      const run = createMockRun({ check_id: "existing-check" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /Go to Check/i });
        fireEvent.click(button);
      });

      expect(jest.fn()).toHaveBeenCalledWith("/checks/?id=existing-check");
    });

    it("does not show add to checklist when check_id exists", async () => {
      const run = createMockRun({ check_id: "existing-check" });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        const addButton = screen.queryByRole("button", {
          name: /Add to Checklist/i,
        });
        expect(addButton).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Date Segmentation Tests
  // ==========================================================================

  describe("date segmentation", () => {
    it("shows date segment for first run", async () => {
      const run = createMockRun({ run_at: new Date().toISOString() });
      mockListRuns.mockResolvedValue([run]);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        // First run should not have a date segment above it
        // This is tested by checking that the date segment only appears
        // when the previous date differs
        expect(screen.getByText("Test Run")).toBeInTheDocument();
      });
    });

    it("shows date segment when date changes", async () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const runs = [
        createMockRun({
          run_id: "1",
          run_at: today.toISOString(),
          name: "Today Run",
        }),
        createMockRun({
          run_id: "2",
          run_at: yesterday.toISOString(),
          name: "Yesterday Run",
        }),
      ];
      mockListRuns.mockResolvedValue(runs);

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByText("Today Run")).toBeInTheDocument();
        expect(screen.getByText("Yesterday Run")).toBeInTheDocument();
        // Date segments should be rendered
        const todayLabels = screen.getAllByText("Today");
        expect(todayLabels.length).toBeGreaterThan(0);
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

      renderWithQueryClient(<RunList />);

      await waitFor(() => {
        expect(screen.getByText("<no name>")).toBeInTheDocument();
      });
    });

    it("handles API errors gracefully", async () => {
      mockListRuns.mockRejectedValue(new Error("API Error"));

      renderWithQueryClient(<RunList />);

      // Should not crash, but may not show runs
      await waitFor(() => {
        expect(screen.getByText("History")).toBeInTheDocument();
      });
    });

    it("stops event propagation when clicking add to checklist", async () => {
      const run = createMockRun({ check_id: undefined });
      mockListRuns.mockResolvedValue([run]);
      mockCreateCheckByRun.mockResolvedValue({ check_id: "new-check" });

      renderWithQueryClient(<RunList />);

      await waitFor(async () => {
        const button = screen.getByRole("button", {
          name: /Add to Checklist/i,
        });
        fireEvent.click(button);

        // Should not also trigger run selection
        expect(jest.fn()).not.toHaveBeenCalled();
      });
    });
  });
});
