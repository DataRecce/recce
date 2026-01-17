/**
 * @file ColumnNameCell.test.tsx
 * @description Tests for the ColumnNameCell component
 */

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import type { NodeData } from "../../../api";
import { theme } from "../../../theme";
import { ColumnNameCell } from "../ColumnNameCell";
import type { SchemaDiffRow } from "../SchemaDiff";

// Mock dependencies
vi.mock("../../../contexts", () => ({
  useRecceActionContext: () => ({ runAction: vi.fn() }),
  useRecceInstanceContext: () => ({
    featureToggles: { disableDatabaseQuery: false },
  }),
  useLineageViewContext: () => undefined,
}));

// ============================================================================
// Test Utilities
// ============================================================================

const createMockModel = (resourceType = "model"): NodeData =>
  ({
    id: "model.test.users",
    name: "users",
    resource_type: resourceType,
    columns: {},
  }) as NodeData;

const createMockRow = (
  overrides: Partial<SchemaDiffRow> = {},
): SchemaDiffRow => ({
  name: "user_id",
  baseIndex: 1,
  currentIndex: 1,
  baseType: "INT",
  currentType: "INT",
  __status: undefined,
  ...overrides,
});

/**
 * Wrapper component that provides MUI theme context
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

/**
 * Custom render function with MUI provider
 */
function renderWithMui(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

// ============================================================================
// Tests
// ============================================================================

describe("ColumnNameCell", () => {
  describe("showMenu prop", () => {
    test("renders menu button when showMenu is true (default)", () => {
      renderWithMui(
        <ColumnNameCell model={createMockModel()} row={createMockRow()} />,
      );

      // The kebab menu button should be present
      const menuButton = screen.getByRole("button");
      expect(menuButton).toBeInTheDocument();
    });

    test("renders menu button when showMenu is explicitly true", () => {
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={createMockRow()}
          showMenu={true}
        />,
      );

      const menuButton = screen.getByRole("button");
      expect(menuButton).toBeInTheDocument();
    });

    test("does not render menu button when showMenu is false", () => {
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={createMockRow()}
          showMenu={false}
        />,
      );

      // The kebab menu button should not be present
      const menuButton = screen.queryByRole("button");
      expect(menuButton).not.toBeInTheDocument();
    });

    test("does not render menu for source resource type regardless of showMenu", () => {
      renderWithMui(
        <ColumnNameCell
          model={createMockModel("source")}
          row={createMockRow()}
          showMenu={true}
        />,
      );

      const menuButton = screen.queryByRole("button");
      expect(menuButton).not.toBeInTheDocument();
    });

    test("does not render menu when singleEnv is true regardless of showMenu", () => {
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={createMockRow()}
          singleEnv={true}
          showMenu={true}
        />,
      );

      const menuButton = screen.queryByRole("button");
      expect(menuButton).not.toBeInTheDocument();
    });
  });

  describe("column name display", () => {
    test("renders column name", () => {
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={createMockRow({ name: "email_address" })}
          showMenu={false}
        />,
      );

      expect(screen.getByText("email_address")).toBeInTheDocument();
    });

    test("renders spinner when cllRunning is true", () => {
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={createMockRow()}
          cllRunning={true}
          showMenu={false}
        />,
      );

      // MUI CircularProgress renders with role="progressbar"
      const spinner = screen.getByRole("progressbar");
      expect(spinner).toBeInTheDocument();
    });
  });
});
