import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LineageLegend } from "../legend";

describe("LineageLegend", () => {
  it("renders all change categories below the change statuses", () => {
    render(<LineageLegend variant="changeStatus" />);

    expect(screen.getByText("Change Categories")).toBeInTheDocument();
    expect(screen.getByText("Model-Wide Change")).toBeInTheDocument();
    expect(screen.getByText("Column Change")).toBeInTheDocument();
    expect(screen.getByText("Additive Change")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("does not add change categories to the transformation legend", () => {
    render(<LineageLegend variant="transformation" />);

    expect(screen.queryByText("Change Categories")).not.toBeInTheDocument();
  });

  it("leaves category treatment to the new CLL experience", () => {
    render(<LineageLegend variant="changeStatus" newCllExperience />);

    expect(screen.queryByText("Change Categories")).not.toBeInTheDocument();
  });
});
