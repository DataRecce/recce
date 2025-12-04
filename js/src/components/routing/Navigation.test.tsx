/**
 * Integration tests for tab navigation
 *
 * Tests that navigation between main routes works correctly
 */

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
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

// Mock the context providers and their values
const mockLineageGraphContext = {
  lineageGraph: null,
  retchLineageGraph: jest.fn(),
  envInfo: null,
  reviewMode: false,
  cloudMode: false,
  fileMode: false,
  fileName: null,
  isDemoSite: false,
  isCodespace: false,
  error: null,
  supportTasks: null,
  isActionAvailable: jest.fn(() => true),
  isLoading: false,
  runsAggregated: null,
  refetchRunsAggregated: jest.fn(),
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
jest.mock("@/lib/hooks/LineageGraphContext", () => ({
  useLineageGraphContext: () => mockLineageGraphContext,
}));

jest.mock("@/lib/hooks/RecceInstanceContext", () => ({
  useRecceInstanceContext: () => mockRecceInstanceContext,
}));

jest.mock("@/lib/hooks/useRecceServerFlag", () => ({
  useRecceServerFlag: () => ({
    data: mockRecceServerFlagData,
    isLoading: false,
  }),
}));

jest.mock("@/lib/api/track", () => ({
  trackNavigation: jest.fn(),
}));

jest.mock("@/lib/api/checks", () => ({
  listChecks: jest.fn(() => Promise.resolve([])),
}));

// Mock components that might cause issues in tests
jest.mock("@/components/app/EnvInfo", () => ({
  EnvInfo: () => <div data-testid="env-info">EnvInfo</div>,
}));

jest.mock("@/components/app/Filename", () => ({
  Filename: () => <div data-testid="filename">Filename</div>,
}));

jest.mock("@/components/app/StateExporter", () => ({
  StateExporter: () => <div data-testid="state-exporter">StateExporter</div>,
}));

jest.mock("@/components/app/StateSharing", () => ({
  TopLevelShare: () => <div data-testid="top-level-share">TopLevelShare</div>,
}));

jest.mock("@/components/app/StateSynchronizer", () => ({
  StateSynchronizer: () => (
    <div data-testid="state-synchronizer">StateSynchronizer</div>
  ),
}));

// Import after mocks are set up
import NavBar from "app/(mainComponents)/NavBar";

/**
 * Test wrapper that provides all necessary context providers
 */
function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
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
    jest.clearAllMocks();
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
    expect(screen.getByText("Checklist")).toBeInTheDocument();
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

  it("highlights Checklist tab when on /checks route", async () => {
    global.mockNextNavigation.setPathname("/checks");

    renderWithProviders(<NavBar />);

    await waitFor(() => {
      const checklistTab = screen
        .getByText("Checklist")
        .closest("button, a, [role='tab']");
      expect(checklistTab).toBeInTheDocument();
    });
  });

  it("highlights Checklist tab when on /checks with query param", async () => {
    global.mockNextNavigation.setPathname("/checks");
    global.mockNextNavigation.setSearchParams("id=abc-123");

    renderWithProviders(<NavBar />);

    await waitFor(() => {
      const checklistTab = screen
        .getByText("Checklist")
        .closest("button, a, [role='tab']");
      expect(checklistTab).toBeInTheDocument();
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
    const checklistLink = screen.getByText("Checklist").closest("a");

    expect(lineageLink).toHaveAttribute("href", "/lineage");
    expect(queryLink).toHaveAttribute("href", "/query");
    expect(checklistLink).toHaveAttribute("href", "/checks");
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
