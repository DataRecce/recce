/**
 * @file CheckCard.test.tsx
 * @description Tests for CheckCard primitive component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckCard, type CheckCardData } from "../CheckCard";

const baseCheck: CheckCardData = {
  id: "check-1",
  name: "Row Count",
  type: "row_count",
};

describe("CheckCard", () => {
  it("renders the check name and preset badge", () => {
    render(<CheckCard check={{ ...baseCheck, isPreset: true }} />);

    expect(screen.getByText("Row Count")).toBeInTheDocument();
    expect(screen.getByText("Preset")).toBeInTheDocument();
  });

  it("invokes onClick with the check id", async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();

    render(<CheckCard check={baseCheck} onClick={handleClick} />);

    await user.click(screen.getByText("Row Count"));

    expect(handleClick).toHaveBeenCalledWith("check-1");
  });

  it("does not invoke onClick when disabled", async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();

    render(
      <CheckCard check={baseCheck} onClick={handleClick} disabled={true} />,
    );

    await user.click(screen.getByText("Row Count"));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("invokes onApprovalChange when toggled", async () => {
    const user = userEvent.setup();
    const handleApprovalChange = jest.fn();

    render(
      <CheckCard
        check={{ ...baseCheck, isApproved: false }}
        onApprovalChange={handleApprovalChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(handleApprovalChange).toHaveBeenCalledWith("check-1", true);
  });
});
