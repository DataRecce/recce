import { render, screen } from "@testing-library/react";
import { DiffDisplayModeSwitch } from "../DiffDisplayModeSwitch";

describe("DiffDisplayModeSwitch", () => {
  test("uses semantic comparison roles for the inline legend", () => {
    render(
      <DiffDisplayModeSwitch
        displayMode="inline"
        onDisplayModeChanged={() => undefined}
      />,
    );

    expect(screen.getByText("Base").parentElement).toHaveAttribute(
      "data-comparison-role",
      "base",
    );
    expect(screen.getByText("Current").parentElement).toHaveAttribute(
      "data-comparison-role",
      "current",
    );
  });
});
