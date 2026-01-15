/**
 * @file CheckDetail.test.tsx
 * @description Tests for CheckDetail composite component.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckDetail, type CheckDetailTab } from "../CheckDetail";

jest.mock("../CheckActions", () => ({
  CheckActions: ({
    checkId,
    primaryActions = [],
    secondaryActions = [],
    onAction,
  }: {
    checkId: string;
    primaryActions: { type: string; label: string }[];
    secondaryActions: { type: string; label: string }[];
    onAction?: (checkId: string, actionType: string) => void;
  }) => (
    <div data-testid="check-actions">
      {[...primaryActions, ...secondaryActions].map((action) => (
        <button
          key={action.type}
          onClick={() => onAction?.(checkId, action.type)}
        >
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("../CheckDescription", () => {
  const React = require("react");

  return {
    CheckDescription: ({
      value,
      onChange,
      disabled,
    }: {
      value?: string;
      onChange?: (value?: string) => void;
      disabled?: boolean;
    }) => {
      const [currentValue, setCurrentValue] = React.useState(value ?? "");

      return (
        <textarea
          data-testid="check-description"
          value={currentValue}
          onChange={(event) => {
            setCurrentValue(event.target.value);
            onChange?.(event.target.value);
          }}
          disabled={disabled}
        />
      );
    },
  };
});

const tabs: CheckDetailTab[] = [
  { id: "result", label: "Result", content: <div>Result Content</div> },
  { id: "query", label: "Query", content: <div>Query Content</div> },
];

describe("CheckDetail", () => {
  it("renders header details and approved status", () => {
    render(
      <CheckDetail
        checkId="check-1"
        name="My Check"
        type="row_count"
        isApproved={true}
      />,
    );

    expect(screen.getByText("My Check")).toBeInTheDocument();
    expect(screen.getByText("row_count • Approved")).toBeInTheDocument();
  });

  it("invokes onAction when action is triggered", async () => {
    const user = userEvent.setup();
    const handleAction = jest.fn();

    render(
      <CheckDetail
        checkId="check-1"
        name="My Check"
        type="row_count"
        primaryActions={[{ type: "run", label: "Run" }]}
        onAction={handleAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(handleAction).toHaveBeenCalledWith("check-1", "run");
  });

  it("allows editing the name and calls onNameChange", async () => {
    const user = userEvent.setup();
    const handleNameChange = jest.fn();

    render(
      <CheckDetail
        checkId="check-1"
        name="My Check"
        type="row_count"
        onNameChange={handleNameChange}
      />,
    );

    await user.click(screen.getByText("My Check"));
    const input = screen.getByDisplayValue("My Check");
    await user.clear(input);
    await user.type(input, "Updated Check");
    fireEvent.blur(input);

    expect(handleNameChange).toHaveBeenCalledWith("Updated Check");
  });

  it("switches tabs and renders tab content", async () => {
    const user = userEvent.setup();

    render(
      <CheckDetail
        checkId="check-1"
        name="My Check"
        type="row_count"
        tabs={tabs}
      />,
    );

    expect(screen.getByText("Result Content")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Query" }));

    expect(screen.getByText("Query Content")).toBeInTheDocument();
  });

  it("invokes onDescriptionChange from description editor", async () => {
    const user = userEvent.setup();
    const handleDescriptionChange = jest.fn();

    render(
      <CheckDetail
        checkId="check-1"
        name="My Check"
        type="row_count"
        description="Initial"
        onDescriptionChange={handleDescriptionChange}
      />,
    );

    await user.type(screen.getByTestId("check-description"), " Updated");

    expect(handleDescriptionChange).toHaveBeenLastCalledWith("Initial Updated");
  });
});
