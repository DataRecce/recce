import { render, screen } from "@testing-library/react";
import type {
  CellClassParams,
  ColDef,
  ValueFormatterParams,
} from "ag-grid-community";
import type { RowObjectType } from "../../../api";
import { toRowCountDiffDataGrid } from "../generators/toRowCountDiffDataGrid";

function cellClassFor(column: ColDef<RowObjectType>, row: RowObjectType) {
  if (typeof column.cellClass !== "function") return column.cellClass;
  return column.cellClass({
    data: row,
  } as CellClassParams<RowObjectType>);
}

function formattedValueFor(column: ColDef<RowObjectType>, row: RowObjectType) {
  if (typeof column.valueFormatter !== "function") return undefined;
  return column.valueFormatter({
    data: row,
    value: row.delta,
  } as ValueFormatterParams<RowObjectType>);
}

function renderedValueFor(column: ColDef<RowObjectType>, row: RowObjectType) {
  if (typeof column.cellRenderer !== "function") return undefined;
  return column.cellRenderer({ data: row } as never);
}

describe("toRowCountDiffDataGrid", () => {
  const grid = toRowCountDiffDataGrid({
    increased: { base: 100, curr: 150 },
    decreased: { base: 100, curr: 80 },
    unchanged: { base: 100, curr: 100 },
    added: { base: null, curr: 100 },
    removed: { base: 100, curr: null },
  });
  const columns = grid.columns as ColDef<RowObjectType>[];
  const row = (name: string) => {
    const result = grid.rows.find((candidate) => candidate.name === name);
    if (!result) throw new Error(`Missing test row: ${name}`);
    return result;
  };

  test("keeps directional color off the name, base, and current cells", () => {
    for (const column of columns.slice(0, 3)) {
      expect(cellClassFor(column, row("increased"))).toBeUndefined();
      expect(cellClassFor(column, row("decreased"))).toBeUndefined();
    }
  });

  test.each([
    ["increased", "row-count-delta-increase"],
    ["decreased", "row-count-delta-decrease"],
    ["unchanged", "row-count-delta-unchanged"],
    ["added", "row-count-delta-structural"],
    ["removed", "row-count-delta-structural"],
  ])("assigns %s the semantic Delta class", (name, expectedClass) => {
    expect(cellClassFor(columns[3], row(name))).toBe(expectedClass);
  });

  test.each([
    ["increased", "↑ +50.0%"],
    ["decreased", "↓ -20.0%"],
    ["unchanged", "= 0%"],
    ["added", "Added"],
    ["removed", "Removed"],
  ])("adds a non-color cue to %s", (name, expectedValue) => {
    expect(formattedValueFor(columns[3], row(name))).toBe(expectedValue);
  });

  test.each([
    ["added", "Added", "+"],
    ["removed", "Removed", "−"],
  ])("uses StructuralChangeIndicator for %s", (name, label, symbol) => {
    render(renderedValueFor(columns[3], row(name)));

    expect(screen.getByLabelText(`${label} change`)).toBeVisible();
    expect(screen.getByText(symbol)).toBeVisible();
    expect(screen.getByText(label)).toBeVisible();
  });
});
