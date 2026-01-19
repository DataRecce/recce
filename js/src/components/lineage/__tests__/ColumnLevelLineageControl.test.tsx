/**
 * @file ColumnLevelLineageControl.test.tsx
 * @description Comprehensive tests for ColumnLevelLineageControl component
 *
 * Tests verify:
 * - Impact Radius button rendering and behavior
 * - Mode message panel display
 * - Loading state with spinner
 * - Error state with tooltip
 * - Close button behavior
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

import { type Mock, vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock LineageViewContext (included with other @datarecce/ui/contexts mocks)
vi.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: vi.fn(() => ({ basePath: "" })),
  useLineageGraphContext: vi.fn(),
  useRecceServerFlag: vi.fn(),
  useLineageViewContextSafe: vi.fn(),
}));

// Mock @datarecce/ui/hooks
vi.mock("@datarecce/ui/hooks", () => ({
  useIsDark: vi.fn(() => false),
}));

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraph, LineageViewContextType } from "@datarecce/ui";
import type { CllInput, ColumnLineageData } from "@datarecce/ui/api";
import { ColumnLevelLineageControlOss } from "@datarecce/ui/components/lineage/ColumnLevelLineageControlOss";
import {
  useLineageGraphContext,
  useLineageViewContextSafe,
  useRecceServerFlag,
} from "@datarecce/ui/contexts";
import { useIsDark } from "@datarecce/ui/hooks";
import type { UseMutationResult } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockLineageGraph = (
  overrides: Partial<LineageGraph> = {},
): LineageGraph => ({
  nodes: {
    "model.test.my_model": {
      id: "model.test.my_model",
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id: "model.test.my_model",
        name: "my_model",
        from: "both",
        data: {
          base: undefined,
          current: undefined,
        },
        parents: {},
        children: {},
      },
    },
  },
  edges: {},
  modifiedSet: [],
  manifestMetadata: {},
  catalogMetadata: {
    current: {} as LineageGraph["catalogMetadata"]["current"],
    base: {} as LineageGraph["catalogMetadata"]["base"],
  },
  ...overrides,
});

const createMockLineageViewContext = (
  overrides: Partial<LineageViewContextType> = {},
): Partial<LineageViewContextType> => ({
  showColumnLevelLineage: vi.fn().mockResolvedValue(undefined),
  resetColumnLevelLineage: vi.fn().mockResolvedValue(undefined),
  interactive: true,
  viewOptions: {},
  centerNode: vi.fn(),
  ...overrides,
});

const createMockMutation = (
  overrides: Partial<
    UseMutationResult<ColumnLineageData, Error, CllInput>
  > = {},
): UseMutationResult<ColumnLineageData, Error, CllInput> =>
  ({
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    error: null,
    data: undefined,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    status: "idle",
    failureCount: 0,
    failureReason: null,
    variables: undefined,
    context: undefined,
    submittedAt: 0,
    ...overrides,
  }) as UseMutationResult<ColumnLineageData, Error, CllInput>;

// ============================================================================
// Test Setup
// ============================================================================

describe("ColumnLevelLineageControl", () => {
  const mockUseLineageViewContextSafe = useLineageViewContextSafe as Mock;
  const mockUseLineageGraphContext = useLineageGraphContext as Mock;
  const mockUseRecceServerFlag = useRecceServerFlag as Mock;
  const mockUseIsDark = useIsDark as Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseLineageViewContextSafe.mockReturnValue(
      createMockLineageViewContext(),
    );
    mockUseLineageGraphContext.mockReturnValue({
      lineageGraph: createMockLineageGraph(),
    });
    mockUseRecceServerFlag.mockReturnValue({
      data: { single_env_onboarding: false },
      isLoading: false,
    });
    mockUseIsDark.mockReturnValue(false);
  });

  // ==========================================================================
  // Impact Radius Button Tests
  // ==========================================================================

  describe("Impact Radius button", () => {
    it('renders "Impact Radius" button', () => {
      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      expect(
        screen.getByRole("button", { name: /Impact Radius/i }),
      ).toBeInTheDocument();
    });

    it("button is disabled when not interactive", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({ interactive: false }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      const button = screen.getByRole("button", { name: /Impact Radius/i });
      expect(button).toBeDisabled();
    });

    it("button is disabled when no catalog current", () => {
      mockUseLineageGraphContext.mockReturnValue({
        lineageGraph: createMockLineageGraph({
          catalogMetadata: {
            current: undefined,
            base: undefined,
          },
        }),
      });

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      const button = screen.getByRole("button", { name: /Impact Radius/i });
      expect(button).toBeDisabled();
    });

    it("button is hidden in single_env mode", () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
        isLoading: false,
      });

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      expect(
        screen.queryByRole("button", { name: /Impact Radius/i }),
      ).not.toBeInTheDocument();
    });

    it("clicking button calls showColumnLevelLineage with correct params", () => {
      const mockShowCll = vi.fn().mockResolvedValue(undefined);
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({ showColumnLevelLineage: mockShowCll }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      const button = screen.getByRole("button", { name: /Impact Radius/i });
      fireEvent.click(button);

      expect(mockShowCll).toHaveBeenCalledWith({
        no_upstream: true,
        change_analysis: true,
      });
    });

    it("button is enabled when interactive and catalog is available", () => {
      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      const button = screen.getByRole("button", { name: /Impact Radius/i });
      expect(button).not.toBeDisabled();
    });
  });

  // ==========================================================================
  // Mode Message Panel Tests
  // ==========================================================================

  describe("mode message panel", () => {
    it("is not shown when no CLL active (viewOptions.column_level_lineage undefined)", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {},
        }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      // The mode message panel should not be rendered
      expect(screen.queryByText(/Impact Radius for/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Column Lineage for/i)).not.toBeInTheDocument();
    });

    it('shows "Impact Radius for All Changed Models" when no node_id', () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              // no node_id
            },
          },
        }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      expect(
        screen.getByText("Impact Radius for All Changed Models"),
      ).toBeInTheDocument();
    });

    it('shows "Impact Radius for {nodeName}" when node_id but no column', () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
              // no column
            },
          },
        }),
      );
      mockUseLineageGraphContext.mockReturnValue({
        lineageGraph: createMockLineageGraph(),
      });

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      expect(screen.getByText(/Impact Radius for/i)).toBeInTheDocument();
      expect(screen.getByText("my_model")).toBeInTheDocument();
    });

    it('shows "Column Lineage for {nodeName}.{column}" when column specified', () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
              column: "user_id",
            },
          },
        }),
      );
      mockUseLineageGraphContext.mockReturnValue({
        lineageGraph: createMockLineageGraph(),
      });

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      expect(screen.getByText(/Column Lineage for/i)).toBeInTheDocument();
      expect(screen.getByText("my_model.user_id")).toBeInTheDocument();
    });

    it("clicking node name calls centerNode with node_id", () => {
      const mockCenterNode = vi.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
          centerNode: mockCenterNode,
        }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      const nodeName = screen.getByText("my_model");
      fireEvent.click(nodeName);

      expect(mockCenterNode).toHaveBeenCalledWith("model.test.my_model");
    });

    it("clicking column name calls centerNode with column node_id", () => {
      const mockCenterNode = vi.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
              column: "user_id",
            },
          },
          centerNode: mockCenterNode,
        }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      const columnName = screen.getByText("my_model.user_id");
      fireEvent.click(columnName);

      expect(mockCenterNode).toHaveBeenCalledWith(
        "model.test.my_model_user_id",
      );
    });

    it("uses node_id as fallback when node not found in lineageGraph", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.unknown_model",
            },
          },
        }),
      );
      mockUseLineageGraphContext.mockReturnValue({
        lineageGraph: createMockLineageGraph({
          nodes: {}, // Empty nodes
        }),
      });

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      // Should show the node_id itself when not found
      expect(screen.getByText("model.test.unknown_model")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe("loading state", () => {
    it("shows CircularProgress when action.isPending", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
        }),
      );

      render(
        <ColumnLevelLineageControlOss
          action={createMockMutation({ isPending: true })}
        />,
      );

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("does not show close button when loading", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
        }),
      );

      render(
        <ColumnLevelLineageControlOss
          action={createMockMutation({ isPending: true })}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /Reset Column Level Lineage/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Error State Tests
  // ==========================================================================

  describe("error state", () => {
    it("shows error indicator when action.isError", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
        }),
      );

      render(
        <ColumnLevelLineageControlOss
          action={createMockMutation({
            isError: true,
            error: new Error("Test error message"),
          })}
        />,
      );

      // The error indicator has an aria-label containing the error message
      // MUI Tooltip sets the aria-label on the wrapped element
      const errorIndicator = screen.getByLabelText(/Error: Test error message/);
      expect(errorIndicator).toBeInTheDocument();
    });

    it("error tooltip contains error message", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
        }),
      );

      const errorMessage = "Connection failed";
      render(
        <ColumnLevelLineageControlOss
          action={createMockMutation({
            isError: true,
            error: new Error(errorMessage),
          })}
        />,
      );

      // MUI Tooltip sets aria-label on the wrapped element with the tooltip content
      const errorIndicator = screen.getByLabelText(`Error: ${errorMessage}`);
      expect(errorIndicator).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Close Button Tests
  // ==========================================================================

  describe("close button", () => {
    it("shows close button when CLL active", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
        }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      expect(
        screen.getByRole("button", { name: /Reset Column Level Lineage/i }),
      ).toBeInTheDocument();
    });

    it("close button is not shown when CLL not active", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {},
        }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      expect(
        screen.queryByRole("button", { name: /Reset Column Level Lineage/i }),
      ).not.toBeInTheDocument();
    });

    it("clicking close calls resetColumnLevelLineage", () => {
      const mockResetCll = vi.fn().mockResolvedValue(undefined);
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
          resetColumnLevelLineage: mockResetCll,
        }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      const closeButton = screen.getByRole("button", {
        name: /Reset Column Level Lineage/i,
      });
      fireEvent.click(closeButton);

      expect(mockResetCll).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("integration", () => {
    it("renders complete UI in normal state with CLL active", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
              column: "user_id",
            },
          },
        }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      // Impact Radius button should be present
      expect(
        screen.getByRole("button", { name: /Impact Radius/i }),
      ).toBeInTheDocument();

      // Mode message should show column lineage
      expect(screen.getByText(/Column Lineage for/i)).toBeInTheDocument();
      expect(screen.getByText("my_model.user_id")).toBeInTheDocument();

      // Close button should be present
      expect(
        screen.getByRole("button", { name: /Reset Column Level Lineage/i }),
      ).toBeInTheDocument();
    });

    it("renders correctly in single env mode with CLL active", () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
        isLoading: false,
      });
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
        }),
      );

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      // Impact Radius button should be hidden
      expect(
        screen.queryByRole("button", { name: /Impact Radius/i }),
      ).not.toBeInTheDocument();

      // Mode message should still be visible
      expect(screen.getByText(/Impact Radius for/i)).toBeInTheDocument();

      // Close button should be present
      expect(
        screen.getByRole("button", { name: /Reset Column Level Lineage/i }),
      ).toBeInTheDocument();
    });

    it("shows loading state correctly", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
        }),
      );

      render(
        <ColumnLevelLineageControlOss
          action={createMockMutation({ isPending: true })}
        />,
      );

      // Spinner should be visible
      expect(screen.getByRole("progressbar")).toBeInTheDocument();

      // Close button should not be visible during loading
      expect(
        screen.queryByRole("button", { name: /Reset Column Level Lineage/i }),
      ).not.toBeInTheDocument();
    });

    it("handles missing lineageGraph gracefully", () => {
      mockUseLineageGraphContext.mockReturnValue({
        lineageGraph: undefined,
      });
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
        }),
      );

      // Should not throw
      expect(() =>
        render(<ColumnLevelLineageControlOss action={createMockMutation()} />),
      ).not.toThrow();
    });

    it("button shows tooltip when catalog is missing", () => {
      mockUseLineageGraphContext.mockReturnValue({
        lineageGraph: createMockLineageGraph({
          catalogMetadata: {
            current: undefined,
            base: undefined,
          },
        }),
      });

      render(<ColumnLevelLineageControlOss action={createMockMutation()} />);

      // The button should be disabled
      const button = screen.getByRole("button", { name: /Impact Radius/i });
      expect(button).toBeDisabled();
    });
  });

  // ==========================================================================
  // Theme Tests
  // ==========================================================================

  describe("theme handling", () => {
    it("renders correctly in dark mode", () => {
      mockUseIsDark.mockReturnValue(true);
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
        }),
      );

      // Should render without errors in dark mode
      expect(() =>
        render(<ColumnLevelLineageControlOss action={createMockMutation()} />),
      ).not.toThrow();
    });

    it("renders correctly in light mode", () => {
      mockUseIsDark.mockReturnValue(false);
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockLineageViewContext({
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.my_model",
            },
          },
        }),
      );

      // Should render without errors in light mode
      expect(() =>
        render(<ColumnLevelLineageControlOss action={createMockMutation()} />),
      ).not.toThrow();
    });
  });
});
