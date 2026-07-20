import { describe, expect, it } from "vitest";
import {
  CHANGE_CATEGORY_LABELS,
  resolveChangeCategory,
} from "../changeCategory";

describe("change category", () => {
  it.each([
    ["breaking", "Model-Wide Change"], // wire-enum-ok
    ["partial_breaking", "Column Change"], // wire-enum-ok
    ["non_breaking", "Additive Change"], // wire-enum-ok
    ["unknown", "Unknown"],
  ] as const)("maps %s to %s", (category, label) => {
    expect(CHANGE_CATEGORY_LABELS[category]).toBe(label);
  });

  it("prefers the fresh CLL category", () => {
    expect(resolveChangeCategory("breaking", "unknown")).toBe("breaking"); // wire-enum-ok
  });

  it("falls back to the merged lineage category when CLL omits the node", () => {
    expect(resolveChangeCategory(undefined, "unknown")).toBe("unknown");
  });

  it("ignores unsupported category values", () => {
    expect(resolveChangeCategory("toString", "value_wide")).toBeUndefined();
  });
});
