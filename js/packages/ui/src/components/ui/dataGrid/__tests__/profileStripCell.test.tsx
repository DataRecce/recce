/**
 * @file profileStripCell.test.tsx
 * @description Tests for the inline-profile strip cell renderer.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ICellRendererParams } from "ag-grid-community";
import type { SchemaDiffRow } from "../../../../lib/dataGrid/generators/toSchemaDataGrid";
import { createProfileStripRenderer } from "../schemaCells";

function makeParams(row: Partial<SchemaDiffRow>): ICellRendererParams<SchemaDiffRow> {
  const { name = "amount", ...rest } = row;
  return {
    data: { name, ...rest } as SchemaDiffRow,
  } as unknown as ICellRendererParams<SchemaDiffRow>;
}

describe("createProfileStripRenderer", () => {
  it("renders 5 squares per cell", () => {
    const renderer = createProfileStripRenderer();
    render(
      <>{renderer(makeParams({ name: "amount" }))}</>,
    );
    expect(screen.getAllByTestId("strip-square")).toHaveLength(5);
  });

  it("marks changed stats with the 'changed' modifier", () => {
    const renderer = createProfileStripRenderer();
    render(
      <>{renderer(
        makeParams({
          name: "amount",
          base__not_null_proportion: 0.98,
          current__not_null_proportion: 0.96,
          base__avg: 42.1,
          current__avg: 42.1,
        } as Partial<SchemaDiffRow>),
      )}</>,
    );
    const squares = screen.getAllByTestId("strip-square");
    // Order: [null%, min, max, avg, unique]
    expect(squares[0]).toHaveAttribute("data-state", "changed");
    expect(squares[3]).toHaveAttribute("data-state", "same");
  });

  it("marks stats with no data as 'empty'", () => {
    const renderer = createProfileStripRenderer();
    render(<>{renderer(makeParams({ name: "amount" }))}</>);
    const squares = screen.getAllByTestId("strip-square");
    for (const sq of squares) {
      expect(sq).toHaveAttribute("data-state", "empty");
    }
  });

  it("treats null base/current as 'empty' (not 'same')", () => {
    const renderer = createProfileStripRenderer();
    render(
      <>
        {renderer(
          makeParams({
            name: "amount",
            base__not_null_proportion: null,
            current__not_null_proportion: null,
          } as Partial<SchemaDiffRow>),
        )}
      </>,
    );
    const squares = screen.getAllByTestId("strip-square");
    expect(squares[0]).toHaveAttribute("data-state", "empty");
  });

  it("opens a popover on click showing base → current per stat", async () => {
    const renderer = createProfileStripRenderer();
    const user = userEvent.setup();
    render(
      <>{renderer(
        makeParams({
          name: "amount",
          base__not_null_proportion: 0.98,
          current__not_null_proportion: 0.96,
          base__min: 0.5,
          current__min: 0.5,
        } as Partial<SchemaDiffRow>),
      )}</>,
    );
    await user.click(screen.getByTestId("strip-button"));
    expect(await screen.findByText(/null%/i)).toBeInTheDocument();
    expect(screen.getByText(/0.98/)).toBeInTheDocument();
    expect(screen.getByText(/0.96/)).toBeInTheDocument();
  });
});
