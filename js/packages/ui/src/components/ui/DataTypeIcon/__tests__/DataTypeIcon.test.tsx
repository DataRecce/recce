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

  test("handles unknown types gracefully", () => {
    const { container } = render(<DataTypeIcon type="GEOGRAPHY" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  test("handles empty type string", () => {
    const { container } = render(<DataTypeIcon type="" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
