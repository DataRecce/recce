/**
 * @file ActionControl.test.tsx
 * @description Comprehensive pre-migration tests for ActionControl component
 *
 * Tests verify:
 * - Progress display in per_node mode (completed / total format)
 * - Progress display in percentage mode (from currentRun.progress.percentage)
 * - Fallback progress display ("100%" when completed, "0%" otherwise)
 * - Status display showing "(canceled)" suffix
 * - Cancel button behavior (shown when running/canceling, disabled when canceling)
 * - Close button behavior (shown when completed/canceled, calls onClose)
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

import { type Mock, vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock LineageViewContext
vi.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: vi.fn(() => ({ basePath: "" })),
  useLineageViewContextSafe: vi.fn(),
}));

// ============================================================================
// Imports
// ============================================================================

import type { ActionState, LineageViewContextType } from "@datarecce/ui";
import { ActionControlOss } from "@datarecce/ui/components/lineage/ActionControlOss";
import { useLineageViewContextSafe } from "@datarecce/ui/contexts";
import { fireEvent, render, screen } from "@testing-library/react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockActionState = (
  overrides: Partial<ActionState> = {},
): ActionState => ({
  mode: "per_node",
  status: "running",
  completed: 0,
  total: 10,
  currentRun: undefined,
  actions: {},
  ...overrides,
});

const createMockContext = (
  overrides: Partial<{
    cancel: Mock;
    actionState: ActionState;
  }> = {},
): Partial<LineageViewContextType> => ({
  cancel: vi.fn(),
  actionState: createMockActionState(overrides.actionState),
  ...overrides,
});

// ============================================================================
// Test Setup
// ============================================================================

describe("ActionControl", () => {
  const mockUseLineageViewContextSafe = useLineageViewContextSafe as Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    mockUseLineageViewContextSafe.mockReturnValue(createMockContext());
  });

  // ==========================================================================
  // Progress Display Tests - Per Node Mode
  // ==========================================================================

  describe("progress display (per_node mode)", () => {
    it("shows completed / total format for per_node mode", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "per_node",
            completed: 3,
            total: 10,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent(
        "Progress: 3 / 10",
      );
    });

    it("shows 0 / total when no nodes completed", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "per_node",
            completed: 0,
            total: 5,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent(
        "Progress: 0 / 5",
      );
    });

    it("shows all completed when total equals completed", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "per_node",
            completed: 10,
            total: 10,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent(
        "Progress: 10 / 10",
      );
    });

    it("updates display as completed changes", () => {
      const { rerender } = render(<ActionControlOss onClose={vi.fn()} />);

      // Initial state: 3 / 10
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "per_node",
            completed: 3,
            total: 10,
          }),
        }),
      );
      rerender(<ActionControlOss onClose={vi.fn()} />);
      expect(screen.getByText(/Progress:/)).toHaveTextContent(
        "Progress: 3 / 10",
      );

      // Updated state: 7 / 10
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "per_node",
            completed: 7,
            total: 10,
          }),
        }),
      );
      rerender(<ActionControlOss onClose={vi.fn()} />);
      expect(screen.getByText(/Progress:/)).toHaveTextContent(
        "Progress: 7 / 10",
      );
    });
  });

  // ==========================================================================
  // Progress Display Tests - Percentage Mode
  // ==========================================================================

  describe("progress display (percentage mode)", () => {
    it("shows percentage from currentRun.progress.percentage", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "multi_nodes",
            currentRun: {
              progress: {
                percentage: 0.5,
              },
            },
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent("Progress: 50%");
    });

    it("shows percentage with different values", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "multi_nodes",
            currentRun: {
              progress: {
                percentage: 0.75,
              },
            },
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent("Progress: 75%");
    });

    it("shows 100% when completed and no percentage available", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "multi_nodes",
            status: "completed",
            currentRun: undefined,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent("Progress: 100%");
    });

    it("shows 100% when completed and progress is empty object", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "multi_nodes",
            status: "completed",
            currentRun: {
              progress: {},
            },
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent("Progress: 100%");
    });

    it("shows 0% when not completed and no percentage available", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "multi_nodes",
            status: "running",
            currentRun: undefined,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent("Progress: 0%");
    });

    it("shows 0% when pending and no percentage available", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "multi_nodes",
            status: "pending",
            currentRun: undefined,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent("Progress: 0%");
    });

    it("shows 0% when canceling and no percentage available", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "multi_nodes",
            status: "canceling",
            currentRun: undefined,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent("Progress: 0%");
    });

    it("shows 0% when canceled and no percentage available", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "multi_nodes",
            status: "canceled",
            currentRun: undefined,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      // Note: canceled status shows 0% because it's not "completed"
      expect(screen.getByText(/Progress:/)).toHaveTextContent("Progress: 0%");
    });
  });

  // ==========================================================================
  // Status Display Tests
  // ==========================================================================

  describe("status display", () => {
    it("shows (canceled) suffix when status is canceled", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "canceled",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/\(canceled\)/)).toBeInTheDocument();
    });

    it("does not show (canceled) suffix when status is running", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "running",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.queryByText(/\(canceled\)/)).not.toBeInTheDocument();
    });

    it("does not show (canceled) suffix when status is completed", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "completed",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.queryByText(/\(canceled\)/)).not.toBeInTheDocument();
    });

    it("does not show (canceled) suffix when status is canceling", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "canceling",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.queryByText(/\(canceled\)/)).not.toBeInTheDocument();
    });

    it("does not show (canceled) suffix when status is pending", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "pending",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.queryByText(/\(canceled\)/)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Cancel Button Tests
  // ==========================================================================

  describe("cancel button", () => {
    it("shows Cancel button when status is running", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "running",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });

    it("shows Canceling button when status is canceling", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "canceling",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(
        screen.getByRole("button", { name: "Canceling" }),
      ).toBeInTheDocument();
    });

    it("Cancel button is enabled when status is running", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "running",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      expect(cancelButton).not.toBeDisabled();
    });

    it("Cancel button is disabled when status is canceling", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "canceling",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      const cancelingButton = screen.getByRole("button", { name: "Canceling" });
      expect(cancelingButton).toBeDisabled();
    });

    it("calls cancel from context when Cancel button is clicked", () => {
      const mockCancel = vi.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          cancel: mockCancel,
          actionState: createMockActionState({
            status: "running",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(mockCancel).toHaveBeenCalledTimes(1);
    });

    it("does not show Cancel button when status is completed", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "completed",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Canceling" }),
      ).not.toBeInTheDocument();
    });

    it("does not show Cancel button when status is canceled", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "canceled",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Canceling" }),
      ).not.toBeInTheDocument();
    });

    it("does not show Cancel button when status is pending", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "pending",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Canceling" }),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Close Button Tests
  // ==========================================================================

  describe("close button", () => {
    it("shows Close button when status is completed", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "completed",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });

    it("shows Close button when status is canceled", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "canceled",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });

    it("shows Close button when status is pending", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "pending",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });

    it("calls onClose prop when Close button is clicked", () => {
      const mockOnClose = vi.fn();
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "completed",
          }),
        }),
      );

      render(<ActionControlOss onClose={mockOnClose} />);

      const closeButton = screen.getByRole("button", { name: "Close" });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("does not show Close button when status is running", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "running",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(
        screen.queryByRole("button", { name: "Close" }),
      ).not.toBeInTheDocument();
    });

    it("does not show Close button when status is canceling", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            status: "canceling",
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(
        screen.queryByRole("button", { name: "Close" }),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("integration", () => {
    it("renders correctly in running state with per_node mode", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "per_node",
            status: "running",
            completed: 5,
            total: 10,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent(
        "Progress: 5 / 10",
      );
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/\(canceled\)/)).not.toBeInTheDocument();
    });

    it("renders correctly in canceling state with multi_nodes mode", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "multi_nodes",
            status: "canceling",
            currentRun: {
              progress: {
                percentage: 0.35,
              },
            },
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent("Progress: 35%");
      expect(screen.getByRole("button", { name: "Canceling" })).toBeDisabled();
      expect(screen.queryByText(/\(canceled\)/)).not.toBeInTheDocument();
    });

    it("renders correctly in canceled state", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "per_node",
            status: "canceled",
            completed: 3,
            total: 10,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent(
        "Progress: 3 / 10",
      );
      expect(screen.getByText(/\(canceled\)/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });

    it("renders correctly in completed state", () => {
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          actionState: createMockActionState({
            mode: "per_node",
            status: "completed",
            completed: 10,
            total: 10,
          }),
        }),
      );

      render(<ActionControlOss onClose={vi.fn()} />);

      expect(screen.getByText(/Progress:/)).toHaveTextContent(
        "Progress: 10 / 10",
      );
      expect(screen.queryByText(/\(canceled\)/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });

    it("transitions from running to canceling to canceled", () => {
      const mockCancel = vi.fn();
      const mockOnClose = vi.fn();

      // Initial running state
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          cancel: mockCancel,
          actionState: createMockActionState({
            status: "running",
            completed: 5,
            total: 10,
          }),
        }),
      );

      const { rerender } = render(<ActionControlOss onClose={mockOnClose} />);

      // Click cancel
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mockCancel).toHaveBeenCalledTimes(1);

      // Transition to canceling
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          cancel: mockCancel,
          actionState: createMockActionState({
            status: "canceling",
            completed: 5,
            total: 10,
          }),
        }),
      );
      rerender(<ActionControlOss onClose={mockOnClose} />);

      expect(screen.getByRole("button", { name: "Canceling" })).toBeDisabled();

      // Transition to canceled
      mockUseLineageViewContextSafe.mockReturnValue(
        createMockContext({
          cancel: mockCancel,
          actionState: createMockActionState({
            status: "canceled",
            completed: 5,
            total: 10,
          }),
        }),
      );
      rerender(<ActionControlOss onClose={mockOnClose} />);

      expect(screen.getByText(/\(canceled\)/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

      // Click close
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
