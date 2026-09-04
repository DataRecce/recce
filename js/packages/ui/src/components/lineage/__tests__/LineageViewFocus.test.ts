import { describe, expect, it } from "vitest";
import {
  createNodeDetailsOpenRequest,
  nextFocusedNodeId,
} from "../LineageViewOss";

describe("nextFocusedNodeId", () => {
  it("focuses a newly clicked node", () => {
    expect(nextFocusedNodeId(undefined, "model.test.orders")).toBe(
      "model.test.orders",
    );
  });

  it("closes the detail panel when the focused node is clicked again", () => {
    expect(
      nextFocusedNodeId("model.test.orders", "model.test.orders"),
    ).toBeUndefined();
  });

  it("moves focus when a different node is clicked", () => {
    expect(nextFocusedNodeId("model.test.orders", "model.test.customers")).toBe(
      "model.test.customers",
    );
  });
});

describe("createNodeDetailsOpenRequest", () => {
  it("issues a new token for repeated requests to the same node and view", () => {
    expect(
      createNodeDetailsOpenRequest(40, "model.test.orders", "analysis"),
    ).toEqual({
      nodeId: "model.test.orders",
      view: "analysis",
      requestToken: 41,
    });
    expect(
      createNodeDetailsOpenRequest(41, "model.test.orders", "analysis"),
    ).toEqual({
      nodeId: "model.test.orders",
      view: "analysis",
      requestToken: 42,
    });
  });
});
