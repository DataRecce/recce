/**
 * @file ChecksView.test.tsx
 * @description Tests for ChecksView high-level component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Check } from "../../../providers/contexts/CheckContext";
import { ChecksView } from "../ChecksView";

const mockUseCheckContext = jest.fn();

jest.mock("../../../providers/contexts/CheckContext", () => ({
  useCheckContext: () => mockUseCheckContext(),
}));

jest.mock("../../check/CheckList", () => ({
  CheckList: ({
    checks,
    onCheckSelect,
  }: {
    checks: { id: string; name: string }[];
    onCheckSelect?: (checkId: string) => void;
  }) => (
    <div data-testid="check-list">
      {checks.map((check) => (
        <button key={check.id} onClick={() => onCheckSelect?.(check.id)}>
          {check.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("../../check/CheckDetail", () => ({
  CheckDetail: ({ checkId, name }: { checkId: string; name: string }) => (
    <div data-testid="check-detail">
      {checkId}:{name}
    </div>
  ),
}));

jest.mock("../../check/CheckEmptyState", () => ({
  CheckEmptyState: ({ onAction }: { onAction?: () => void }) => (
    <button onClick={onAction}>Create Check</button>
  ),
}));

jest.mock("../../ui/SplitPane", () => ({
  SplitPane: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="split-pane">{children}</div>
  ),
}));

const sampleChecks: Check[] = [
  {
    check_id: "check-1",
    name: "Check One",
    type: "row_count",
  },
  {
    check_id: "check-2",
    name: "Check Two",
    type: "schema_diff",
  },
];

describe("ChecksView", () => {
  beforeEach(() => {
    mockUseCheckContext.mockReturnValue({
      checks: [],
      isLoading: false,
      error: undefined,
      selectedCheckId: undefined,
      onSelectCheck: jest.fn(),
    });
  });

  it("shows a loading indicator", () => {
    mockUseCheckContext.mockReturnValue({
      checks: [],
      isLoading: true,
      error: undefined,
      selectedCheckId: undefined,
      onSelectCheck: jest.fn(),
    });

    render(<ChecksView />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders an error state", () => {
    mockUseCheckContext.mockReturnValue({
      checks: [],
      isLoading: false,
      error: "Failed to load",
      selectedCheckId: undefined,
      onSelectCheck: jest.fn(),
    });

    render(<ChecksView />);

    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("renders empty state and handles create action", async () => {
    const user = userEvent.setup();
    const handleCreate = jest.fn();

    render(<ChecksView onCreateCheck={handleCreate} />);

    await user.click(screen.getByRole("button", { name: "Create Check" }));

    expect(handleCreate).toHaveBeenCalled();
  });

  it("renders check details and handles selection", async () => {
    const user = userEvent.setup();
    const handleSelect = jest.fn();

    render(
      <ChecksView
        checks={sampleChecks}
        selectedCheckId="check-1"
        onCheckSelect={handleSelect}
      />,
    );

    expect(screen.getByTestId("check-detail")).toHaveTextContent(
      "check-1:Check One",
    );

    await user.click(screen.getByRole("button", { name: "Check Two" }));

    expect(handleSelect).toHaveBeenCalledWith("check-2");
  });
});
