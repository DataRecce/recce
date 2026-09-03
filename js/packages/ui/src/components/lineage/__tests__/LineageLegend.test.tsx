import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LineageLegend } from "../legend";
import { getGraphBadgeLegendEntries } from "../wholeModelTreatment";

describe("LineageLegend", () => {
  it.each([
    ["+", "Added", "Added change"],
    ["−", "Removed", "Removed change"],
    ["Δ", "Modified", "Modified change"],
  ])(
    "renders the visible %s %s structural presentation",
    (symbol, label, accessibleName) => {
      render(<LineageLegend variant="changeStatus" />);

      expect(screen.getByText(symbol)).toBeVisible();
      expect(screen.getByText(label)).toBeVisible();
      expect(screen.getByLabelText(accessibleName)).toBeInTheDocument();
    },
  );

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

  it("shows only the transformation types present in the displayed chain", () => {
    render(
      <LineageLegend
        variant="transformation"
        transformationTypes={["derived", "passthrough"]}
      />,
    );

    expect(
      screen.getAllByText(/^(Passthrough|Renamed|Derived|Source|Unknown)$/),
    ).toHaveLength(2);
    expect(screen.getByText("Passthrough")).toBeInTheDocument();
    expect(screen.getByText("Derived")).toBeInTheDocument();
    expect(screen.queryByText("Renamed")).not.toBeInTheDocument();
    expect(screen.queryByText("Source")).not.toBeInTheDocument();
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
  });

  it("keeps filtered transformation types in the established legend order", () => {
    render(
      <LineageLegend
        variant="transformation"
        transformationTypes={["unknown", "derived", "passthrough"]}
      />,
    );

    expect(
      screen
        .getAllByText(/^(Passthrough|Renamed|Derived|Source|Unknown)$/)
        .map((element) => element.textContent),
    ).toEqual(["Passthrough", "Derived", "Unknown"]);
  });

  it("renders no transformation legend when the displayed chain has no chips", () => {
    render(
      <LineageLegend
        variant="transformation"
        title="Column transformations"
        transformationTypes={[]}
      />,
    );

    expect(
      screen.queryByText("Column transformations"),
    ).not.toBeInTheDocument();
  });

  it("explains transformation semantics without implying an environment diff", async () => {
    const user = userEvent.setup();
    render(<LineageLegend variant="transformation" />);

    await user.hover(screen.getByText("Passthrough"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Same-name reference to an upstream column",
    );

    await user.unhover(screen.getByText("Passthrough"));
    await user.hover(screen.getByText("Source"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "No upstream column dependency",
    );
  });

  it("leaves category treatment to the new CLL experience", () => {
    render(<LineageLegend variant="changeStatus" newCllExperience />);

    expect(screen.queryByText("Change Categories")).not.toBeInTheDocument();
  });

  describe("graph badge rows (new CLL experience)", () => {
    it("documents the ADD badge", () => {
      render(<LineageLegend variant="changeStatus" newCllExperience />);

      expect(screen.getByTestId("legend-treatment-additive")).toHaveTextContent(
        "ADD",
      );
      expect(screen.getByText("Additive change")).toBeInTheDocument();
    });

    it("documents column-only change and column-only impact separately", () => {
      render(<LineageLegend variant="changeStatus" newCllExperience />);

      expect(
        screen.getByTestId("legend-treatment-column-changed"),
      ).toHaveTextContent("COLUMN");
      expect(
        screen.getByTestId("legend-treatment-column-impacted"),
      ).toHaveTextContent("COLUMN");
      expect(screen.getByText("Column-only change")).toBeInTheDocument();
      expect(screen.getByText("Column-only impact")).toBeInTheDocument();
    });

    it("groups the badge rows under their own heading", () => {
      render(<LineageLegend variant="changeStatus" newCllExperience />);

      expect(screen.getByText("Badges")).toBeInTheDocument();
    });

    it("sources every row from the graph badge definitions", () => {
      render(<LineageLegend variant="changeStatus" newCllExperience />);

      const entries = getGraphBadgeLegendEntries(false);
      expect(entries).toHaveLength(3);
      for (const entry of entries) {
        const swatch = screen.getByTestId(`legend-treatment-${entry.kind}`);
        expect(swatch).toHaveTextContent(entry.text);
        expect(swatch).toHaveAttribute("aria-label", entry.ariaLabel);
        expect(screen.getByText(entry.tooltip)).toBeInTheDocument();
      }
    });

    it("reads statuses first, then the badge block", () => {
      const { container } = render(
        <LineageLegend variant="changeStatus" newCllExperience />,
      );

      expect(container.textContent).toBe(
        [
          "+Added",
          "−Removed",
          "ΔModified",
          "!Impacted",
          "Badges",
          "ADDAdditive change",
          "COLUMNColumn-only change",
          "COLUMNColumn-only impact",
        ].join(""),
      );
    });

    it("omits the badge rows when the flag is off", () => {
      render(<LineageLegend variant="changeStatus" />);

      expect(screen.queryByText("Badges")).not.toBeInTheDocument();
      expect(screen.queryByText("Additive change")).not.toBeInTheDocument();
      expect(screen.queryByText("Column-only change")).not.toBeInTheDocument();
      expect(screen.queryByText("Column-only impact")).not.toBeInTheDocument();
      for (const entry of getGraphBadgeLegendEntries(false)) {
        expect(
          screen.queryByTestId(`legend-treatment-${entry.kind}`),
        ).not.toBeInTheDocument();
      }
    });

    it("omits the badge rows on the transformation legend", () => {
      render(<LineageLegend variant="transformation" newCllExperience />);

      expect(screen.queryByText("Badges")).not.toBeInTheDocument();
      expect(screen.queryByText("Additive change")).not.toBeInTheDocument();
    });
  });
});
