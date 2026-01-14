/**
 * @file ProfileTable.test.tsx
 * @description Tests for ProfileTable composite component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileTable } from "../ProfileTable";

describe("ProfileTable", () => {
  it("renders empty state when no data is provided", () => {
    render(<ProfileTable columns={[]} rows={[]} />);

    expect(screen.getByText("No profile data")).toBeInTheDocument();
  });

  it("renders the grid and toggles display mode", async () => {
    const user = userEvent.setup();
    const handleDisplayModeChange = jest.fn();

    render(
      <ProfileTable
        columns={[{ field: "column", headerName: "Column" }]}
        rows={[{ column: "id", __rowKey: "id" }]}
        displayMode="inline"
        showDisplayModeToggle={true}
        onDisplayModeChange={handleDisplayModeChange}
      />,
    );

    expect(screen.getByTestId("ag-grid-mock")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Side by Side" }));

    expect(handleDisplayModeChange).toHaveBeenCalledWith("side-by-side");
  });
});
