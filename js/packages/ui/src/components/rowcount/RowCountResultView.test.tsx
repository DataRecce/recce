import { render, screen } from "@testing-library/react";
import { RowCountDiffLegend } from "./RowCountResultView";

describe("RowCountDiffLegend", () => {
  test("names every neutral directional cue with a symbol", () => {
    render(<RowCountDiffLegend isDark={false} />);

    expect(screen.getByText("↑ Increase")).toBeVisible();
    expect(screen.getByText("↓ Decrease")).toBeVisible();
    expect(screen.getByText("= No change")).toBeVisible();
    expect(
      screen.getByRole("list", { name: "Row count change legend" }),
    ).toHaveAttribute("data-color-axis", "neutral-direction");
  });

  test("uses the same neutral swatch for every direction", () => {
    render(<RowCountDiffLegend isDark={false} />);

    const swatches = Array.from(
      document.querySelectorAll("[data-direction]"),
    ).map((swatch) => swatch.getAttribute("data-direction"));

    expect(swatches).toEqual(["increase", "decrease", "equal"]);
  });
});
