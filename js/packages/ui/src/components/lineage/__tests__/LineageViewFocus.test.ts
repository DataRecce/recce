import { describe, expect, it } from "vitest";
import { nextFocusedNodeId } from "../LineageViewOss";

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
