/**
 * @file ActionControl.test.tsx
 * @description Tests for ActionControl component in @datarecce/ui
 *
 * This tests the props-based ActionControl component that displays
 * progress and control buttons for batch operations on lineage graph nodes.
 */

import { fireEvent, render, screen } from "@testing-library/react";

import type { ActionState } from "../../../../contexts/lineage/types";
import { ActionControl } from "../ActionControl";

/**
 * Create a mock ActionState for testing
 */
function createMockActionState(
  overrides: Partial<ActionState> = {},
): ActionState {
  return {
    mode: "per_node",
    status: "running",
    completed: 0,
    total: 10,
    actions: {},
    ...overrides,
  };
}

describe("ActionControl (@datarecce/ui)", () => {
  describe("rendering", () => {
    it("renders progress and cancel button when running", () => {
      const mockCancel = jest.fn();
      const mockClose = jest.fn();

      render(
        <ActionControl
          actionState={createMockActionState({
            status: "running",
            completed: 3,
            total: 10,
          })}
          onCancel={mockCancel}
          onClose={mockClose}
        />,
      );

      expect(screen.getByText(/Progress: 3 \/ 10/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Close" }),
      ).not.toBeInTheDocument();
    });

    it("renders close button when completed", () => {
      const mockCancel = jest.fn();
      const mockClose = jest.fn();

      render(
        <ActionControl
          actionState={createMockActionState({
            status: "completed",
            completed: 10,
            total: 10,
          })}
          onCancel={mockCancel}
          onClose={mockClose}
        />,
      );

      expect(screen.getByText(/Progress: 10 \/ 10/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
    });

    it("renders canceled indicator when status is canceled", () => {
      const mockCancel = jest.fn();
      const mockClose = jest.fn();

      render(
        <ActionControl
          actionState={createMockActionState({
            status: "canceled",
            completed: 5,
            total: 10,
          })}
          onCancel={mockCancel}
          onClose={mockClose}
        />,
      );

      expect(screen.getByText(/\(canceled\)/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });

    it("shows canceling button when status is canceling", () => {
      const mockCancel = jest.fn();
      const mockClose = jest.fn();

      render(
        <ActionControl
          actionState={createMockActionState({
            status: "canceling",
            completed: 5,
            total: 10,
          })}
          onCancel={mockCancel}
          onClose={mockClose}
        />,
      );

      const cancelingButton = screen.getByRole("button", { name: "Canceling" });
      expect(cancelingButton).toBeInTheDocument();
      expect(cancelingButton).toBeDisabled();
    });
  });

  describe("progress message - per_node mode", () => {
    it("displays completed / total format", () => {
      render(
        <ActionControl
          actionState={createMockActionState({
            mode: "per_node",
            completed: 7,
            total: 15,
            status: "running",
          })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText(/Progress: 7 \/ 15/)).toBeInTheDocument();
    });

    it("displays 0 / total at start", () => {
      render(
        <ActionControl
          actionState={createMockActionState({
            mode: "per_node",
            completed: 0,
            total: 5,
            status: "running",
          })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText(/Progress: 0 \/ 5/)).toBeInTheDocument();
    });
  });

  describe("progress message - multi_nodes mode", () => {
    it("displays percentage when currentRun has progress", () => {
      render(
        <ActionControl
          actionState={createMockActionState({
            mode: "multi_nodes",
            status: "running",
            currentRun: {
              progress: {
                percentage: 0.75,
              },
            },
          })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText(/Progress: 75%/)).toBeInTheDocument();
    });

    it("displays 100% when completed without currentRun progress", () => {
      render(
        <ActionControl
          actionState={createMockActionState({
            mode: "multi_nodes",
            status: "completed",
          })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText(/Progress: 100%/)).toBeInTheDocument();
    });

    it("displays 0% when running without currentRun progress", () => {
      render(
        <ActionControl
          actionState={createMockActionState({
            mode: "multi_nodes",
            status: "running",
          })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText(/Progress: 0%/)).toBeInTheDocument();
    });

    it("displays 0% when pending without currentRun progress", () => {
      render(
        <ActionControl
          actionState={createMockActionState({
            mode: "multi_nodes",
            status: "pending",
          })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText(/Progress: 0%/)).toBeInTheDocument();
    });
  });

  describe("callbacks", () => {
    it("calls onCancel when Cancel button is clicked", () => {
      const mockCancel = jest.fn();
      const mockClose = jest.fn();

      render(
        <ActionControl
          actionState={createMockActionState({ status: "running" })}
          onCancel={mockCancel}
          onClose={mockClose}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(mockCancel).toHaveBeenCalledTimes(1);
      expect(mockClose).not.toHaveBeenCalled();
    });

    it("calls onClose when Close button is clicked", () => {
      const mockCancel = jest.fn();
      const mockClose = jest.fn();

      render(
        <ActionControl
          actionState={createMockActionState({ status: "completed" })}
          onCancel={mockCancel}
          onClose={mockClose}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(mockCancel).not.toHaveBeenCalled();
    });

    it("does not call onCancel when Canceling button is clicked (disabled)", () => {
      const mockCancel = jest.fn();
      const mockClose = jest.fn();

      render(
        <ActionControl
          actionState={createMockActionState({ status: "canceling" })}
          onCancel={mockCancel}
          onClose={mockClose}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Canceling" }));

      expect(mockCancel).not.toHaveBeenCalled();
    });
  });

  describe("status transitions", () => {
    it("shows Cancel button for running status", () => {
      render(
        <ActionControl
          actionState={createMockActionState({ status: "running" })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });

    it("shows disabled Canceling button for canceling status", () => {
      render(
        <ActionControl
          actionState={createMockActionState({ status: "canceling" })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      const button = screen.getByRole("button", { name: "Canceling" });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it("shows Close button for canceled status", () => {
      render(
        <ActionControl
          actionState={createMockActionState({ status: "canceled" })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });

    it("shows Close button for completed status", () => {
      render(
        <ActionControl
          actionState={createMockActionState({ status: "completed" })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });

    it("shows Close button for pending status", () => {
      render(
        <ActionControl
          actionState={createMockActionState({ status: "pending" })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles zero total gracefully", () => {
      render(
        <ActionControl
          actionState={createMockActionState({
            mode: "per_node",
            completed: 0,
            total: 0,
            status: "completed",
          })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText(/Progress: 0 \/ 0/)).toBeInTheDocument();
    });

    it("handles currentRun with missing progress field", () => {
      render(
        <ActionControl
          actionState={createMockActionState({
            mode: "multi_nodes",
            status: "running",
            currentRun: {},
          })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText(/Progress: 0%/)).toBeInTheDocument();
    });

    it("handles currentRun with zero percentage", () => {
      render(
        <ActionControl
          actionState={createMockActionState({
            mode: "multi_nodes",
            status: "running",
            currentRun: {
              progress: {
                percentage: 0,
              },
            },
          })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      // 0 * 100 = 0, but percentage is falsy so it falls through
      expect(screen.getByText(/Progress: 0%/)).toBeInTheDocument();
    });

    it("handles currentRun with 100% percentage", () => {
      render(
        <ActionControl
          actionState={createMockActionState({
            mode: "multi_nodes",
            status: "running",
            currentRun: {
              progress: {
                percentage: 1,
              },
            },
          })}
          onCancel={jest.fn()}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText(/Progress: 100%/)).toBeInTheDocument();
    });
  });
});
