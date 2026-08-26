import { render, screen } from "@testing-library/react";
import { StructuralChangeIndicator } from "../StructuralChangeIndicator";

describe("StructuralChangeIndicator", () => {
  test.each([
    ["added", "+", "Added"],
    ["removed", "−", "Removed"],
    ["modified", "Δ", "Modified"],
  ] as const)("renders %s redundantly", (status, symbol, label) => {
    render(<StructuralChangeIndicator status={status} showLabel />);

    expect(screen.getByText(symbol)).toBeVisible();
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByLabelText(`${label} change`)).toBeInTheDocument();
  });

  test("neutral is the default emphasis", () => {
    render(<StructuralChangeIndicator status="added" />);

    expect(screen.getByLabelText("Added change")).toHaveAttribute(
      "data-emphasis",
      "neutral",
    );
  });
});
