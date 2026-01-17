/**
 * @file CheckBreadcrumb.test.tsx
 * @description Tests for CheckBreadcrumb component
 *
 * Tests verify:
 * - Displays name text
 * - Shows placeholder when name is empty
 * - Enters edit mode on click
 * - Saves on Enter key
 * - Cancels on Escape key
 * - Respects disabled state
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { CheckBreadcrumb } from "./CheckBreadcrumb";

describe("CheckBreadcrumb", () => {
  const mockOnNameChange = vi.fn();

  beforeEach(() => {
    mockOnNameChange.mockClear();
  });

  describe("display mode", () => {
    it("displays the name text", () => {
      render(<CheckBreadcrumb name="My Check" />);
      expect(screen.getByText("My Check")).toBeInTheDocument();
    });

    it("displays placeholder when name is empty", () => {
      render(<CheckBreadcrumb name="" placeholder="Unnamed check" />);
      expect(screen.getByText("Unnamed check")).toBeInTheDocument();
    });

    it("uses default placeholder when not specified", () => {
      render(<CheckBreadcrumb name="" />);
      expect(screen.getByText("Unnamed check")).toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    it("enters edit mode on click", async () => {
      const user = userEvent.setup();
      render(
        <CheckBreadcrumb name="My Check" onNameChange={mockOnNameChange} />,
      );

      await user.click(screen.getByText("My Check"));

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("My Check");
    });

    it("does not enter edit mode when disabled", async () => {
      const user = userEvent.setup();
      render(<CheckBreadcrumb name="My Check" disabled />);

      await user.click(screen.getByText("My Check"));

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("focuses and selects input on entering edit mode", async () => {
      const user = userEvent.setup();
      render(
        <CheckBreadcrumb name="My Check" onNameChange={mockOnNameChange} />,
      );

      await user.click(screen.getByText("My Check"));

      const input = screen.getByRole("textbox");
      expect(input).toHaveFocus();
    });
  });

  describe("saving changes", () => {
    it("calls onNameChange on Enter when value changed", async () => {
      const user = userEvent.setup();
      render(
        <CheckBreadcrumb name="My Check" onNameChange={mockOnNameChange} />,
      );

      await user.click(screen.getByText("My Check"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "New Name{Enter}");

      expect(mockOnNameChange).toHaveBeenCalledWith("New Name");
    });

    it("does not call onNameChange when value unchanged", async () => {
      const user = userEvent.setup();
      render(
        <CheckBreadcrumb name="My Check" onNameChange={mockOnNameChange} />,
      );

      await user.click(screen.getByText("My Check"));
      await user.keyboard("{Enter}");

      expect(mockOnNameChange).not.toHaveBeenCalled();
    });

    it("trims whitespace before saving", async () => {
      const user = userEvent.setup();
      render(
        <CheckBreadcrumb name="My Check" onNameChange={mockOnNameChange} />,
      );

      await user.click(screen.getByText("My Check"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "  Trimmed Name  {Enter}");

      expect(mockOnNameChange).toHaveBeenCalledWith("Trimmed Name");
    });

    it("does not save empty value", async () => {
      const user = userEvent.setup();
      render(
        <CheckBreadcrumb name="My Check" onNameChange={mockOnNameChange} />,
      );

      await user.click(screen.getByText("My Check"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.keyboard("{Enter}");

      expect(mockOnNameChange).not.toHaveBeenCalled();
    });
  });

  describe("canceling changes", () => {
    it("reverts to original value on Escape", async () => {
      const user = userEvent.setup();
      render(
        <CheckBreadcrumb name="My Check" onNameChange={mockOnNameChange} />,
      );

      await user.click(screen.getByText("My Check"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "Changed");
      await user.keyboard("{Escape}");

      expect(mockOnNameChange).not.toHaveBeenCalled();
      expect(screen.getByText("My Check")).toBeInTheDocument();
    });
  });

  describe("click outside behavior", () => {
    it("commits changes when clicking outside", async () => {
      const user = userEvent.setup();
      render(
        <div>
          <CheckBreadcrumb name="My Check" onNameChange={mockOnNameChange} />
          <button type="button">Outside</button>
        </div>,
      );

      await user.click(screen.getByText("My Check"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "New Name");

      // Click outside
      fireEvent.mouseDown(screen.getByText("Outside"));

      await waitFor(() => {
        expect(mockOnNameChange).toHaveBeenCalledWith("New Name");
      });
    });
  });

  describe("external name changes", () => {
    it("updates when name prop changes", () => {
      const { rerender } = render(<CheckBreadcrumb name="Original" />);
      expect(screen.getByText("Original")).toBeInTheDocument();

      rerender(<CheckBreadcrumb name="Updated" />);
      expect(screen.getByText("Updated")).toBeInTheDocument();
    });
  });
});
