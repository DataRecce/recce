/**
 * @file useValueDiffAlertDialog.test.tsx
 * @description Tests for useValueDiffAlertDialog hook
 *
 * This hook provides a confirmation dialog for value diff operations on multiple nodes.
 * It returns a confirm function and an AlertDialog React element.
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

import useValueDiffAlertDialog from "@datarecce/ui/hooks/useValueDiffAlertDialogOss";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock tracking API
jest.mock("@datarecce/ui/lib/api/track", () => ({
  EXPLORE_ACTION: { VALUE_DIFF: "value_diff" },
  EXPLORE_FORM_EVENT: { EXECUTE: "execute", CANCEL: "cancel" },
  trackExploreActionForm: jest.fn(),
}));

// Import the mocked module for assertions
import { trackExploreActionForm } from "@datarecce/ui/lib/api/track";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Helper component to render the AlertDialog returned by the hook
 */
function DialogRenderer({
  hookResult,
}: {
  hookResult: ReturnType<typeof useValueDiffAlertDialog>;
}) {
  return <>{hookResult.AlertDialog}</>;
}

/**
 * Renders the hook and its AlertDialog for testing
 */
function renderHookWithDialog() {
  const hookResult = renderHook(() => useValueDiffAlertDialog());

  // Render the AlertDialog so we can interact with it
  const dialogRender = render(
    <DialogRenderer hookResult={hookResult.result.current} />,
  );

  return {
    hookResult,
    dialogRender,
    rerender: () => {
      dialogRender.rerender(
        <DialogRenderer hookResult={hookResult.result.current} />,
      );
    },
  };
}

// ============================================================================
// Hook Return Value Tests
// ============================================================================

describe("useValueDiffAlertDialog - hook return value", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns confirm function", () => {
    const { result } = renderHook(() => useValueDiffAlertDialog());

    expect(result.current.confirm).toBeDefined();
    expect(typeof result.current.confirm).toBe("function");
  });

  it("returns AlertDialog React element", () => {
    const { result } = renderHook(() => useValueDiffAlertDialog());

    expect(result.current.AlertDialog).toBeDefined();
    // AlertDialog should be a valid React element
    expect(result.current.AlertDialog).not.toBeNull();
  });
});

// ============================================================================
// Dialog Rendering Tests
// ============================================================================

