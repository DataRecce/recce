import { describe, expect, it } from "vitest";
import { MINIMAP_NODE_THRESHOLD } from "../LineageViewOss";

describe("MiniMap auto-disable threshold", () => {
  it("exports a threshold constant of 500", () => {
    expect(MINIMAP_NODE_THRESHOLD).toBe(500);
  });

  it("should show MiniMap when node count is at threshold", () => {
    expect(500 <= MINIMAP_NODE_THRESHOLD).toBe(true);
  });

  it("should hide MiniMap when node count exceeds threshold", () => {
    expect(1860 <= MINIMAP_NODE_THRESHOLD).toBe(false);
  });
});
