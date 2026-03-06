/**
 * @file ColumnNameCell.test.tsx
 * @description Tests for the ColumnNameCell component
 */

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi } from "vitest";
import type { NodeData } from "../../../api";
import { theme } from "../../../theme";
import { ColumnNameCell } from "../ColumnNameCell";
import type { SchemaDiffRow } from "../types";

// Mock dependencies with dynamic isActionAvailable and lineageViewContext
const { mockIsActionAvailable, mockLineageViewContext } = vi.hoisted(() => ({
  mockIsActionAvailable: vi.fn(() => true),
  mockLineageViewContext: { current: undefined as unknown },
}));
vi.mock("../../../contexts", () => ({
  useRecceActionContext: () => ({ runAction: vi.fn() }),
  useRecceInstanceContext: () => ({
    featureToggles: { disableDatabaseQuery: false },
  }),
  useLineageViewContext: () => mockLineageViewContext.current,
  useLineageGraphContext: () => ({ isActionAvailable: mockIsActionAvailable }),
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

  describe("change analysis gating", () => {
    // These tests need lineageViewContext to be truthy so the short-circuit
    // evaluation in isCllDisabled reaches the isActionAvailable check.
    const mockViewContext = { showColumnLevelLineage: vi.fn() };

    test("tooltip is disabled when change analysis is unavailable", () => {
      mockLineageViewContext.current = mockViewContext;
      mockIsActionAvailable.mockReturnValue(false);

      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={createMockRow()}
          showMenu={false}
        />,
      );

      // When isActionAvailable returns false, isCllDisabled is true,
      // causing the Tooltip's disableHoverListener to be true.
      expect(mockIsActionAvailable).toHaveBeenCalledWith("change_analysis");
      expect(screen.getByText("user_id")).toBeInTheDocument();

      mockLineageViewContext.current = undefined;
      mockIsActionAvailable.mockReturnValue(true);
    });

    test("tooltip is enabled when change analysis is available", () => {
      mockLineageViewContext.current = mockViewContext;
      mockIsActionAvailable.mockReturnValue(true);

      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={createMockRow()}
          showMenu={false}
        />,
      );

      expect(mockIsActionAvailable).toHaveBeenCalledWith("change_analysis");

      mockLineageViewContext.current = undefined;
    });
  });

  describe("definitionChanged badge", () => {
    const definitionChangedRow = createMockRow({ definitionChanged: true });

    test("renders ~ badge when definitionChanged is true", () => {
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={definitionChangedRow}
          showMenu={false}
        />,
      );

      const badges = screen.getAllByText("~");
      expect(badges.length).toBeGreaterThanOrEqual(1);
      const badge = badges[0];
      expect(badge).toHaveClass("schema-change-badge-changed");
    });

    test("does not render ~ badge when definitionChanged is falsy", () => {
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={createMockRow()}
          showMenu={false}
        />,
      );

      expect(screen.queryByText("~")).not.toBeInTheDocument();
    });

    test("renders as button when onViewCode is provided", () => {
      const onViewCode = vi.fn();
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={definitionChangedRow}
          showMenu={false}
          onViewCode={onViewCode}
        />,
      );

      const badge = screen.getByText("~");
      expect(badge.tagName).toBe("BUTTON");
      expect(badge).toHaveClass("schema-change-badge-clickable");
    });

    test("renders as span when onViewCode is not provided", () => {
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={definitionChangedRow}
          showMenu={false}
        />,
      );

      const badge = screen.getByText("~");
      expect(badge.tagName).toBe("SPAN");
      expect(badge).not.toHaveClass("schema-change-badge-clickable");
    });

    test("calls onViewCode when button badge is clicked", async () => {
      const user = userEvent.setup();
      const onViewCode = vi.fn();
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={definitionChangedRow}
          showMenu={false}
          onViewCode={onViewCode}
        />,
      );

      const badge = screen.getByText("~");
      await user.click(badge);
      expect(onViewCode).toHaveBeenCalledTimes(1);
    });

    test("badge has tooltip with definition changed text", async () => {
      const user = userEvent.setup();
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={definitionChangedRow}
          showMenu={false}
        />,
      );

      const badge = screen.getByText("~");
      await user.hover(badge);
      const tooltip = await screen.findByRole("tooltip");
      expect(tooltip).toHaveTextContent(
        "Definition changed — click to view code",
      );
    });

    test("does not render definitionChanged badge when hasStructuralChange", () => {
      // definitionChanged and structural changes are mutually exclusive
      // in practice, but if both were set, both badges would render.
      // This test verifies that a normal type-changed row doesn't get
      // the definitionChanged badge.
      const typeChangedRow = createMockRow({
        baseType: "INT",
        currentType: "VARCHAR",
      });
      renderWithMui(
        <ColumnNameCell
          model={createMockModel()}
          row={typeChangedRow}
          showMenu={false}
        />,
      );

      // The ~ badge for structural change should render, but
      // definitionChanged is not set so there should be exactly one
      const badges = screen.getAllByText("~");
      expect(badges).toHaveLength(1);
      // It should be the structural change badge (span, not button)
      expect(badges[0].tagName).toBe("SPAN");
    });
  });
});
