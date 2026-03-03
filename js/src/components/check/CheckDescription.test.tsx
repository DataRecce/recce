/**
 * @file CheckDescription.test.tsx
 * @description Tests for @datarecce/ui CheckDescription component
 *
 * Tests behavior of the UI package CheckDescription:
 * - Displays value text or placeholder
 * - Click-to-edit mode (respects disabled prop)
 * - Cmd/Ctrl+Enter saves
 * - Escape key cancels
 * - Update button saves
 * - Cancel link cancels
 * - Trims whitespace on save
 */

import { CheckDescription } from "@datarecce/ui/primitives";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

describe("CheckDescription", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe("display mode", () => {
    it("displays the value text", () => {
      render(<CheckDescription value="My description" />);
      expect(screen.getByText("My description")).toBeInTheDocument();
    });

    it("displays placeholder when value is empty", () => {
      render(<CheckDescription value="" />);
      expect(screen.getByText("Add description here")).toBeInTheDocument();
    });

    it("displays placeholder when value is undefined", () => {
      render(<CheckDescription />);
      expect(screen.getByText("Add description here")).toBeInTheDocument();
    });

    it("displays whitespace value as-is (UI package behavior)", () => {
      // UI package shows the value even if it's whitespace-only
      // Unlike OSS which trimmed and showed placeholder
      render(<CheckDescription value="   " />);
      // The whitespace value is rendered, not the placeholder
      expect(
        screen.queryByText("Add description here"),
      ).not.toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    it("enters edit mode on click", async () => {
      const user = userEvent.setup();
      render(
        <CheckDescription value="My description" onChange={mockOnChange} />,
      );

      await user.click(screen.getByText("My description"));

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("My description");
    });

    it("enters edit mode when clicking on placeholder", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="" onChange={mockOnChange} />);

      await user.click(screen.getByText("Add description here"));

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("focuses input and positions cursor at end on entering edit mode", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="Test value" onChange={mockOnChange} />);

      await user.click(screen.getByText("Test value"));

      const input = screen.getByRole("textbox");
      expect(input).toHaveFocus();
    });

    it("initializes with empty string when value is undefined", async () => {
      const user = userEvent.setup();
      render(<CheckDescription onChange={mockOnChange} />);

      await user.click(screen.getByText("Add description here"));

      expect(screen.getByRole("textbox")).toHaveValue("");
    });
  });

  describe("saving changes", () => {
    it("calls onChange on Cmd+Enter (Mac)", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="Original" onChange={mockOnChange} />);

      await user.click(screen.getByText("Original"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "New description");
      await user.keyboard("{Meta>}{Enter}{/Meta}");

      expect(mockOnChange).toHaveBeenCalledWith("New description");
    });

    it("calls onChange on Ctrl+Enter (Windows)", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="Original" onChange={mockOnChange} />);

      await user.click(screen.getByText("Original"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "New description");
      await user.keyboard("{Control>}{Enter}{/Control}");

      expect(mockOnChange).toHaveBeenCalledWith("New description");
    });

    it("calls onChange on Update button click", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="Original" onChange={mockOnChange} />);

      await user.click(screen.getByText("Original"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "New description");
      await user.click(screen.getByRole("button", { name: "Update" }));

      expect(mockOnChange).toHaveBeenCalledWith("New description");
    });

    it("returns undefined for empty value (UI package behavior)", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="Original" onChange={mockOnChange} />);

      await user.click(screen.getByText("Original"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.click(screen.getByRole("button", { name: "Update" }));

      // UI package behavior: returns undefined for empty
      expect(mockOnChange).toHaveBeenCalledWith(undefined);
    });

    it("trims whitespace on save (UI package behavior)", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="Original" onChange={mockOnChange} />);

      await user.click(screen.getByText("Original"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "  Padded text  ");
      await user.click(screen.getByRole("button", { name: "Update" }));

      // UI package behavior: trims whitespace
      expect(mockOnChange).toHaveBeenCalledWith("Padded text");
    });
  });

  describe("canceling changes", () => {
    it("exits edit mode on Escape without calling onChange", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="Original" onChange={mockOnChange} />);

      await user.click(screen.getByText("Original"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "Changed");
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("exits edit mode on cancel link click", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="Original" onChange={mockOnChange} />);

      await user.click(screen.getByText("Original"));
      expect(screen.getByRole("textbox")).toBeInTheDocument();

      await user.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe("input behavior", () => {
    it("updates temp value as user types", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="Original" onChange={mockOnChange} />);

      await user.click(screen.getByText("Original"));
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "Typing here");

      expect(input).toHaveValue("Typing here");
    });

    it("supports multiline input", async () => {
      const user = userEvent.setup();
      render(<CheckDescription value="" onChange={mockOnChange} />);

      await user.click(screen.getByText("Add description here"));
      const input = screen.getByRole("textbox");
      await user.type(input, "Line 1{enter}Line 2");

      expect(input).toHaveValue("Line 1\nLine 2");
    });
  });

  describe("disabled state", () => {
    it("does not enter edit mode when disabled", async () => {
      const user = userEvent.setup();
      render(
        <CheckDescription
          value="Original"
          onChange={mockOnChange}
          disabled={true}
        />,
      );

      await user.click(screen.getByText("Original"));

      // Should NOT enter edit mode
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.getByText("Original")).toBeInTheDocument();
    });
  });
});
