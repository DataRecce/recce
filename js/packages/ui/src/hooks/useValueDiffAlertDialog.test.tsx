/**
 * @file useValueDiffAlertDialog.test.tsx
 * @description Tests for useValueDiffAlertDialog hook
 *
 * Tests verify:
 * - Dialog opens when confirm() is called
 * - Dialog closes on confirm or cancel
 * - Promise resolves to true on confirm, false on cancel
 * - onConfirm callback is called with nodeCount when user confirms
 * - onCancel callback is called with nodeCount when user cancels
 * - Dialog displays correct nodeCount in message
 */

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";
import { useValueDiffAlertDialog } from "./useValueDiffAlertDialog";

// Helper component to render the hook and dialog
function TestComponent({
  onConfirm,
  onCancel,
}: {
  onConfirm?: (nodeCount: number) => void;
  onCancel?: (nodeCount: number) => void;
}) {
  const { confirm, AlertDialog } = useValueDiffAlertDialog({
    onConfirm,
    onCancel,
  });

  return (
    <div>
      <button onClick={() => confirm(5)} data-testid="trigger">
        Open Dialog
      </button>
      {AlertDialog}
    </div>
  );
}

describe("useValueDiffAlertDialog", () => {
  describe("dialog behavior", () => {
    it("opens the dialog when confirm() is called", () => {
      render(<TestComponent />);

      // Dialog should not be visible initially
      expect(
        screen.queryByText(/Value Diff on 5 nodes/),
      ).not.toBeInTheDocument();

      // Click to open dialog
      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      // Dialog should now be visible
      expect(screen.getByText(/Value Diff on 5 nodes/)).toBeInTheDocument();
    });

    it("displays the correct nodeCount in the dialog", () => {
      function CustomTestComponent() {
        const { confirm, AlertDialog } = useValueDiffAlertDialog();

        return (
          <div>
            <button onClick={() => confirm(10)} data-testid="trigger">
              Open Dialog
            </button>
            {AlertDialog}
          </div>
        );
      }

      render(<CustomTestComponent />);

      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      expect(screen.getByText(/Value Diff on 10 nodes/)).toBeInTheDocument();
      expect(
        screen.getByText(/will be executed on 10 nodes/),
      ).toBeInTheDocument();
    });

    it("closes the dialog when confirm button is clicked", async () => {
      render(<TestComponent />);

      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      expect(screen.getByText(/Value Diff on 5 nodes/)).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Execute" }));
      });

      // Wait for MUI Dialog animation to complete
      await waitFor(() => {
        expect(
          screen.queryByText(/Value Diff on 5 nodes/),
        ).not.toBeInTheDocument();
      });
    });

    it("closes the dialog when cancel button is clicked", async () => {
      render(<TestComponent />);

      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      expect(screen.getByText(/Value Diff on 5 nodes/)).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      });

      // Wait for MUI Dialog animation to complete
      await waitFor(() => {
        expect(
          screen.queryByText(/Value Diff on 5 nodes/),
        ).not.toBeInTheDocument();
      });
    });

    it("closes the dialog when close icon is clicked", async () => {
      render(<TestComponent />);

      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      expect(screen.getByText(/Value Diff on 5 nodes/)).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "close" }));
      });

      // Wait for MUI Dialog animation to complete
      await waitFor(() => {
        expect(
          screen.queryByText(/Value Diff on 5 nodes/),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("promise resolution", () => {
    it("resolves to true when user confirms", async () => {
      let confirmResult: boolean | undefined;

      function PromiseTestComponent() {
        const { confirm, AlertDialog } = useValueDiffAlertDialog();

        return (
          <div>
            <button
              onClick={async () => {
                confirmResult = await confirm(5);
              }}
              data-testid="trigger"
            >
              Open Dialog
            </button>
            {AlertDialog}
          </div>
        );
      }

      render(<PromiseTestComponent />);

      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Execute" }));
      });

      // Wait for the promise to resolve
      await waitFor(() => {
        expect(confirmResult).toBe(true);
      });
    });

    it("resolves to false when user cancels", async () => {
      let confirmResult: boolean | undefined;

      function PromiseTestComponent() {
        const { confirm, AlertDialog } = useValueDiffAlertDialog();

        return (
          <div>
            <button
              onClick={async () => {
                confirmResult = await confirm(5);
              }}
              data-testid="trigger"
            >
              Open Dialog
            </button>
            {AlertDialog}
          </div>
        );
      }

      render(<PromiseTestComponent />);

      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      });

      // Wait for the promise to resolve
      await waitFor(() => {
        expect(confirmResult).toBe(false);
      });
    });
  });

  describe("callback behavior", () => {
    it("calls onConfirm callback with nodeCount when user confirms", () => {
      const onConfirm = vi.fn();
      render(<TestComponent onConfirm={onConfirm} />);

      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Execute" }));
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(5);
    });

    it("calls onCancel callback with nodeCount when user cancels", () => {
      const onCancel = vi.fn();
      render(<TestComponent onCancel={onCancel} />);

      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onCancel).toHaveBeenCalledWith(5);
    });

    it("calls onCancel callback when dialog is closed via X button", () => {
      const onCancel = vi.fn();
      render(<TestComponent onCancel={onCancel} />);

      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "close" }));
      });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onCancel).toHaveBeenCalledWith(5);
    });

    it("does not call callbacks when not provided", () => {
      // Just verify no errors are thrown when callbacks are not provided
      render(<TestComponent />);

      act(() => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      // Should not throw
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Execute" }));
      });
    });
  });

  describe("hook return value", () => {
    it("returns confirm function and AlertDialog element", () => {
      const { result } = renderHook(() => useValueDiffAlertDialog());

      expect(typeof result.current.confirm).toBe("function");
      expect(result.current.AlertDialog).toBeDefined();
    });
  });
});
