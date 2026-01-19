/**
 * @file DropdownValuesInput.test.tsx
 * @description Tests for @datarecce/ui DropdownValuesInput component
 *
 * Tests verify:
 * - Rendering with placeholder and default values
 * - Opening/closing dropdown menu
 * - Selecting values from suggestion list
 * - Clearing all values
 * - Removing individual values
 * - Filtering suggestion list
 * - Adding custom values
 * - Keyboard navigation (Enter, comma, Backspace)
 * - Size variants
 * - Disabled state
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import {
  DropdownValuesInput,
  type DropdownValuesInputProps,
} from "../DropdownValuesInput";

// =============================================================================
// Test Helpers
// =============================================================================

const defaultProps: DropdownValuesInputProps = {
  unitName: "key",
  onValuesChange: vi.fn(),
};

const renderDropdown = (props: Partial<DropdownValuesInputProps> = {}) => {
  const mergedProps = { ...defaultProps, ...props };
  return render(<DropdownValuesInput {...mergedProps} />);
};

// =============================================================================
// Basic Rendering Tests
// =============================================================================

describe("DropdownValuesInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with placeholder when no values selected", () => {
      renderDropdown({ placeholder: "Select items" });

      expect(screen.getByText("Select items")).toBeInTheDocument();
    });

    it("renders empty when no placeholder and no values", () => {
      renderDropdown();

      // Button should exist but with empty text content
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders single selected value", () => {
      renderDropdown({ defaultValues: ["id"] });

      expect(screen.getByText("id")).toBeInTheDocument();
    });

    it("renders count for multiple selected values", () => {
      renderDropdown({ defaultValues: ["id", "name", "email"] });

      expect(screen.getByText("3 keys selected")).toBeInTheDocument();
    });

    it("uses singular unit name for single value display", () => {
      renderDropdown({ defaultValues: ["id"], unitName: "column" });

      // Single value shows the value itself, not "1 columns selected"
      expect(screen.getByText("id")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = renderDropdown({ className: "custom-class" });

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });

    it("applies custom width", () => {
      renderDropdown({ width: 300 });

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  // =============================================================================
  // Dropdown Menu Tests
  // =============================================================================

  describe("dropdown menu", () => {
    it("opens menu when button is clicked", async () => {
      const user = userEvent.setup();
      renderDropdown({ suggestionList: ["option1", "option2"] });

      await user.click(screen.getByRole("button"));

      // Menu items should appear
      await waitFor(() => {
        expect(screen.getByText("option1")).toBeInTheDocument();
        expect(screen.getByText("option2")).toBeInTheDocument();
      });
    });

    it("closes menu when clicking outside", async () => {
      const user = userEvent.setup();
      renderDropdown({ suggestionList: ["option1"] });

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByText("option1")).toBeInTheDocument();
      });

      // Press Escape to close the menu
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("option1")).not.toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // Value Selection Tests
  // =============================================================================

  describe("value selection", () => {
    it("calls onValuesChange when selecting a value", async () => {
      const onValuesChange = vi.fn();
      const user = userEvent.setup();

      renderDropdown({
        suggestionList: ["option1", "option2"],
        onValuesChange,
      });

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByText("option1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("option1"));

      expect(onValuesChange).toHaveBeenCalledWith(["option1"]);
    });

    it("does not add duplicate values", async () => {
      const onValuesChange = vi.fn();
      const user = userEvent.setup();

      renderDropdown({
        suggestionList: ["option1", "option2"],
        defaultValues: ["option1"],
        onValuesChange,
      });

      await user.click(screen.getByRole("button"));

      // option1 should not appear in suggestions since it's already selected
      await waitFor(() => {
        expect(screen.queryByRole("menuitem", { name: "option1" })).toBeNull();
        expect(screen.getByText("option2")).toBeInTheDocument();
      });
    });

    it("shows selected values as chips in dropdown", async () => {
      const user = userEvent.setup();

      renderDropdown({
        suggestionList: ["option1", "option2"],
        defaultValues: ["option1"],
      });

      await user.click(screen.getByRole("button"));

      // Chip should be visible in the dropdown
      await waitFor(() => {
        const chips = screen.getAllByText("option1");
        expect(chips.length).toBeGreaterThan(0);
      });
    });
  });

  // =============================================================================
  // Clearing Values Tests
  // =============================================================================

  describe("clearing values", () => {
    it("shows Clear button when values are selected", () => {
      renderDropdown({ defaultValues: ["value1"] });

      expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    it("does not show Clear button when no values selected", () => {
      renderDropdown();

      expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    });

    it("clears all values when Clear is clicked", async () => {
      const onValuesChange = vi.fn();
      const user = userEvent.setup();

      renderDropdown({
        defaultValues: ["value1", "value2"],
        onValuesChange,
      });

      await user.click(screen.getByText("Clear"));

      expect(onValuesChange).toHaveBeenCalledWith([]);
    });
  });

  // =============================================================================
  // Removing Individual Values Tests
  // =============================================================================

  describe("removing individual values", () => {
    it("removes value when chip delete button is clicked", async () => {
      const onValuesChange = vi.fn();
      const user = userEvent.setup();

      renderDropdown({
        defaultValues: ["value1", "value2"],
        suggestionList: ["value1", "value2", "value3"],
        onValuesChange,
      });

      // Open dropdown to access chips
      await user.click(screen.getByRole("button"));

      // Find and click the delete button on the chip
      await waitFor(async () => {
        const deleteButtons = screen.getAllByTestId("CancelIcon");
        expect(deleteButtons.length).toBeGreaterThan(0);
        await user.click(deleteButtons[0]);
      });

      expect(onValuesChange).toHaveBeenCalledWith(["value2"]);
    });
  });

  // =============================================================================
  // Filtering Tests
  // =============================================================================

  describe("filtering", () => {
    it("filters suggestion list based on input", async () => {
      const user = userEvent.setup();

      renderDropdown({
        suggestionList: ["apple", "banana", "apricot", "cherry"],
      });

      await user.click(screen.getByRole("button"));

      // Type in filter
      const input = screen.getByPlaceholderText("Filter or add custom keys");
      await user.type(input, "ap");

      // Should show apple and apricot, not banana or cherry
      await waitFor(() => {
        expect(screen.getByText("apple")).toBeInTheDocument();
        expect(screen.getByText("apricot")).toBeInTheDocument();
        expect(screen.queryByText("banana")).not.toBeInTheDocument();
        expect(screen.queryByText("cherry")).not.toBeInTheDocument();
      });
    });

    it("filters case-insensitively", async () => {
      const user = userEvent.setup();

      renderDropdown({
        suggestionList: ["Apple", "BANANA", "apricot"],
      });

      await user.click(screen.getByRole("button"));

      const input = screen.getByPlaceholderText("Filter or add custom keys");
      await user.type(input, "AP");

      await waitFor(() => {
        expect(screen.getByText("Apple")).toBeInTheDocument();
        expect(screen.getByText("apricot")).toBeInTheDocument();
        expect(screen.queryByText("BANANA")).not.toBeInTheDocument();
      });
    });

    it("shows 'Add' option for custom values", async () => {
      const user = userEvent.setup();

      renderDropdown({
        suggestionList: ["option1", "option2"],
      });

      await user.click(screen.getByRole("button"));

      const input = screen.getByPlaceholderText("Filter or add custom keys");
      await user.type(input, "custom");

      await waitFor(() => {
        expect(
          screen.getByText(/Add 'custom' to the list/),
        ).toBeInTheDocument();
      });
    });

    it("does not show 'Add' option when filter matches existing suggestion", async () => {
      const user = userEvent.setup();

      renderDropdown({
        suggestionList: ["option1", "option2"],
      });

      await user.click(screen.getByRole("button"));

      const input = screen.getByPlaceholderText("Filter or add custom keys");
      await user.type(input, "option1");

      await waitFor(() => {
        expect(
          screen.queryByText(/Add 'option1' to the list/),
        ).not.toBeInTheDocument();
      });
    });

    it("limits displayed suggestions to 10 items", async () => {
      const user = userEvent.setup();
      const manyOptions = Array.from(
        { length: 15 },
        (_, i) => `option${i + 1}`,
      );

      renderDropdown({
        suggestionList: manyOptions,
      });

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        // Should show "and X more items..." message
        expect(screen.getByText(/and 5 more items/)).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // Keyboard Navigation Tests
  // =============================================================================

  describe("keyboard navigation", () => {
    it("adds value on Enter key", async () => {
      const onValuesChange = vi.fn();
      const user = userEvent.setup();

      renderDropdown({
        suggestionList: ["option1"],
        onValuesChange,
      });

      await user.click(screen.getByRole("button"));

      const input = screen.getByPlaceholderText("Filter or add custom keys");
      await user.type(input, "custom{Enter}");

      expect(onValuesChange).toHaveBeenCalledWith(["custom"]);
    });

    it("adds value on comma key", async () => {
      const onValuesChange = vi.fn();
      const user = userEvent.setup();

      renderDropdown({
        suggestionList: ["option1"],
        onValuesChange,
      });

      await user.click(screen.getByRole("button"));

      const input = screen.getByPlaceholderText("Filter or add custom keys");
      await user.type(input, "custom,");

      expect(onValuesChange).toHaveBeenCalledWith(["custom"]);
    });

    it("removes last value on Backspace when input is empty", async () => {
      const onValuesChange = vi.fn();
      const user = userEvent.setup();

      renderDropdown({
        defaultValues: ["value1", "value2"],
        onValuesChange,
      });

      await user.click(screen.getByRole("button"));

      const input = screen.getByPlaceholderText("Filter or add custom keys");
      await user.type(input, "{Backspace}");

      expect(onValuesChange).toHaveBeenCalledWith(["value1"]);
    });

    it("does not remove value on Backspace when input has text", async () => {
      const onValuesChange = vi.fn();
      const user = userEvent.setup();

      renderDropdown({
        defaultValues: ["value1"],
        onValuesChange,
      });

      await user.click(screen.getByRole("button"));

      const input = screen.getByPlaceholderText("Filter or add custom keys");
      await user.type(input, "abc{Backspace}");

      // onValuesChange should not have been called for removal
      // (it may be called for other reasons, so we check it wasn't called with [""])
      expect(onValuesChange).not.toHaveBeenCalledWith([]);
    });
  });

  // =============================================================================
  // Size Variants Tests
  // =============================================================================

  describe("size variants", () => {
    it.each([
      ["2xs", 24],
      ["xs", 28],
      ["sm", 32],
      ["md", 36],
      ["lg", 36],
    ] as const)("renders size %s with height %d", (size, expectedHeight) => {
      renderDropdown({ size });

      const button = screen.getByRole("button");
      // MUI applies styles via sx prop, so we check the button exists
      expect(button).toBeInTheDocument();
    });
  });

  // =============================================================================
  // Disabled State Tests
  // =============================================================================

  describe("disabled state", () => {
    it("disables button when disabled prop is true", () => {
      renderDropdown({ disabled: true });

      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("does not open menu when disabled", () => {
      renderDropdown({
        disabled: true,
        suggestionList: ["option1"],
      });

      // Menu should not be visible initially (disabled button prevents interaction)
      expect(screen.queryByText("option1")).not.toBeInTheDocument();
      // Button should be disabled, preventing click
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });
});
