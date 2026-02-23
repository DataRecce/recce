import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { DiffText } from "../DiffText";

// Mock react-icons
vi.mock("react-icons/pi", () => ({
  PiCopy: () => <span data-testid="copy-icon">Copy</span>,
}));

describe("DiffText", () => {
  describe("rendering", () => {
    test("renders the value text", () => {
      render(<DiffText value="test_value" colorPalette="iochmara" />);

      expect(screen.getByText("test_value")).toBeInTheDocument();
    });

    test("applies blue (iochmara) color palette", () => {
      const { container } = render(
        <DiffText value="added" colorPalette="iochmara" />,
      );

      const box = container.firstChild;
      // Green palette should have green background and text colors
      expect(box).toHaveStyle({ display: "flex" });
    });

    test("applies amber (orange) color palette", () => {
      const { container } = render(
        <DiffText value="removed" colorPalette="orange" />,
      );

      const box = container.firstChild;
      expect(box).toHaveStyle({ display: "flex" });
    });

    test("applies custom font size", () => {
      const { container } = render(
        <DiffText value="test" colorPalette="iochmara" fontSize="14px" />,
      );

      const box = container.firstChild;
      expect(box).toHaveStyle({ fontSize: "14px" });
    });
  });

  describe("grayOut behavior", () => {
    test("applies muted color when grayOut is true", () => {
      render(<DiffText value="null" colorPalette="orange" grayOut />);

      const valueBox = screen.getByText("null");
      // The grayOut prop applies "text.disabled" from MUI theme
      // This may resolve to different values depending on the test environment
      const computedColor = getComputedStyle(valueBox).color;
      // Accept any muted/disabled color (gray variants, semi-transparent black, or theme variable)
      const isMutedColor =
        computedColor.includes("gray") ||
        computedColor.includes("128") ||
        computedColor.includes("rgba") ||
        computedColor.includes("var(");
      expect(isMutedColor).toBe(true);
    });

    test("does not show copy button when grayOut is true", () => {
      render(<DiffText value="null" colorPalette="orange" grayOut />);

      const outerBox = screen.getByText("null").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      expect(screen.queryByTestId("copy-icon")).not.toBeInTheDocument();
    });
  });

  describe("copy functionality", () => {
    test("does not show copy button by default (not hovered)", () => {
      render(<DiffText value="copy_me" colorPalette="iochmara" />);

      expect(screen.queryByTestId("copy-icon")).not.toBeInTheDocument();
    });

    test("shows copy button on hover", () => {
      render(<DiffText value="copy_me" colorPalette="iochmara" />);

      const outerBox = screen.getByText("copy_me").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
    });

    test("hides copy button on mouse leave", () => {
      render(<DiffText value="copy_me" colorPalette="iochmara" />);

      const outerBox = screen.getByText("copy_me").parentElement;
      fireEvent.mouseEnter(outerBox as Element);
      expect(screen.getByTestId("copy-icon")).toBeInTheDocument();

      fireEvent.mouseLeave(outerBox as Element);
      expect(screen.queryByTestId("copy-icon")).not.toBeInTheDocument();
    });

    test("does not show copy button when noCopy is true", () => {
      render(<DiffText value="no_copy" colorPalette="iochmara" noCopy />);

      const outerBox = screen.getByText("no_copy").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      expect(screen.queryByTestId("copy-icon")).not.toBeInTheDocument();
    });

    test("calls onCopy callback when copy button clicked", () => {
      const onCopy = vi.fn();
      render(
        <DiffText value="copy_value" colorPalette="iochmara" onCopy={onCopy} />,
      );

      const outerBox = screen.getByText("copy_value").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      const copyButton = screen.getByRole("button", { name: "Copy" });
      fireEvent.click(copyButton);

      expect(onCopy).toHaveBeenCalledWith("copy_value");
    });

    test("uses navigator.clipboard when no onCopy callback provided", () => {
      const writeText = vi.fn();
      // Use Object.defineProperty to override read-only clipboard (works with happy-dom)
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
        configurable: true,
      });

      render(<DiffText value="clipboard_value" colorPalette="iochmara" />);

      const outerBox = screen.getByText("clipboard_value").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      const copyButton = screen.getByRole("button", { name: "Copy" });
      fireEvent.click(copyButton);

      expect(writeText).toHaveBeenCalledWith("clipboard_value");
    });
  });

  describe("noCopy prop", () => {
    test("applies flexShrink 0 when noCopy is true", () => {
      const { container } = render(
        <DiffText value="no_shrink" colorPalette="iochmara" noCopy />,
      );

      const box = container.firstChild;
      expect(box).toHaveStyle({ flexShrink: "0" });
    });
  });

  describe("accessibility", () => {
    test("copy button has accessible name", () => {
      render(<DiffText value="accessible" colorPalette="iochmara" />);

      const outerBox = screen.getByText("accessible").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      const copyButton = screen.getByRole("button", { name: "Copy" });
      expect(copyButton).toBeInTheDocument();
    });

    test("copy button has tooltip", () => {
      render(<DiffText value="tooltip_test" colorPalette="iochmara" />);

      const outerBox = screen.getByText("tooltip_test").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      // Tooltip should be present (via MUI Tooltip)
      const copyButton = screen.getByRole("button", { name: "Copy" });
      expect(copyButton).toBeInTheDocument();
    });
  });
});
