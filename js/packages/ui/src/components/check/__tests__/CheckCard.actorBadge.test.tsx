import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckCard, type CheckCardData } from "../CheckCard";

const baseCheck: CheckCardData = {
  id: "check-1",
  name: "Row Count Diff of orders",
  type: "row_count_diff",
};

describe("CheckCard actor badge", () => {
  it("renders AI badge when actorType is recce_ai", () => {
    render(<CheckCard check={{ ...baseCheck, actorType: "recce_ai" }} />);
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("skips actor badge when isPreset is true (Preset chip already shown)", () => {
    render(
      <CheckCard
        check={{ ...baseCheck, actorType: "preset_system", isPreset: true }}
      />,
    );
    // The outlined Preset chip (from isPreset) should exist
    const presetChips = screen.getAllByText("Preset");
    expect(presetChips).toHaveLength(1); // Only the isPreset chip, no actor badge
  });

  it("does not render badge when actorType is undefined", () => {
    render(<CheckCard check={baseCheck} />);
    expect(screen.queryByText("AI")).not.toBeInTheDocument();
    expect(screen.queryByText("User")).not.toBeInTheDocument();
    expect(screen.queryByText("Preset")).not.toBeInTheDocument();
  });

  it("renders both AI and Outdated badges together", () => {
    render(
      <CheckCard
        check={{ ...baseCheck, actorType: "recce_ai", isOutdated: true }}
      />,
    );
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Outdated")).toBeInTheDocument();
  });
});
