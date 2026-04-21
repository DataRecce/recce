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
