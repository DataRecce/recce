/**
 * @file valueDiffCells.test.tsx
 * @description Tests for Value Diff cell components
 *
 * Tests cover:
 * - PrimaryKeyIndicatorCell rendering
 * - MatchedPercentCell formatting
 * - ValueDiffColumnNameCell rendering and context menu
 */

import {
  MatchedPercentCell,
  PrimaryKeyIndicatorCell,
  ValueDiffColumnNameCell,
} from "@datarecce/ui/components/ui/dataGrid/valueDiffCells";
import { theme } from "@datarecce/ui/theme";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import React, { ReactNode } from "react";

// ============================================================================
// Mocks
// ============================================================================

// Mock @datarecce/ui/contexts for both hooks used by the components
jest.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: jest.fn(() => ({ basePath: "" })),
  useRecceActionContext: () => ({
    runAction: jest.fn(),
  }),
  useRecceInstanceContext: () => ({
    featureToggles: {
      disableDatabaseQuery: false,
    },
  }),
}));

// ============================================================================
// Test Wrapper
// ============================================================================

/**
 * Test wrapper that provides MUI ThemeProvider context
 */
function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

/**
 * Custom render function that includes providers
 */
function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

// ============================================================================
// PrimaryKeyIndicatorCell Tests
// ============================================================================

describe("PrimaryKeyIndicatorCell", () => {
  test("renders key icon when column is a primary key", () => {
    const { container } = renderWithProviders(
      <PrimaryKeyIndicatorCell
        columnName="user_id"
        primaryKeys={["user_id", "order_id"]}
      />,
    );

    // Check that icon is rendered (VscKey icon)
    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  test("renders empty when column is not a primary key", () => {
    const { container } = renderWithProviders(
      <PrimaryKeyIndicatorCell
        columnName="email"
        primaryKeys={["user_id", "order_id"]}
      />,
    );

    // Should not have an icon
    const icon = container.querySelector("svg");
    expect(icon).not.toBeInTheDocument();
  });

  test("handles empty primary keys array", () => {
    const { container } = renderWithProviders(
      <PrimaryKeyIndicatorCell columnName="user_id" primaryKeys={[]} />,
    );

    const icon = container.querySelector("svg");
    expect(icon).not.toBeInTheDocument();
  });
});

// ============================================================================
// MatchedPercentCell Tests
// ============================================================================

describe("MatchedPercentCell", () => {
  test("renders 'N/A' for null value", () => {
    renderWithProviders(<MatchedPercentCell value={null} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  test("renders 'N/A' for undefined value", () => {
    renderWithProviders(<MatchedPercentCell value={undefined} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  test("renders '100.00 %' for 1.0", () => {
    renderWithProviders(<MatchedPercentCell value={1.0} />);
    expect(screen.getByText("100.00 %")).toBeInTheDocument();
  });

  test("renders '0.00 %' for 0", () => {
    renderWithProviders(<MatchedPercentCell value={0} />);
    expect(screen.getByText("0.00 %")).toBeInTheDocument();
  });

  test("renders '~99.99 %' for values slightly below 100%", () => {
    renderWithProviders(<MatchedPercentCell value={0.99995} />);
    expect(screen.getByText("~99.99 %")).toBeInTheDocument();
  });

  test("renders '~0.01 %' for values slightly above 0%", () => {
    renderWithProviders(<MatchedPercentCell value={0.00005} />);
    expect(screen.getByText("~0.01 %")).toBeInTheDocument();
  });

  test("renders formatted percentage for normal values", () => {
    renderWithProviders(<MatchedPercentCell value={0.9542} />);
    expect(screen.getByText("95.42 %")).toBeInTheDocument();
  });

  test("renders formatted percentage with two decimal places", () => {
    renderWithProviders(<MatchedPercentCell value={0.12345} />);
    expect(screen.getByText("12.35 %")).toBeInTheDocument();
  });
});

// ============================================================================
// ValueDiffColumnNameCell Tests
// ============================================================================

describe("ValueDiffColumnNameCell", () => {
  test("renders column name", () => {
    renderWithProviders(
      <ValueDiffColumnNameCell
        column="email"
        params={{ model: "users", primary_key: "id" }}
      />,
    );

    expect(screen.getByText("email")).toBeInTheDocument();
  });

  test("renders context menu trigger button", () => {
    renderWithProviders(
      <ValueDiffColumnNameCell
        column="email"
        params={{ model: "users", primary_key: "id" }}
      />,
    );

    // Should have a button for the context menu
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });
});
