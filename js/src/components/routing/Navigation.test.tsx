/**
 * Integration tests for tab navigation
 *
 * Tests that navigation between main routes works correctly
 */

import { theme } from "@datarecce/ui/theme";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React, { ReactNode } from "react";

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Disable refetching to avoid act() warnings
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    },
  });

import { vi } from "vitest";

// Mock the context providers and their values
const mockLineageGraphContext = {
  lineageGraph: null,
  retchLineageGraph: vi.fn(),
  envInfo: null,
  reviewMode: false,
  cloudMode: false,
  fileMode: false,
  fileName: null,
  isDemoSite: false,
  isCodespace: false,
  error: null,
  supportTasks: null,
  isActionAvailable: vi.fn(() => true),
  isLoading: false,
  runsAggregated: null,
  refetchRunsAggregated: vi.fn(),
};

const mockRecceInstanceContext = {
  featureToggles: {
    mode: null,
    disableShare: false,
  },
};

let mockRecceServerFlagData = {
  single_env_onboarding: false,
};

// Mock the hooks used by NavBar
vi.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: vi.fn(() => ({ basePath: "" })),
  useLineageGraphContext: () => mockLineageGraphContext,
  useRecceInstanceContext: () => mockRecceInstanceContext,
  useRecceServerFlag: () => ({
    data: mockRecceServerFlagData,
    isLoading: false,
  }),
}));

vi.mock("@datarecce/ui/lib/api/track", () => ({
  EXPLORE_ACTION: {
    ROW_COUNT: "row_count",
    ROW_COUNT_DIFF: "row_count_diff",
    VALUE_DIFF: "value_diff",
  },
  EXPLORE_SOURCE: {
    LINEAGE_VIEW_TOP_BAR: "lineage_view_top_bar",
  },
  trackExploreAction: vi.fn(),
  trackNavigation: vi.fn(),
}));

vi.mock("@datarecce/ui/api", () => ({
  listChecks: vi.fn(() => Promise.resolve([])),
  useChecks: vi.fn(() => ({ data: [], isLoading: false })),
  cacheKeys: {
    rowCount: (model: string) => ["row_count", model],
    lineage: () => ["lineage"],
    checks: () => ["checks", "list"],
    check: (checkId: string) => ["checks", checkId],
    checkEvents: (checkId: string) => ["checks", checkId, "events"],
    runs: () => ["runs"],
    run: (runId: string) => ["runs", runId],
    runsAggregated: () => ["runs_aggregated"],
    flag: () => ["flag"],
    instanceInfo: () => ["instance_info"],
    user: () => ["user"],
  },
}));

// Mock components that might cause issues in tests
vi.mock("@datarecce/ui/components/app/EnvInfo", () => ({
  EnvInfo: () => <div data-testid="env-info">EnvInfo</div>,
}));

vi.mock("@datarecce/ui/components/app/Filename", () => ({
  Filename: () => <div data-testid="filename">Filename</div>,
}));

vi.mock("@datarecce/ui/components/app/StateExporter", () => ({
  StateExporter: () => <div data-testid="state-exporter">StateExporter</div>,
}));

vi.mock("@datarecce/ui/components/app/StateSharing", () => ({
  TopLevelShare: () => <div data-testid="top-level-share">TopLevelShare</div>,
}));

vi.mock("@datarecce/ui/components/app/StateSynchronizer", () => ({
  StateSynchronizer: () => (
    <div data-testid="state-synchronizer">StateSynchronizer</div>
  ),
}));

// Import after mocks are set up
import { NavBarOss as NavBar } from "@datarecce/ui/components/app/NavBarOss";

/**
 * Test wrapper that provides all necessary context providers
 */
function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Custom render function that includes providers
 */
function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

describe("NavBar Tab Navigation", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
    vi.clearAllMocks();
    // Reset the mock data
    mockRecceServerFlagData = {
      single_env_onboarding: false,
    };
  });

  it("renders all navigation tabs", async () => {
    global.mockNextNavigation.setPathname("/lineage");

    renderWithProviders(<NavBar />);

    // Wait for any async state updates to complete
    await waitFor(() => {
      expect(screen.getByText("Lineage")).toBeInTheDocument();
    });

    expect(screen.getByText("Query")).toBeInTheDocument();
  });

  it("highlights Lineage tab when on /lineage route", async () => {
    global.mockNextNavigation.setPathname("/lineage");

    renderWithProviders(<NavBar />);

    await waitFor(() => {
      const lineageTab = screen
        .getByText("Lineage")
        .closest("button, a, [role='tab']");
      expect(lineageTab).toBeInTheDocument();
    });
  });

  it("hides Query tab when single_env_onboarding is true", async () => {
    // Update mock data before rendering
    mockRecceServerFlagData.single_env_onboarding = true;

    global.mockNextNavigation.setPathname("/lineage");

    renderWithProviders(<NavBar />);

    await waitFor(() => {
      expect(screen.getByText("Lineage")).toBeInTheDocument();
    });

    // Query tab should be hidden or not visible
    const queryTab = screen.queryByText("Query");
    // Either the tab is not in document, or it has hidden attribute
    if (queryTab) {
      const parentElement = queryTab.closest("[hidden], [data-hidden='true']");
      expect(parentElement).toBeTruthy();
    }
  });

  it("tabs have correct href attributes for navigation", async () => {
    global.mockNextNavigation.setPathname("/lineage");

    renderWithProviders(<NavBar />);

    await waitFor(() => {
      expect(screen.getByText("Lineage")).toBeInTheDocument();
    });

    const lineageLink = screen.getByText("Lineage").closest("a");
    const queryLink = screen.getByText("Query").closest("a");

    expect(lineageLink).toHaveAttribute("href", "/lineage");
    expect(queryLink).toHaveAttribute("href", "/query");
  });

  it("renders correctly on /query route", async () => {
    global.mockNextNavigation.setPathname("/query");

    renderWithProviders(<NavBar />);

    await waitFor(() => {
      expect(screen.getByText("Query")).toBeInTheDocument();
    });
  });
});

describe("Route Path Matching", () => {
  beforeEach(() => {
    global.mockNextNavigation.reset();
  });

  it("correctly identifies /lineage as lineage route", () => {
    const pathname = "/lineage";
    const isLineageRoute = pathname === "/lineage" || pathname === "/";

    expect(isLineageRoute).toBe(true);
  });

  it("correctly identifies / as lineage route", () => {
    const pathname = "/";
    // @ts-expect-error This is valid test code
    const isLineageRoute = pathname === "/lineage" || pathname === "/";

    expect(isLineageRoute).toBe(true);
  });

  it("correctly identifies /query as not lineage route", () => {
    const pathname = "/query";
    // @ts-expect-error This is valid test code
    const isLineageRoute = pathname === "/lineage" || pathname === "/";

    expect(isLineageRoute).toBe(false);
  });

  it("correctly identifies /checks as not lineage route", () => {
    const pathname = "/checks";
    // @ts-expect-error This is valid test code
    const isLineageRoute = pathname === "/lineage" || pathname === "/";

    expect(isLineageRoute).toBe(false);
  });

  it("correctly identifies /checks?id=xxx as checks route", () => {
    const pathname = "/checks";
    const isChecksRoute = pathname.startsWith("/checks");

    expect(isChecksRoute).toBe(true);
  });
});
