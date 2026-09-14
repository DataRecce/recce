import { describe, expect, it } from "vitest";
import type {
  LineageGraphNode,
  LineageGraphNodes,
} from "../../../contexts/lineage/types";
import { getDisplayedColumnTransformationTypes } from "../columnTransformation";

const MODEL_ID = "model.test.orders";
const MODEL_DATA: LineageGraphNode["data"] = {
  id: MODEL_ID,
  name: "orders",
  resourceType: "model",
  packageName: "test",
  parents: {},
  children: {},
};

function modelNode(): LineageGraphNodes {
  return {
    id: MODEL_ID,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: MODEL_DATA,
  };
}

function columnNode(
  id: string,
  transformationType: string,
  changeStatus?: "added" | "removed" | "modified",
): LineageGraphNodes {
  return {
    id,
    type: "lineageGraphColumnNode",
    position: { x: 0, y: 0 },
    data: {
      node: MODEL_DATA,
      column: id,
      type: "INTEGER",
      transformationType,
      changeStatus,
    },
  };
}

describe("getDisplayedColumnTransformationTypes", () => {
  it("returns no transformations for a model-only impact-radius graph", () => {
    expect(
      getDisplayedColumnTransformationTypes([modelNode()], () => true),
    ).toEqual([]);
  });

  it("returns only valid types in canonical order without duplicates", () => {
    const nodes = [
      columnNode("derived_one", "derived"),
      columnNode("passthrough", "passthrough"),
      columnNode("derived_two", "derived"),
      columnNode("unexpected", "not-a-transformation"),
    ];

    expect(getDisplayedColumnTransformationTypes(nodes, () => false)).toEqual([
      "passthrough",
      "derived",
    ]);
  });

  it("excludes a changed column when change analysis replaces its chip", () => {
    const nodes = [
      columnNode("renamed", "renamed", "modified"),
      columnNode("source", "source"),
    ];

    expect(getDisplayedColumnTransformationTypes(nodes, () => true)).toEqual([
      "source",
    ]);
  });

  it("keeps a changed column type when its model is not showing change analysis", () => {
    const nodes = [columnNode("renamed", "renamed", "modified")];

    expect(getDisplayedColumnTransformationTypes(nodes, () => false)).toEqual([
      "renamed",
    ]);
  });
});
