import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

const gridProps = vi.fn();
vi.mock("../../data/ScreenshotDataGrid", () => ({
  ScreenshotDataGrid: (props: Record<string, unknown>) => {
    gridProps(props);
    return <div data-testid="grid" />;
  },
  EmptyRowsRenderer: () => <div />,
}));
vi.mock("../../../hooks", () => ({ useIsDark: () => false }));

import { createResultView } from "../createResultView";

const View = createResultView({
  displayName: "TestView",
  typeGuard: (_run: unknown): _run is { v: number } => true,
  expectedRunType: "test",
  screenshotWrapper: "grid",
  enableRowSelection: true,
  transformData: () => ({ columns: [{ field: "v" }], rows: [{ v: 1 }] }),
});

describe("createResultView enableRowSelection", () => {
  it("passes a multiRow rowSelection config to the grid when enabled", () => {
    render(<View ref={createRef()} run={{ v: 1 }} />);
    const props = gridProps.mock.calls.at(-1)?.[0];
    expect(props.rowSelection).toEqual({
      mode: "multiRow",
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: false,
    });
  });

  it("does not pass rowSelection when enableRowSelection is absent", () => {
    const PlainView = createResultView({
      displayName: "PlainView",
      typeGuard: (_run: unknown): _run is { v: number } => true,
      expectedRunType: "test",
      screenshotWrapper: "grid",
      transformData: () => ({ columns: [{ field: "v" }], rows: [{ v: 1 }] }),
    });
    gridProps.mockClear();
    render(<PlainView ref={createRef()} run={{ v: 1 }} />);
    const props = gridProps.mock.calls.at(-1)?.[0];
    expect(props.rowSelection).toBeUndefined();
  });
});
