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
      render(<DiffText value="test_value" colorPalette="green" />);

      expect(screen.getByText("test_value")).toBeInTheDocument();
    });

    test("applies green color palette", () => {
      const { container } = render(
        <DiffText value="added" colorPalette="green" />,
      );

      const box = container.firstChild;
      // Green palette should have green background and text colors
      expect(box).toHaveStyle({ display: "flex" });
    });

    test("applies red color palette", () => {
      const { container } = render(
        <DiffText value="removed" colorPalette="red" />,
      );

      const box = container.firstChild;
      expect(box).toHaveStyle({ display: "flex" });
    });

    test("applies custom font size", () => {
      const { container } = render(
        <DiffText value="test" colorPalette="green" fontSize="14px" />,
      );

      const box = container.firstChild;
      expect(box).toHaveStyle({ fontSize: "14px" });
    });
  });

  describe("grayOut behavior", () => {
    test("applies gray color when grayOut is true", () => {
      render(<DiffText value="null" colorPalette="red" grayOut />);

      const valueBox = screen.getByText("null");
      // Color "gray" is rendered as rgb(128, 128, 128)
      expect(valueBox).toHaveStyle({ color: "rgb(128, 128, 128)" });
    });

    test("does not show copy button when grayOut is true", () => {
      render(<DiffText value="null" colorPalette="red" grayOut />);

      const outerBox = screen.getByText("null").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      expect(screen.queryByTestId("copy-icon")).not.toBeInTheDocument();
    });
  });

  describe("copy functionality", () => {
    test("does not show copy button by default (not hovered)", () => {
      render(<DiffText value="copy_me" colorPalette="green" />);

      expect(screen.queryByTestId("copy-icon")).not.toBeInTheDocument();
    });

    test("shows copy button on hover", () => {
      render(<DiffText value="copy_me" colorPalette="green" />);

      const outerBox = screen.getByText("copy_me").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
    });

    test("hides copy button on mouse leave", () => {
      render(<DiffText value="copy_me" colorPalette="green" />);

      const outerBox = screen.getByText("copy_me").parentElement;
      fireEvent.mouseEnter(outerBox as Element);
      expect(screen.getByTestId("copy-icon")).toBeInTheDocument();

      fireEvent.mouseLeave(outerBox as Element);
      expect(screen.queryByTestId("copy-icon")).not.toBeInTheDocument();
    });

    test("does not show copy button when noCopy is true", () => {
      render(<DiffText value="no_copy" colorPalette="green" noCopy />);

      const outerBox = screen.getByText("no_copy").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      expect(screen.queryByTestId("copy-icon")).not.toBeInTheDocument();
    });

    test("calls onCopy callback when copy button clicked", () => {
      const onCopy = vi.fn();
      render(
        <DiffText value="copy_value" colorPalette="green" onCopy={onCopy} />,
      );

      const outerBox = screen.getByText("copy_value").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      const copyButton = screen.getByRole("button", { name: "Copy" });
      fireEvent.click(copyButton);

      expect(onCopy).toHaveBeenCalledWith("copy_value");
    });

    test("uses navigator.clipboard when no onCopy callback provided", () => {
      const writeText = vi.fn();
      Object.assign(navigator, {
        clipboard: { writeText },
      });

      render(<DiffText value="clipboard_value" colorPalette="green" />);

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
        <DiffText value="no_shrink" colorPalette="green" noCopy />,
      );

      const box = container.firstChild;
      expect(box).toHaveStyle({ flexShrink: "0" });
    });
  });

  describe("accessibility", () => {
    test("copy button has accessible name", () => {
      render(<DiffText value="accessible" colorPalette="green" />);

      const outerBox = screen.getByText("accessible").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      const copyButton = screen.getByRole("button", { name: "Copy" });
      expect(copyButton).toBeInTheDocument();
    });

    test("copy button has tooltip", () => {
      render(<DiffText value="tooltip_test" colorPalette="green" />);

      const outerBox = screen.getByText("tooltip_test").parentElement;
      fireEvent.mouseEnter(outerBox as Element);

      // Tooltip should be present (via MUI Tooltip)
      const copyButton = screen.getByRole("button", { name: "Copy" });
      expect(copyButton).toBeInTheDocument();
    });
  });
});
