// js/src/components/schema/ColumnNameCell.test.tsx

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import React from "react";
import { NodeData } from "@/lib/api/info";
import { SchemaDiffRow } from "@/lib/dataGrid/generators/toSchemaDataGrid";
import { ColumnNameCell } from "./ColumnNameCell";

// Mock dependencies
jest.mock("@/lib/hooks/RecceActionContext", () => ({
  useRecceActionContext: () => ({ runAction: jest.fn() }),
}));

jest.mock("@/lib/hooks/RecceInstanceContext", () => ({
  useRecceInstanceContext: () => ({
    featureToggles: { disableDatabaseQuery: false },
  }),
}));

jest.mock("../lineage/LineageViewContext", () => ({
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
 * Wrapper component that provides Chakra context
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
}

/**
 * Custom render function with Chakra provider
 */
function renderWithChakra(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

// ============================================================================
// Tests
// ============================================================================

describe("ColumnNameCell", () => {
  describe("showMenu prop", () => {
    test("renders menu button when showMenu is true (default)", () => {
      renderWithChakra(
        <ColumnNameCell model={createMockModel()} row={createMockRow()} />,
      );

      // The kebab menu button should be present
      const menuButton = screen.getByRole("button");
      expect(menuButton).toBeInTheDocument();
    });

    test("renders menu button when showMenu is explicitly true", () => {
      renderWithChakra(
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
      renderWithChakra(
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
      renderWithChakra(
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
      renderWithChakra(
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
      renderWithChakra(
        <ColumnNameCell
          model={createMockModel()}
          row={createMockRow({ name: "email_address" })}
          showMenu={false}
        />,
      );

      expect(screen.getByText("email_address")).toBeInTheDocument();
    });

    test("renders spinner when cllRunning is true", () => {
      renderWithChakra(
        <ColumnNameCell
          model={createMockModel()}
          row={createMockRow()}
          cllRunning={true}
          showMenu={false}
        />,
      );

      // Chakra Spinner renders with aria-busy
      const spinner = document.querySelector(".chakra-spinner");
      expect(spinner).toBeInTheDocument();
    });
  });
});
