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
});
