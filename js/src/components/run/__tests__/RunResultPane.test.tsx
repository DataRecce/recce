/**
 * @file RunResultPane.test.tsx
 * @description Comprehensive tests for RunResultPane component
 *
 * Tests verify:
 * - Tab navigation (Result, Params, Query)
 * - Run status display
 * - Rerun functionality
 * - Export menu options
 * - Share menu options
 * - Add to checklist functionality
 * - Single environment notifications
 * - SQL editor display for query types
 * - Close functionality
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @datarecce/ui/api - use require to avoid hoisting issues
jest.mock("@datarecce/ui/api", () => {
  const mockFn = jest.fn();
  return {
    cacheKeys: {
      checks: () => ["checks"],
    },
    createCheckByRun: mockFn,
    isQueryRun: jest.fn((run: Record<string, unknown>) => run.type === "query"),
    isQueryBaseRun: jest.fn(
      (run: Record<string, unknown>) => run.type === "query_base",
    ),
    isQueryDiffRun: jest.fn(
      (run: Record<string, unknown>) => run.type === "query_diff",
    ),
  };
});

// Mock contexts
jest.mock("@datarecce/ui/contexts", () => ({
  useRecceInstanceContext: jest.fn(() => ({
    featureToggles: {
      disableDatabaseQuery: false,
      disableShare: false,
      disableUpdateChecklist: false,
    },
    authed: false,
  })),
}));

jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: jest.fn(() => false),
}));

// Mock CodeEditor
jest.mock("@datarecce/ui/primitives", () => ({
  CodeEditor: ({ value }: { value: string }) => (
    <div data-testid="code-editor">{value}</div>
  ),
}));

const mockRunAction = jest.fn();
jest.mock("@/lib/hooks/RecceActionAdapter", () => ({
  useRecceActionContext: jest.fn(() => ({
    runAction: mockRunAction,
    runId: "test-run-id",
  })),
}));

jest.mock("@/lib/hooks/ApiConfigContext", () => ({
  useApiConfig: jest.fn(() => ({
    apiClient: {},
  })),
}));

const mockSetLocation = jest.fn();
jest.mock("@/lib/hooks/useAppRouter", () => ({
  useAppLocation: jest.fn(() => [undefined, mockSetLocation]),
}));

// Mock useRun hook
const mockOnCancel = jest.fn();
jest.mock("@/lib/hooks/useRun", () => ({
  useRun: jest.fn((runId?: string) => ({
    error: null,
    run: runId
      ? {
          run_id: runId,
          type: "query",
          params: { sql_template: "SELECT * FROM table" },
          status: "finished",
          result: { data: "test" },
          run_at: new Date().toISOString(),
          name: "Test Run",
        }
      : undefined,
    onCancel: mockOnCancel,
    isRunning: false,
  })),
}));

// Mock CSV export hook
jest.mock("@/lib/hooks/useCSVExport", () => ({
  useCSVExport: jest.fn(() => ({
    canExportCSV: true,
    copyAsCSV: jest.fn(),
    downloadAsCSV: jest.fn(),
  })),
}));

// Mock screenshot hook
jest.mock("@/lib/hooks/ScreenShot", () => ({
  useCopyToClipboardButton: jest.fn(() => ({
    ref: { current: null },
    onCopyToClipboard: jest.fn(),
    onMouseEnter: jest.fn(),
    onMouseLeave: jest.fn(),
  })),
}));

// Mock share state context
jest.mock("@/lib/hooks/RecceShareStateContext", () => ({
  useRecceShareStateContext: jest.fn(() => ({
    handleShareClick: jest.fn(),
  })),
}));

// Mock track functions
jest.mock("@/lib/api/track", () => ({
  trackCopyToClipboard: jest.fn(),
  trackShareState: jest.fn(),
}));

// Mock AuthModal
jest.mock("@/components/AuthModal/AuthModal", () => ({
  __esModule: true,
  default: () => <div data-testid="auth-modal">Auth Modal</div>,
}));

// Mock notification component
jest.mock("@/components/onboarding-guide/Notification", () => ({
  LearnHowLink: () => <a href="#">Learn how</a>,
  RecceNotification: ({
    children,
    onClose,
  }: {
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <div data-testid="notification">
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SqlEditor
jest.mock("@/components/query/SqlEditor", () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => (
    <div data-testid="sql-editor">{value}</div>
  ),
  DualSqlEditor: ({
    value,
    baseValue,
  }: {
    value: string;
    baseValue: string;
  }) => (
    <div data-testid="dual-sql-editor">
      <div>{value}</div>
      <div>{baseValue}</div>
    </div>
  ),
}));

// Mock RunView
jest.mock("../RunView", () => ({
  RunView: ({ run }: { run: any }) => (
    <div data-testid="run-view">RunView: {run?.run_id}</div>
  ),
}));

// Mock RunStatusAndDate
jest.mock("../RunStatusAndDate", () => ({
  RunStatusAndDate: ({ run }: { run: any }) => (
    <div data-testid="run-status">Status: {run.status}</div>
  ),
}));

// Mock registry
jest.mock("../registry", () => ({
  findByRunType: jest.fn(() => ({
    RunResultView: () => <div>Result View</div>,
  })),
  runTypeHasRef: jest.fn(() => true),
}));

// ============================================================================
// Imports
// ============================================================================

import { createCheckByRun } from "@datarecce/ui/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RunResultPane } from "../RunResultPane";

// Get the mock function for assertions
const mockCreateCheckByRun = createCheckByRun as jest.Mock;

// ============================================================================
// Test Fixtures
// ============================================================================

const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithQueryClient = (
  component: React.ReactElement,
  queryClient?: QueryClient,
) => {
  const client = queryClient || createQueryClient();
  return render(
    <QueryClientProvider client={client}>{component}</QueryClientProvider>,
  );
};

// ============================================================================
// Test Setup
// ============================================================================

describe("RunResultPane", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Basic Rendering Tests
  // ==========================================================================

  describe("basic rendering", () => {
    it("renders tab navigation", () => {
      renderWithQueryClient(<RunResultPane />);

      expect(screen.getByRole("tab", { name: /Result/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Params/i })).toBeInTheDocument();
    });

    it("renders Query tab for query types", () => {
      renderWithQueryClient(<RunResultPane />);

      expect(screen.getByRole("tab", { name: /Query/i })).toBeInTheDocument();
    });

    it("shows Result tab by default", () => {
      renderWithQueryClient(<RunResultPane />);

      const resultTab = screen.getByRole("tab", { name: /Result/i });
      expect(resultTab).toHaveAttribute("aria-selected", "true");
    });

    it("renders run status display", () => {
      renderWithQueryClient(<RunResultPane />);

      expect(screen.getByTestId("run-status")).toBeInTheDocument();
    });

    it("renders rerun button", () => {
      renderWithQueryClient(<RunResultPane />);

      expect(
        screen.getByRole("button", { name: /Rerun/i }),
      ).toBeInTheDocument();
    });

    it("renders export/share button", () => {
      renderWithQueryClient(<RunResultPane />);

      // Share is default, Export when share is disabled
      expect(
        screen.getByRole("button", { name: /Share/i }),
      ).toBeInTheDocument();
    });

    it("renders close button", () => {
      const onClose = jest.fn();
      renderWithQueryClient(<RunResultPane onClose={onClose} />);

      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Tab Navigation Tests
  // ==========================================================================

  describe("tab navigation", () => {
    it("switches to Params tab when clicked", () => {
      renderWithQueryClient(<RunResultPane />);

      const paramsTab = screen.getByRole("tab", { name: /Params/i });
      fireEvent.click(paramsTab);

      expect(paramsTab).toHaveAttribute("aria-selected", "true");
    });

    it("displays code editor in Params tab", () => {
      renderWithQueryClient(<RunResultPane />);

      const paramsTab = screen.getByRole("tab", { name: /Params/i });
      fireEvent.click(paramsTab);

      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });

    it("switches to Query tab when clicked", () => {
      renderWithQueryClient(<RunResultPane />);

      const queryTab = screen.getByRole("tab", { name: /Query/i });
      fireEvent.click(queryTab);

      expect(queryTab).toHaveAttribute("aria-selected", "true");
    });

    it("displays SQL editor in Query tab for query type", () => {
      renderWithQueryClient(<RunResultPane />);

      const queryTab = screen.getByRole("tab", { name: /Query/i });
      fireEvent.click(queryTab);

      expect(screen.getByTestId("sql-editor")).toBeInTheDocument();
    });

    it("displays dual SQL editor for query_diff type", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: null,
        run: {
          run_id: "test-run-id",
          type: "query_diff",
          params: {
            sql_template: "SELECT * FROM current",
            base_sql_template: "SELECT * FROM base",
          },
          status: "finished",
          result: { data: "test" },
        },
        onCancel: mockOnCancel,
        isRunning: false,
      });

      renderWithQueryClient(<RunResultPane />);

      const queryTab = screen.getByRole("tab", { name: /Query/i });
      fireEvent.click(queryTab);

      expect(screen.getByTestId("dual-sql-editor")).toBeInTheDocument();
    });

    it("switches back to Result tab correctly", () => {
      renderWithQueryClient(<RunResultPane />);

      // Click Params tab
      const paramsTab = screen.getByRole("tab", { name: /Params/i });
      fireEvent.click(paramsTab);

      // Click Result tab
      const resultTab = screen.getByRole("tab", { name: /Result/i });
      fireEvent.click(resultTab);

      expect(resultTab).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("run-view")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Rerun Functionality Tests
  // ==========================================================================

  describe("rerun functionality", () => {
    it("calls runAction when rerun button is clicked", () => {
      renderWithQueryClient(<RunResultPane />);

      const rerunButton = screen.getByRole("button", { name: /Rerun/i });
      fireEvent.click(rerunButton);

      expect(mockRunAction).toHaveBeenCalledWith("query", {
        sql_template: "SELECT * FROM table",
      });
    });

    it("disables rerun button when run is running", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: null,
        run: {
          run_id: "test-run-id",
          type: "query",
          params: {},
          status: "running",
        },
        onCancel: mockOnCancel,
        isRunning: true,
      });

      renderWithQueryClient(<RunResultPane />);

      const rerunButton = screen.getByRole("button", { name: /Rerun/i });
      expect(rerunButton).toBeDisabled();
    });

    it("disables rerun button when database query is disabled", () => {
      const useRecceInstanceContext =
        require("@datarecce/ui/contexts").useRecceInstanceContext;
      useRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableDatabaseQuery: true,
          disableShare: false,
        },
      });

      renderWithQueryClient(<RunResultPane />);

      const rerunButton = screen.getByRole("button", { name: /Rerun/i });
      expect(rerunButton).toBeDisabled();
    });

    it("disables rerun button when no run exists", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: null,
        run: undefined,
        onCancel: mockOnCancel,
        isRunning: false,
      });

      renderWithQueryClient(<RunResultPane />);

      const rerunButton = screen.getByRole("button", { name: /Rerun/i });
      expect(rerunButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Export/Share Menu Tests
  // ==========================================================================

  describe("export menu", () => {
    it("shows Export button when share is disabled", () => {
      const useRecceInstanceContext =
        require("@datarecce/ui/contexts").useRecceInstanceContext;
      useRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableShare: true,
        },
      });

      renderWithQueryClient(<RunResultPane />);

      expect(
        screen.getByRole("button", { name: /Export/i }),
      ).toBeInTheDocument();
    });

    it("opens export menu when clicked", async () => {
      const useRecceInstanceContext =
        require("@datarecce/ui/contexts").useRecceInstanceContext;
      useRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableShare: true,
        },
      });

      renderWithQueryClient(<RunResultPane />);

      const exportButton = screen.getByRole("button", { name: /Export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(
          screen.getByRole("menuitem", { name: /Copy as Image/i }),
        ).toBeInTheDocument();
      });
    });

    it("shows CSV export options in menu", async () => {
      const useRecceInstanceContext =
        require("@datarecce/ui/contexts").useRecceInstanceContext;
      useRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableShare: true,
        },
      });

      renderWithQueryClient(<RunResultPane />);

      const exportButton = screen.getByRole("button", { name: /Export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(
          screen.getByRole("menuitem", { name: /Copy as CSV/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("menuitem", { name: /Download as CSV/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("share menu", () => {
    it("shows Share button by default", () => {
      renderWithQueryClient(<RunResultPane />);

      expect(
        screen.getByRole("button", { name: /Share/i }),
      ).toBeInTheDocument();
    });

    it("opens share menu when clicked", async () => {
      renderWithQueryClient(<RunResultPane />);

      const shareButton = screen.getByRole("button", { name: /Share/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(
          screen.getByRole("menuitem", { name: /Copy as Image/i }),
        ).toBeInTheDocument();
      });
    });

    it("shows Share to Cloud option when authenticated", async () => {
      const useRecceInstanceContext =
        require("@datarecce/ui/contexts").useRecceInstanceContext;
      useRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableShare: false,
        },
        authed: true,
      });

      renderWithQueryClient(<RunResultPane />);

      const shareButton = screen.getByRole("button", { name: /Share/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(
          screen.getByRole("menuitem", { name: /Share to Cloud/i }),
        ).toBeInTheDocument();
      });
    });

    it("shows Share option when not authenticated", async () => {
      renderWithQueryClient(<RunResultPane />);

      const shareButton = screen.getByRole("button", { name: /Share/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        const shareItems = screen.getAllByRole("menuitem", {
          name: /Share/i,
        });
        // Should have at least one Share menu item
        expect(shareItems.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // Add to Checklist Tests
  // ==========================================================================

  describe("add to checklist", () => {
    it("shows Add to Checklist button when run has no check_id", () => {
      renderWithQueryClient(<RunResultPane />);

      expect(
        screen.getByRole("button", { name: /Add to Checklist/i }),
      ).toBeInTheDocument();
    });

    it("shows Go to Check button when run has check_id", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: null,
        run: {
          run_id: "test-run-id",
          type: "query",
          params: {},
          status: "finished",
          result: { data: "test" },
          check_id: "existing-check",
        },
        onCancel: mockOnCancel,
        isRunning: false,
      });

      renderWithQueryClient(<RunResultPane />);

      expect(
        screen.getByRole("button", { name: /Go to Check/i }),
      ).toBeInTheDocument();
    });

    it("calls createCheckByRun when Add to Checklist is clicked", async () => {
      mockCreateCheckByRun.mockResolvedValue({ check_id: "new-check-id" });

      renderWithQueryClient(<RunResultPane />);

      const addButton = screen.getByRole("button", {
        name: /Add to Checklist/i,
      });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockCreateCheckByRun).toHaveBeenCalled();
      });
    });

    it("navigates to check after adding to checklist", async () => {
      mockCreateCheckByRun.mockResolvedValue({ check_id: "new-check-id" });

      renderWithQueryClient(<RunResultPane />);

      const addButton = screen.getByRole("button", {
        name: /Add to Checklist/i,
      });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockSetLocation).toHaveBeenCalledWith(
          "/checks/?id=new-check-id",
        );
      });
    });

    it("disables Add to Checklist when run has error", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: "Test error",
        run: {
          run_id: "test-run-id",
          type: "query",
          params: {},
          status: "failed",
          error: "Test error",
        },
        onCancel: mockOnCancel,
        isRunning: false,
      });

      renderWithQueryClient(<RunResultPane />);

      const addButton = screen.getByRole("button", {
        name: /Add to Checklist/i,
      });
      expect(addButton).toBeDisabled();
    });

    it("disables Add to Checklist when run has no result", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: null,
        run: {
          run_id: "test-run-id",
          type: "query",
          params: {},
          status: "running",
        },
        onCancel: mockOnCancel,
        isRunning: true,
      });

      renderWithQueryClient(<RunResultPane />);

      const addButton = screen.getByRole("button", {
        name: /Add to Checklist/i,
      });
      expect(addButton).toBeDisabled();
    });

    it("hides add to checklist when feature is disabled", () => {
      const useRecceInstanceContext =
        require("@datarecce/ui/contexts").useRecceInstanceContext;
      useRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableUpdateChecklist: true,
        },
      });

      renderWithQueryClient(<RunResultPane />);

      expect(
        screen.queryByRole("button", { name: /Add to Checklist/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Single Environment Notification Tests
  // ==========================================================================

  describe("single environment notifications", () => {
    it("shows notification for row_count in single env mode", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: null,
        run: {
          run_id: "test-run-id",
          type: "row_count",
          params: {},
          status: "finished",
        },
        onCancel: mockOnCancel,
        isRunning: false,
      });

      renderWithQueryClient(<RunResultPane isSingleEnvironment={true} />);

      expect(screen.getByTestId("notification")).toBeInTheDocument();
      expect(screen.getByText(/row count diffing/i)).toBeInTheDocument();
    });

    it("shows notification for profile in single env mode", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: null,
        run: {
          run_id: "test-run-id",
          type: "profile",
          params: {},
          status: "finished",
        },
        onCancel: mockOnCancel,
        isRunning: false,
      });

      renderWithQueryClient(<RunResultPane isSingleEnvironment={true} />);

      expect(screen.getByTestId("notification")).toBeInTheDocument();
      expect(screen.getByText(/data-profile diffing/i)).toBeInTheDocument();
    });

    it("does not show notification for other run types", () => {
      renderWithQueryClient(<RunResultPane isSingleEnvironment={true} />);

      expect(screen.queryByTestId("notification")).not.toBeInTheDocument();
    });

    it("allows closing notification", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: null,
        run: {
          run_id: "test-run-id",
          type: "profile",
          params: {},
          status: "finished",
        },
        onCancel: mockOnCancel,
        isRunning: false,
      });

      renderWithQueryClient(<RunResultPane isSingleEnvironment={true} />);

      const closeButton = screen.getByRole("button", { name: /Close/i });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId("notification")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Close Functionality Tests
  // ==========================================================================

  describe("close functionality", () => {
    it("calls onClose when close button is clicked", () => {
      const onClose = jest.fn();
      renderWithQueryClient(<RunResultPane onClose={onClose} />);

      const closeButton = screen.getByRole("button", { name: /close/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it("does not crash when onClose is not provided", () => {
      renderWithQueryClient(<RunResultPane />);

      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(() => fireEvent.click(closeButton)).not.toThrow();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles missing run gracefully", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: null,
        run: undefined,
        onCancel: mockOnCancel,
        isRunning: false,
      });

      renderWithQueryClient(<RunResultPane />);

      expect(screen.getByRole("tab", { name: /Result/i })).toBeInTheDocument();
    });

    it("handles run with error state", () => {
      const useRun = require("@/lib/hooks/useRun").useRun;
      useRun.mockReturnValue({
        error: "Test error message",
        run: {
          run_id: "test-run-id",
          type: "query",
          params: {},
          status: "failed",
          error: "Test error message",
        },
        onCancel: mockOnCancel,
        isRunning: false,
      });

      renderWithQueryClient(<RunResultPane />);

      expect(screen.getByTestId("run-view")).toBeInTheDocument();
    });

    it("disables export/share on Params tab", () => {
      renderWithQueryClient(<RunResultPane />);

      // Switch to Params tab
      const paramsTab = screen.getByRole("tab", { name: /Params/i });
      fireEvent.click(paramsTab);

      const shareButton = screen.getByRole("button", { name: /Share/i });
      expect(shareButton).toBeDisabled();
    });

    it("disables export/share on Query tab", () => {
      renderWithQueryClient(<RunResultPane />);

      // Switch to Query tab
      const queryTab = screen.getByRole("tab", { name: /Query/i });
      fireEvent.click(queryTab);

      const shareButton = screen.getByRole("button", { name: /Share/i });
      expect(shareButton).toBeDisabled();
    });
  });
});
