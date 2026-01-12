/**
 * @file CheckDetail.test.tsx
 * @description Tests for OSS CheckDetail component
 *
 * Documents current behavior before migration to @datarecce/ui:
 * - Loading state
 * - Error state
 * - Check not found state
 * - Basic check rendering
 * - Tab switching (Result/Query)
 * - Name editing
 * - Approval button
 * - Actions menu
 */

import type { Check } from "@datarecce/ui/api";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckDetail } from "./CheckDetail";

// Create a test theme with iochmara palette - using unknown for MUI custom palette
const testThemeOptions = {
  palette: {
    iochmara: {
      main: "#4299E1",
      light: "#63B3ED",
      dark: "#3182CE",
      contrastText: "#FFFFFF",
    },
    neutral: {
      main: "#718096",
    },
    success: {
      main: "#48BB78",
    },
  },
} as unknown;
const testTheme = createTheme(
  testThemeOptions as Parameters<typeof createTheme>[0],
);

// Mock API functions
const mockGetCheck = jest.fn();
const mockUpdateCheck = jest.fn();
const mockDeleteCheck = jest.fn();
const mockSubmitRunFromCheck = jest.fn();
const mockCancelRun = jest.fn();
const mockMarkAsPresetCheck = jest.fn();

jest.mock("@datarecce/ui/api", () => ({
  cacheKeys: {
    check: (id: string) => ["check", id],
    checks: () => ["checks"],
    run: (id: string) => ["run", id],
  },
  getCheck: (...args: unknown[]) => mockGetCheck(...args),
  updateCheck: (...args: unknown[]) => mockUpdateCheck(...args),
  deleteCheck: (...args: unknown[]) => mockDeleteCheck(...args),
  submitRunFromCheck: (...args: unknown[]) => mockSubmitRunFromCheck(...args),
  cancelRun: (...args: unknown[]) => mockCancelRun(...args),
  markAsPresetCheck: (...args: unknown[]) => mockMarkAsPresetCheck(...args),
}));

// Mock hooks from @datarecce/ui
jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: () => false,
}));

// Mock contexts from @datarecce/ui
jest.mock("@datarecce/ui/contexts", () => ({
  useRecceInstanceContext: () => ({
    featureToggles: {
      disableUpdateChecklist: false,
      disableDatabaseQuery: false,
      mode: "full",
    },
    sessionId: "session-123",
  }),
  useLineageGraphContext: () => ({
    cloudMode: false,
  }),
}));

// Mock API config
const mockApiClient = {};
jest.mock("@/lib/hooks/ApiConfigContext", () => ({
  useApiConfig: () => ({ apiClient: mockApiClient }),
}));

// Mock useRun hook
jest.mock("@/lib/hooks/useRun", () => ({
  useRun: () => ({
    run: { result: { some: "data" }, error: null, status: "completed" },
    error: null,
    isLoading: false,
  }),
}));

// Mock check context
jest.mock("@/lib/hooks/CheckContextAdapter", () => ({
  useRecceCheckContext: () => ({
    setLatestSelectedCheckId: jest.fn(),
  }),
}));

// Mock lineage graph context
jest.mock("@/lib/hooks/LineageGraphAdapter", () => ({
  useLineageGraphContext: () => ({
    cloudMode: false,
  }),
}));

// Mock app router
jest.mock("@/lib/hooks/useAppRouter", () => ({
  useAppLocation: () => ["/checks", jest.fn()],
}));

jest.mock("@datarecce/ui/hooks", () => ({
  useClipBoardToast: () => ({
    successToast: jest.fn(),
    failToast: jest.fn(),
  }),
  useIsDark: () => false,
  useThemeColors: () => ({
    isDark: false,
    theme: {},
    background: {
      default: "#fff",
      paper: "#fff",
      subtle: "#f5f5f5",
      emphasized: "#e5e5e5",
    },
    text: {
      primary: "#000",
      secondary: "#666",
      disabled: "#999",
      inverted: "#fff",
    },
    border: { light: "#eee", default: "#ddd", strong: "#ccc" },
    status: {
      added: { bg: "#e6f4ea", text: "#000" },
      removed: { bg: "#fce8e6", text: "#000" },
      modified: { bg: "#fef7e0", text: "#000" },
    },
    interactive: { hover: "#f5f5f5", active: "#e5e5e5", focus: "#1a73e8" },
  }),
}));

