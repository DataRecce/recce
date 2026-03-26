import { describe, expect, it } from "vitest";
import {
  DIM_FILTER,
  EXPLORE_MIN_ZOOM,
  FIT_VIEW_PADDING,
  LEGIBLE_MIN_ZOOM,
} from "../config/zoomConstants";

describe("zoom constants", () => {
  it("LEGIBLE_MIN_ZOOM is above 0.3 for label readability", () => {
    expect(LEGIBLE_MIN_ZOOM).toBeGreaterThanOrEqual(0.3);
    expect(LEGIBLE_MIN_ZOOM).toBeLessThan(1);
  });

  it("EXPLORE_MIN_ZOOM allows deep zoom-out for power users", () => {
    expect(EXPLORE_MIN_ZOOM).toBeLessThan(LEGIBLE_MIN_ZOOM);
    expect(EXPLORE_MIN_ZOOM).toBeGreaterThan(0);
  });

  it("FIT_VIEW_PADDING provides breathing room", () => {
    expect(FIT_VIEW_PADDING).toBeGreaterThan(0);
    expect(FIT_VIEW_PADDING).toBeLessThan(1);
  });

  it("DIM_FILTER uses opacity 0.4 for softer gray-out", () => {
    expect(DIM_FILTER).toContain("opacity(0.4)");
    expect(DIM_FILTER).toContain("grayscale(40%)");
  });
});
