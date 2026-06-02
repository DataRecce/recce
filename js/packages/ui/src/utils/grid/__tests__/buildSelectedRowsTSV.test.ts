// js/packages/ui/src/utils/grid/__tests__/buildSelectedRowsTSV.test.ts
import type { GridApi } from "ag-grid-community";
import { describe, expect, it } from "vitest";
import { buildSelectedRowsTSV } from "../buildSelectedRowsTSV";

interface FakeNode {
  id: string;
}
function fakeCol(colId: string, headerName?: string, field?: string) {
  return {
    getColId: () => colId,
    getColDef: () => ({ headerName, field }),
  };
}
function fakeApi(opts: {
  nodes: FakeNode[];
  columns: ReturnType<typeof fakeCol>[];
  values?: Record<string, string>; // key `${nodeId}:${colId}`
}): GridApi {
  return {
    getSelectedNodes: () => opts.nodes,
    getAllDisplayedColumns: () => opts.columns,
    getCellValue: ({
      rowNode,
      colKey,
    }: {
      rowNode: { id: string };
      colKey: { getColId: () => string };
    }) => opts.values?.[`${rowNode.id}:${colKey.getColId()}`],
  } as unknown as GridApi;
}

describe("buildSelectedRowsTSV", () => {
  it("returns null when no rows are selected", () => {
    const api = fakeApi({ nodes: [], columns: [fakeCol("a", "A", "a")] });
    expect(buildSelectedRowsTSV(api)).toBeNull();
  });

  it("excludes the AG Grid selection checkbox column", () => {
    const api = fakeApi({
      nodes: [{ id: "0" }],
      columns: [
        fakeCol("ag-Grid-SelectionColumn"),
        fakeCol("id", "ID", "id"),
        fakeCol("name", "Name", "name"),
      ],
      values: { "0:id": "42", "0:name": "alice" },
    });
    expect(buildSelectedRowsTSV(api)).toBe("ID\tName\r\n42\talice");
  });

  it("serializes multiple selected rows with formatted values", () => {
    const api = fakeApi({
      nodes: [{ id: "0" }, { id: "1" }],
      columns: [fakeCol("id", "ID", "id"), fakeCol("v", "V", "v")],
      values: { "0:id": "1", "0:v": "x", "1:id": "2", "1:v": "y" },
    });
    expect(buildSelectedRowsTSV(api)).toBe("ID\tV\r\n1\tx\r\n2\ty");
  });

  it("falls back to field then colId for header, empty string for missing value", () => {
    const api = fakeApi({
      nodes: [{ id: "0" }],
      columns: [fakeCol("c1", undefined, "field1"), fakeCol("c2")],
      values: {},
    });
    expect(buildSelectedRowsTSV(api)).toBe("field1\tc2\r\n\t");
  });

  it("returns null when only the selection column is displayed", () => {
    const api = fakeApi({
      nodes: [{ id: "0" }],
      columns: [fakeCol("ag-Grid-SelectionColumn")],
    });
    expect(buildSelectedRowsTSV(api)).toBeNull();
  });
});