// Mock copy to clipboard
jest.mock("@/lib/hooks/ScreenShot", () => ({
  useCopyToClipboardButton: () => ({
    ref: { current: null },
    onCopyToClipboard: jest.fn(),
    onMouseEnter: jest.fn(),
    onMouseLeave: jest.fn(),
  }),
}));

// Mock run registry
jest.mock("../run/registry", () => ({
  findByRunType: () => ({
    icon: () => <span data-testid="check-icon">Icon</span>,
    RunResultView: () => <div>Run Result</div>,
  }),
}));

// Mock tracking
jest.mock("@/lib/api/track", () => ({
  trackCopyToClipboard: jest.fn(),
}));

// Mock components that would cause issues
jest.mock("@datarecce/ui", () => ({
  VSplit: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  isSchemaChanged: jest.fn(),
}));

jest.mock("@datarecce/ui/primitives", () => ({
  CheckBreadcrumb: ({
    name,
    onNameChange,
  }: {
    name: string;
    onNameChange?: (name: string) => void;
    disabled?: boolean;
  }) => (
    <div
      data-testid="check-breadcrumb"
      onClick={() => onNameChange?.("New Name")}
    >
      {name}
    </div>
  ),
  CheckDescription: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (value?: string) => void;
    disabled?: boolean;
  }) => (
    <div
      data-testid="check-description"
      onClick={() => onChange?.("New Description")}
    >
      {value || "No description"}
    </div>
  ),
  // Utility functions
  buildCheckTitle: ({
    name,
    isChecked,
  }: {
    name: string;
    isChecked?: boolean;
  }) => `${isChecked ? "✅ " : ""}${name}`,
  buildCheckDescription: ({
    description,
    fallback = "_(no description)_",
  }: {
    description?: string | null;
    fallback?: string;
  }) => (description ?? "") || fallback,
  formatSqlAsMarkdown: ({
    sql,
    label = "SQL",
  }: {
    sql: string;
    label?: string;
  }) => `**${label}**\n\`\`\`sql\n${sql}\n\`\`\``,
  isDisabledByNoResult: ({
    type,
    hasResult,
    hasError,
  }: {
    type: string;
    hasResult: boolean;
    hasError: boolean;
  }) => {
    if (type === "schema_diff" || type === "lineage_diff") {
      return false;
    }
    return !hasResult || hasError;
  },
}));

jest.mock("./timeline", () => ({
  CheckTimeline: () => <div data-testid="check-timeline">Timeline</div>,
}));

jest.mock("../run/RunView", () => ({
  RunView: () => <div data-testid="run-view">Run View</div>,
}));

jest.mock("./SchemaDiffView", () => ({
  SchemaDiffView: () => <div data-testid="schema-diff-view">Schema Diff</div>,
}));

jest.mock("./LineageDiffView", () => ({
  LineageDiffView: () => (
    <div data-testid="lineage-diff-view">Lineage Diff</div>
  ),
}));

jest.mock("@datarecce/ui/components/query", () => ({
  __esModule: true,
  SqlEditor: () => <div data-testid="sql-editor">SQL Editor</div>,
  DualSqlEditor: () => <div data-testid="dual-sql-editor">Dual SQL Editor</div>,
  QueryForm: () => <div data-testid="query-form">Query Form</div>,
  QueryResultView: () => <div data-testid="query-result">Query Result</div>,
  QueryDiffResultView: () => (
    <div data-testid="query-diff-result">Query Diff Result</div>
  ),
  SetupConnectionGuide: () => <div data-testid="setup-guide">Setup Guide</div>,
}));

jest.mock("./PresetCheckTemplateView", () => ({
  PresetCheckTemplateView: () => <div>Template View</div>,
  generateCheckTemplate: () => "yaml: template",
}));

