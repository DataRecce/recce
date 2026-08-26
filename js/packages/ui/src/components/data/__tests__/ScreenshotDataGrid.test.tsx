// js/packages/ui/src/components/data/__tests__/ScreenshotDataGrid.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the props AG Grid receives.
const agGridProps = vi.fn();
vi.mock("ag-grid-react", () => ({
  AgGridReact: (props: Record<string, unknown>) => {
    agGridProps(props);
    return (
      <div data-testid="ag-grid">
        <div className="comparison-cell-base" data-testid="comparison-base" />
        <div
          className="comparison-cell-current"
          data-testid="comparison-current"
        />
        <div className="structural-row-added" data-testid="row-added" />
        <div
          className="comparison-cell-base structural-row-modified"
          data-testid="compound-base-modified"
        />
        <div
          className="structural-header-modified"
          data-testid="header-modified"
        />
        <div
          className="row-count-delta-increase"
          data-testid="direction-increase"
        />
        <div
          className="row-count-delta-decrease"
          data-testid="direction-decrease"
        />
      </div>
    );
  },
}));
// AllCommunityModule / ModuleRegistry are referenced at import time.
vi.mock("ag-grid-community", () => ({
  AllCommunityModule: {},
  ModuleRegistry: { registerModules: vi.fn() },
}));

// Mock useIsDark hook so the component can render without theme providers.
vi.mock("../../../hooks", () => ({
  useIsDark: () => false,
}));

// Mock the CSS import (agGridStyles.css) and the theme module (agGridTheme).
vi.mock("../agGridStyles.css", () => ({}));
vi.mock("../agGridTheme", () => ({
  dataGridThemeLight: "mocked-light-theme",
  dataGridThemeDark: "mocked-dark-theme",
}));

import { ScreenshotDataGrid } from "../ScreenshotDataGrid";

describe("ScreenshotDataGrid grid options", () => {
  beforeEach(() => {
    agGridProps.mockClear();
  });

  it("enables native cell text selection by default", () => {
    render(<ScreenshotDataGrid columnDefs={[]} rowData={[]} />);
    const props = agGridProps.mock.calls[0][0];
    expect(props.enableCellTextSelection).toBe(true);
    expect(props.ensureDomOrder).toBe(true);
  });

  it("lets callers override text selection via props", () => {
    render(
      <ScreenshotDataGrid
        columnDefs={[]}
        rowData={[]}
        enableCellTextSelection={false}
      />,
    );
    const props = agGridProps.mock.calls.at(-1)?.[0];
    expect(props.enableCellTextSelection).toBe(false);
  });
});

describe("ScreenshotDataGrid semantic grid styling", () => {
  it("uses comparison pills, structural rails, neutral headers, and neutral direction", () => {
    render(<ScreenshotDataGrid columnDefs={[]} rowData={[]} />);

    const base = getComputedStyle(screen.getByTestId("comparison-base"));
    const current = getComputedStyle(screen.getByTestId("comparison-current"));
    const rowAdded = getComputedStyle(screen.getByTestId("row-added"));
    const compoundBaseModified = getComputedStyle(
      screen.getByTestId("compound-base-modified"),
    );
    const headerModified = getComputedStyle(
      screen.getByTestId("header-modified"),
    );
    const directionIncrease = getComputedStyle(
      screen.getByTestId("direction-increase"),
    );
    const directionDecrease = getComputedStyle(
      screen.getByTestId("direction-decrease"),
    );

    expect(base.backgroundColor).toBe("#FFF3E6");
    expect(base.color).toBe("#98471F");
    expect(base.boxShadow).toContain("inset");
    expect(base.boxShadow).toContain("2px");
    expect(current.backgroundColor).toBe("#E6F3FC");
    expect(current.color).toBe("#245A85");
    expect(current.boxShadow).toContain("inset");
    expect(current.boxShadow).toContain("2px");

    expect(["", "rgba(0, 0, 0, 0)"]).toContain(rowAdded.backgroundColor);
    expect(rowAdded.boxShadow).toContain("inset 3px 0");
    expect(compoundBaseModified.boxShadow).toContain("inset 0 0 0 2px");
    expect(compoundBaseModified.boxShadow).toContain("inset 3px 0");

    expect(headerModified.backgroundColor).toBe("#FAFAFA");
    expect(headerModified.borderBottomWidth).toBe("3px");
    expect(headerModified.borderBottomColor).toBe("#B45309");

    expect(directionIncrease.backgroundColor).toBe("#FAFAFA");
    expect(directionIncrease.color).toBe("#404040");
    expect(directionDecrease.backgroundColor).toBe(
      directionIncrease.backgroundColor,
    );
    expect(directionDecrease.color).toBe(directionIncrease.color);
  });
});

describe("ScreenshotDataGrid getRowId", () => {
  beforeEach(() => {
    agGridProps.mockClear();
  });

  it("uses _index when present (query result rows)", () => {
    render(<ScreenshotDataGrid columnDefs={[]} rowData={[]} />);
    const props = agGridProps.mock.calls[0][0];
    const getRowId = props.getRowId;

    expect(getRowId({ data: { _index: 42 } })).toBe("42");
  });

  it("uses __rowKey when present (takes precedence)", () => {
    render(<ScreenshotDataGrid columnDefs={[]} rowData={[]} />);
    const props = agGridProps.mock.calls[0][0];
    const getRowId = props.getRowId;

    expect(getRowId({ data: { __rowKey: "custom-key", _index: 42 } })).toBe(
      "custom-key",
    );
  });

  it("falls back to rowIndex when _index is absent", () => {
    render(<ScreenshotDataGrid columnDefs={[]} rowData={[]} />);
    const props = agGridProps.mock.calls[0][0];
    const getRowId = props.getRowId;

    expect(getRowId({ data: { rowIndex: 10 } })).toBe("10");
  });

  it("generates a random ID as last resort", () => {
    render(<ScreenshotDataGrid columnDefs={[]} rowData={[]} />);
    const props = agGridProps.mock.calls[0][0];
    const getRowId = props.getRowId;

    const id1 = getRowId({ data: {} });
    const id2 = getRowId({ data: {} });

    // Both should be valid strings (not undefined)
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    // Random IDs should be different
    expect(id1).not.toBe(id2);
  });
});
