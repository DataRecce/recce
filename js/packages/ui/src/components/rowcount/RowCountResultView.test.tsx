import { render, screen } from "@testing-library/react";
import { RowCountDiffLegend } from "./RowCountResultView";

describe("RowCountDiffLegend", () => {
  test("names every directional color cue", () => {
    render(<RowCountDiffLegend isDark={false} />);

    expect(
      screen.getByRole("list", { name: "Row count change legend" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Decrease")).toBeInTheDocument();
    expect(screen.getByText("No change")).toBeInTheDocument();
    expect(screen.getByText("Increase")).toBeInTheDocument();
  });

  test("renders the no-change swatch without a fill", () => {
    render(<RowCountDiffLegend isDark={false} />);

    const noChangeItem = screen.getByText("No change");
    const swatch = noChangeItem.querySelector("[aria-hidden='true']");

    expect(swatch).toHaveStyle({ backgroundColor: "transparent" });
  });
});
