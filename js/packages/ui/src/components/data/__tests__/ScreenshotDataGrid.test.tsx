// js/packages/ui/src/components/data/__tests__/ScreenshotDataGrid.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