describe("useValueDiffAlertDialog - dialog rendering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dialog is initially closed (not visible)", () => {
    renderHookWithDialog();

    // Dialog should not be visible initially
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Value Diff on \d+ nodes/),
    ).not.toBeInTheDocument();
  });

  it("calling confirm() opens dialog", async () => {
    const { hookResult, rerender } = renderHookWithDialog();

    // Call confirm with a node count
    act(() => {
      hookResult.result.current.confirm(5);
    });

    // Rerender to reflect the state change
    rerender();

    // Dialog should now be visible
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("dialog displays correct node count in title", async () => {
    const { hookResult, rerender } = renderHookWithDialog();

    // Call confirm with specific node count
    act(() => {
      hookResult.result.current.confirm(7);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByText("Value Diff on 7 nodes")).toBeInTheDocument();
    });
  });

  it("dialog displays different node counts correctly", async () => {
    const { hookResult, rerender } = renderHookWithDialog();

    // Test with node count of 1
    act(() => {
      hookResult.result.current.confirm(1);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByText("Value Diff on 1 nodes")).toBeInTheDocument();
    });
  });

  it("dialog displays warning message about costs", async () => {
    const { hookResult, rerender } = renderHookWithDialog();

    act(() => {
      hookResult.result.current.confirm(3);
    });

    rerender();

    await waitFor(() => {
      expect(
        screen.getByText(/Value diff will be executed on 3 nodes/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/can add extra costs to your bill/),
      ).toBeInTheDocument();
    });
  });

  it("dialog has Execute and Cancel buttons", async () => {
    const { hookResult, rerender } = renderHookWithDialog();

    act(() => {
      hookResult.result.current.confirm(2);
    });

    rerender();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Execute" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });
  });

  it("dialog has close button", async () => {
    const { hookResult, rerender } = renderHookWithDialog();

    act(() => {
      hookResult.result.current.confirm(2);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "close" })).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Confirm Behavior Tests
// ============================================================================

describe("useValueDiffAlertDialog - confirm behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Execute button resolves promise with true", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    let resolvedValue: boolean | undefined;

    // Call confirm and capture the promise
    act(() => {
      hookResult.result.current.confirm(5).then((value) => {
        resolvedValue = value;
      });
    });

    rerender();

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click Execute button
    const executeButton = screen.getByRole("button", { name: "Execute" });
    await user.click(executeButton);

    // Verify promise resolved with true
    await waitFor(() => {
      expect(resolvedValue).toBe(true);
    });
  });

  it("Execute button closes dialog", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    act(() => {
      hookResult.result.current.confirm(5);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click Execute button
    const executeButton = screen.getByRole("button", { name: "Execute" });
    await user.click(executeButton);

    rerender();

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("Execute button calls tracking function with correct params", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    act(() => {
      hookResult.result.current.confirm(5);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click Execute button
    const executeButton = screen.getByRole("button", { name: "Execute" });
    await user.click(executeButton);

    // Verify tracking was called with correct parameters
    expect(trackExploreActionForm).toHaveBeenCalledWith({
      action: "value_diff",
      event: "execute",
    });
  });
});

// ============================================================================
// Cancel Behavior Tests
// ============================================================================

describe("useValueDiffAlertDialog - cancel behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Cancel button resolves promise with false", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    let resolvedValue: boolean | undefined;

    act(() => {
      hookResult.result.current.confirm(5).then((value) => {
        resolvedValue = value;
      });
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click Cancel button
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    // Verify promise resolved with false
    await waitFor(() => {
      expect(resolvedValue).toBe(false);
    });
  });

  it("Cancel button closes dialog", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    act(() => {
      hookResult.result.current.confirm(5);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click Cancel button
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    rerender();

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("Cancel button calls tracking function with correct params", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    act(() => {
      hookResult.result.current.confirm(5);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click Cancel button
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    // Verify tracking was called with correct parameters
    expect(trackExploreActionForm).toHaveBeenCalledWith({
      action: "value_diff",
      event: "cancel",
    });
  });

  it("Close (X) button resolves promise with false", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    let resolvedValue: boolean | undefined;

    act(() => {
      hookResult.result.current.confirm(5).then((value) => {
        resolvedValue = value;
      });
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click close (X) button
    const closeButton = screen.getByRole("button", { name: "close" });
    await user.click(closeButton);

    // Verify promise resolved with false
    await waitFor(() => {
      expect(resolvedValue).toBe(false);
    });
  });

  it("Close (X) button closes dialog", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    act(() => {
      hookResult.result.current.confirm(5);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click close (X) button
    const closeButton = screen.getByRole("button", { name: "close" });
    await user.click(closeButton);

    rerender();

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("Close (X) button calls tracking function with cancel params", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    act(() => {
      hookResult.result.current.confirm(5);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Click close (X) button
    const closeButton = screen.getByRole("button", { name: "close" });
    await user.click(closeButton);

    // Verify tracking was called with cancel parameters
    expect(trackExploreActionForm).toHaveBeenCalledWith({
      action: "value_diff",
      event: "cancel",
    });
  });
});

// ============================================================================
// Multiple Confirm Calls Tests
// ============================================================================

describe("useValueDiffAlertDialog - multiple confirm calls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("can be confirmed multiple times", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    // First confirmation
    let resolvedValue1: boolean | undefined;
    act(() => {
      hookResult.result.current.confirm(3).then((value) => {
        resolvedValue1 = value;
      });
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const executeButton = screen.getByRole("button", { name: "Execute" });
    await user.click(executeButton);

    rerender();

    await waitFor(() => {
      expect(resolvedValue1).toBe(true);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Second confirmation with different node count
    let resolvedValue2: boolean | undefined;
    act(() => {
      hookResult.result.current.confirm(10).then((value) => {
        resolvedValue2 = value;
      });
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Value Diff on 10 nodes")).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(resolvedValue2).toBe(false);
    });
  });

  it("updates node count when confirm is called again", async () => {
    const user = userEvent.setup();
    const { hookResult, rerender } = renderHookWithDialog();

    // First confirmation
    act(() => {
      hookResult.result.current.confirm(5);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByText("Value Diff on 5 nodes")).toBeInTheDocument();
    });

    // Close dialog
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    rerender();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Second confirmation with different count
    act(() => {
      hookResult.result.current.confirm(15);
    });

    rerender();

    await waitFor(() => {
      expect(screen.getByText("Value Diff on 15 nodes")).toBeInTheDocument();
      // Content should also reflect the new count
      expect(
        screen.getByText(/Value diff will be executed on 15 nodes/),
      ).toBeInTheDocument();
    });
  });
});