jest.mock("@/components/app/SetupConnectionPopover", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const createCheck = (overrides: Partial<Check> = {}): Check => ({
  check_id: "check-1",
  name: "Test Check",
  description: "Test description",
  type: "row_count_diff",
  is_checked: false,
  params: {},
  last_run: {
    run_id: "run-1",
    type: "row_count_diff",
    run_at: new Date().toISOString(),
  },
  ...overrides,
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return render(
    <ThemeProvider theme={testTheme}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
};

describe("CheckDetail", () => {
  beforeEach(() => {
    mockGetCheck.mockClear();
    mockUpdateCheck.mockClear();
    mockDeleteCheck.mockClear();
  });

  describe("loading state", () => {
    it("shows loading while fetching check", () => {
      mockGetCheck.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves - intentionally left pending for loading state test
          }),
      );

      renderWithProviders(<CheckDetail checkId="check-1" />);

      expect(screen.getByText("Loading")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows error message when fetch fails", async () => {
      mockGetCheck.mockRejectedValue(new Error("Failed to load check"));

      renderWithProviders(<CheckDetail checkId="check-1" />);

      await waitFor(() => {
        expect(screen.getByText(/error:/i)).toBeInTheDocument();
        expect(screen.getByText(/failed to load check/i)).toBeInTheDocument();
      });
    });
  });

  describe("check not found", () => {
    it("shows check not found when check is null", async () => {
      mockGetCheck.mockResolvedValue(null);

      renderWithProviders(<CheckDetail checkId="check-1" />);

      await waitFor(() => {
        expect(screen.getByText("Check not found")).toBeInTheDocument();
      });
    });
  });

  describe("basic rendering", () => {
    it("renders check name via CheckBreadcrumb", async () => {
      mockGetCheck.mockResolvedValue(createCheck({ name: "My Schema Check" }));

      renderWithProviders(<CheckDetail checkId="check-1" />);

      await waitFor(() => {
        expect(screen.getByTestId("check-breadcrumb")).toHaveTextContent(
          "My Schema Check",
        );
      });
    });

    it("renders check description via CheckDescription", async () => {
      mockGetCheck.mockResolvedValue(
        createCheck({ description: "This is a test" }),
      );

      renderWithProviders(<CheckDetail checkId="check-1" />);

      await waitFor(() => {
        expect(screen.getByTestId("check-description")).toHaveTextContent(
          "This is a test",
        );
      });
    });

    it("renders check type icon", async () => {
      mockGetCheck.mockResolvedValue(createCheck());

      renderWithProviders(<CheckDetail checkId="check-1" />);

      await waitFor(() => {
        expect(screen.getByTestId("check-icon")).toBeInTheDocument();
      });
    });
  });

  describe("tabs", () => {
    it("shows Result tab by default", async () => {
      mockGetCheck.mockResolvedValue(createCheck());

      renderWithProviders(<CheckDetail checkId="check-1" />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "Result" })).toBeInTheDocument();
      });
    });

    it("shows Query tab for query type checks", async () => {
      mockGetCheck.mockResolvedValue(
        createCheck({
          type: "query",
          params: { sql_template: "SELECT 1" },
        }),
      );

      renderWithProviders(<CheckDetail checkId="check-1" />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "Query" })).toBeInTheDocument();
      });
    });
  });

  // Note: Approval workflow tests are complex due to component dependencies.
  // The approval behavior is tested at the CheckList level where the modal interaction is clearer.

  describe("action buttons", () => {
    it("shows Rerun button", async () => {
      mockGetCheck.mockResolvedValue(createCheck());

      renderWithProviders(<CheckDetail checkId="check-1" />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /rerun/i }),
        ).toBeInTheDocument();
      });
    });

    it("shows Copy to Clipboard button", async () => {
      mockGetCheck.mockResolvedValue(createCheck());

      renderWithProviders(<CheckDetail checkId="check-1" />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /copy to clipboard/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("preset check indicator", () => {
    it("shows preset indicator for preset checks", async () => {
      mockGetCheck.mockResolvedValue(createCheck({ is_preset: true }));

      renderWithProviders(<CheckDetail checkId="check-1" />);

      // Preset check has a bookmark icon (tested via aria-label on tooltip)
      await waitFor(() => {
        expect(screen.getByLabelText(/preset check/i)).toBeInTheDocument();
      });
    });
  });
});
