import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { DataTypeIcon } from "..";

describe("DataTypeIcon", () => {
  test("renders without crashing", () => {
    const { container } = render(<DataTypeIcon type="INTEGER" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  test("renders an SVG element", () => {
    const { container } = render(<DataTypeIcon type="VARCHAR(256)" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  test("shows tooltip with full type on hover", async () => {
    render(<DataTypeIcon type="VARCHAR(256)" />);
    const icon = screen.getByTestId("data-type-icon");
    await userEvent.hover(icon);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "VARCHAR(256)",
    );
  });

  test("renders different icons for different type categories", () => {
    const { container: c1 } = render(<DataTypeIcon type="INTEGER" />);
    const { container: c2 } = render(<DataTypeIcon type="VARCHAR" />);
    expect(c1.querySelector("svg")).toBeInTheDocument();
    expect(c2.querySelector("svg")).toBeInTheDocument();
  });

  test("renders geography types", () => {
    const { container } = render(<DataTypeIcon type="GEOGRAPHY" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  test("handles unknown types gracefully", () => {
    const { container } = render(<DataTypeIcon type="XYZTYPE" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  test("handles empty type string", () => {
    const { container } = render(<DataTypeIcon type="" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  test("suppresses tooltip when disableTooltip is true", async () => {
    const { container } = render(
      <DataTypeIcon type="VARCHAR(256)" disableTooltip />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    const icon = screen.getByTestId("data-type-icon");
    await userEvent.hover(icon);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("renders with 1em width by default (scales with font-size)", () => {
    const { container } = render(<DataTypeIcon type="INTEGER" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "1em");
    // Maintain same aspect ratio: height/width = 18/30 = 0.6
    expect(svg).toHaveAttribute("height", "0.6em");
  });

  test("accepts explicit numeric size for backwards compatibility", () => {
    const { container } = render(<DataTypeIcon type="INTEGER" size={32} />);
    const svg = container.querySelector("svg");
    // 32 * (18/30) = 19.2
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "19.2");
  });
});
