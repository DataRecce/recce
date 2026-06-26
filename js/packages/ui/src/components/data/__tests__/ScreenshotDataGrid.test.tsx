// js/packages/ui/src/components/data/__tests__/ScreenshotDataGrid.test.tsx
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the props AG Grid receives.
const agGridProps = vi.fn();
vi.mock("ag-grid-react", () => ({
  AgGridReact: (props: Record<string, unknown>) => {
    agGridProps(props);
    return <div data-testid="ag-grid" />;
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
