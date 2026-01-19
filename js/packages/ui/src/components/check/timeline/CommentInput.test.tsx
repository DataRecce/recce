/**
 * @file CommentInput.test.tsx
 * @description Tests for CommentInput component
 *
 * Tests verify:
 * - Renders input and submit button
 * - Submits on button click
 * - Submits on Cmd/Ctrl+Enter
 * - Clears input after submit
 * - Disabled state
 * - Custom labels
 */

import { vi } from "vitest";

// Mock useIsDark hook
vi.mock("../../../hooks/useIsDark", () => ({
  useIsDark: () => false,
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentInput } from "./CommentInput";

describe("CommentInput", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  describe("rendering", () => {
    it("renders input field", () => {
      render(<CommentInput onSubmit={mockOnSubmit} />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders submit button", () => {
      render(<CommentInput onSubmit={mockOnSubmit} />);
      expect(
        screen.getByRole("button", { name: /comment/i }),
      ).toBeInTheDocument();
    });

    it("uses custom placeholder", () => {
      render(
        <CommentInput
          onSubmit={mockOnSubmit}
          placeholder="Leave feedback..."
        />,
      );
      expect(
        screen.getByPlaceholderText("Leave feedback..."),
      ).toBeInTheDocument();
    });

    it("uses default placeholder", () => {
      render(<CommentInput onSubmit={mockOnSubmit} />);
      expect(
        screen.getByPlaceholderText("Add a comment..."),
      ).toBeInTheDocument();
    });

    it("uses custom submit label", () => {
      render(<CommentInput onSubmit={mockOnSubmit} submitLabel="Send" />);
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    });
  });

  describe("submission", () => {
    it("calls onSubmit with trimmed content on button click", async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      await user.type(screen.getByRole("textbox"), "  Test comment  ");
      await user.click(screen.getByRole("button", { name: /comment/i }));

      expect(mockOnSubmit).toHaveBeenCalledWith("Test comment");
    });

    it("clears input after submit", async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      await user.type(screen.getByRole("textbox"), "Test comment");
      await user.click(screen.getByRole("button", { name: /comment/i }));

      expect(screen.getByRole("textbox")).toHaveValue("");
    });

    it("does not submit empty content (button is disabled)", () => {
      render(<CommentInput onSubmit={mockOnSubmit} />);

      // Button should be disabled when input is empty
      expect(screen.getByRole("button", { name: /comment/i })).toBeDisabled();
    });

    it("does not submit whitespace-only content (button stays disabled)", async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      await user.type(screen.getByRole("textbox"), "   ");

      // Button should still be disabled for whitespace-only content
      expect(screen.getByRole("button", { name: /comment/i })).toBeDisabled();
    });

    it("submits on Ctrl+Enter", async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "Test comment");
      await user.keyboard("{Control>}{Enter}{/Control}");

      expect(mockOnSubmit).toHaveBeenCalledWith("Test comment");
    });

    it("submits on Meta+Enter (Cmd on Mac)", async () => {
      const user = userEvent.setup();
      render(<CommentInput onSubmit={mockOnSubmit} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "Test comment");
      await user.keyboard("{Meta>}{Enter}{/Meta}");

      expect(mockOnSubmit).toHaveBeenCalledWith("Test comment");
    });
  });

  describe("disabled state", () => {
    it("disables input when submitting", () => {
      render(<CommentInput onSubmit={mockOnSubmit} isSubmitting />);
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("disables button when submitting", () => {
      render(<CommentInput onSubmit={mockOnSubmit} isSubmitting />);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("disables button when input is empty", () => {
      render(<CommentInput onSubmit={mockOnSubmit} />);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("shows submitting label when submitting", () => {
      render(<CommentInput onSubmit={mockOnSubmit} isSubmitting />);
      expect(
        screen.getByRole("button", { name: "Submitting..." }),
      ).toBeInTheDocument();
    });

    it("uses custom submitting label", () => {
      render(
        <CommentInput
          onSubmit={mockOnSubmit}
          isSubmitting
          submittingLabel="Sending..."
        />,
      );
      expect(
        screen.getByRole("button", { name: "Sending..." }),
      ).toBeInTheDocument();
    });
  });
});
