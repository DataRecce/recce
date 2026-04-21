/**
 * @file SchemaGalleryView.test.tsx
 * @description Component tests for the card-gallery render mode.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SchemaDiffRow } from "../../../lib/dataGrid/generators/toSchemaDataGrid";
import { SchemaGalleryView } from "../SchemaGalleryView";

function row(overrides: Partial<SchemaDiffRow>): SchemaDiffRow {
  const { name = "x", ...rest } = overrides;
  return {
    name,
    baseIndex: 1,
    currentIndex: 1,
    baseType: "number",
    currentType: "number",
    ...rest,
  } as SchemaDiffRow;
}

describe("SchemaGalleryView categorization", () => {
  it("puts impacted columns in the interesting section", () => {
    const rows = [row({ name: "amount", isImpacted: true })];
    render(<SchemaGalleryView rows={rows} />);
    const interesting = screen.getByTestId("interesting-section");
    expect(within(interesting).getByText("amount")).toBeInTheDocument();
  });

  it("puts added columns in the interesting section", () => {
    const rows = [row({ name: "discount", baseIndex: undefined })];
    render(<SchemaGalleryView rows={rows} />);
    const interesting = screen.getByTestId("interesting-section");
    expect(within(interesting).getByText("discount")).toBeInTheDocument();
  });

  it("puts type-changed columns in the interesting section", () => {
    const rows = [
      row({ name: "order_id", baseType: "number", currentType: "text" }),
    ];
    render(<SchemaGalleryView rows={rows} />);
    const interesting = screen.getByTestId("interesting-section");
    expect(within(interesting).getByText("order_id")).toBeInTheDocument();
  });

  it("puts definitionChanged columns in the interesting section", () => {
    const rows = [row({ name: "total", definitionChanged: true })];
    render(<SchemaGalleryView rows={rows} />);
    const interesting = screen.getByTestId("interesting-section");
    expect(within(interesting).getByText("total")).toBeInTheDocument();
  });

  it("puts removed, reordered, and unchanged columns in the other section", () => {
    const rows = [
      row({ name: "id" }),
      row({ name: "old", currentIndex: undefined }),
      row({ name: "date", reordered: true }),
    ];
    render(<SchemaGalleryView rows={rows} />);
    const other = screen.getByTestId("other-section");
    expect(within(other).getByText("id")).toBeInTheDocument();
    expect(within(other).getByText("old")).toBeInTheDocument();
    expect(within(other).getByText("date")).toBeInTheDocument();
  });

  it("hides the interesting section when empty", () => {
    const rows = [row({ name: "id" })];
    render(<SchemaGalleryView rows={rows} />);
    expect(screen.queryByTestId("interesting-section")).toBeNull();
  });

  it("hides the other section when empty", () => {
    const rows = [row({ name: "x", isImpacted: true })];
    render(<SchemaGalleryView rows={rows} />);
    expect(screen.queryByTestId("other-section")).toBeNull();
  });
});

describe("SchemaGalleryView card rendering", () => {
  it("renders type badge next to impacted card name", () => {
    const rows = [row({ name: "amount", isImpacted: true })];
    render(<SchemaGalleryView rows={rows} />);
    const card = screen.getByTestId(`card-amount`);
    expect(within(card).getByText(/impacted/i)).toBeInTheDocument();
  });

  it("renders OLD → NEW types on type-changed cards", () => {
    const rows = [
      row({ name: "order_id", baseType: "number", currentType: "text" }),
    ];
    render(<SchemaGalleryView rows={rows} />);
    const card = screen.getByTestId("card-order_id");
    expect(within(card).getByText(/number/i)).toBeInTheDocument();
    expect(within(card).getByText(/text/i)).toBeInTheDocument();
  });

  it("renders four quadrants with min/max/null%/unique", () => {
    const rows = [
      row({
        name: "amount",
        isImpacted: true,
        base__min: 0.5,
        current__min: 0.5,
        base__max: 999.99,
        current__max: 999.99,
        base__not_null_proportion: 0.98,
        current__not_null_proportion: 0.96,
        base__is_unique: false,
        current__is_unique: false,
      } as Partial<SchemaDiffRow>),
    ];
    render(<SchemaGalleryView rows={rows} />);
    const card = screen.getByTestId("card-amount");
    expect(within(card).getByText(/min/i)).toBeInTheDocument();
    expect(within(card).getByText(/max/i)).toBeInTheDocument();
    expect(within(card).getByText(/null%/i)).toBeInTheDocument();
    expect(within(card).getByText(/unique/i)).toBeInTheDocument();
  });

  it("marks the changed quadrant with data-changed=true", () => {
    const rows = [
      row({
        name: "amount",
        isImpacted: true,
        base__not_null_proportion: 0.98,
        current__not_null_proportion: 0.96,
        base__min: 0.5,
        current__min: 0.5,
      } as Partial<SchemaDiffRow>),
    ];
    render(<SchemaGalleryView rows={rows} />);
    const card = screen.getByTestId("card-amount");
    const nullQuad = within(card).getByTestId("quad-not_null_proportion");
    const minQuad = within(card).getByTestId("quad-min");
    expect(nullQuad).toHaveAttribute("data-changed", "true");
    expect(minQuad).toHaveAttribute("data-changed", "false");
  });

  it("renders added cards without base values in quadrants", () => {
    const rows = [
      row({
        name: "discount",
        baseIndex: undefined,
        current__min: 0,
        current__max: 0.4,
      } as Partial<SchemaDiffRow>),
    ];
    render(<SchemaGalleryView rows={rows} />);
    const card = screen.getByTestId("card-discount");
    expect(within(card).getByText("added")).toBeInTheDocument();
    expect(within(card).getByText(/0.4/)).toBeInTheDocument();
  });
});
