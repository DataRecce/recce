/**
 * @file cllColumnId.test.ts
 * @description The CLL column-id grammar + safe membership, shared by the
 * schema grid's isImpacted painting and the inline profile-distribution scope.
 */

import { describe, expect, it } from "vitest";
import { cllColumnId, isColumnImpacted } from "../cllColumnId";

describe("cllColumnId", () => {
  it("joins node id and column with an underscore", () => {
    expect(cllColumnId("model.shop.orders", "amount")).toBe(
      "model.shop.orders_amount",
    );
  });
});

// These cover the helper's exact-membership contract. The boundary-collision
// limitation it documents (a sibling's id can collide) is NOT asserted here on
// purpose — callers only ever pass columns the node genuinely has, and that
// end-to-end safety is proven in selectInlineProfileScope.test.ts.
describe("isColumnImpacted", () => {
  const impacted = new Set([
    "model.shop.orders_amount",
    "model.shop.orders_summary_total", // belongs to the sibling orders_summary
  ]);

  it("is true for a known column whose id is in the set", () => {
    expect(isColumnImpacted("model.shop.orders", "amount", impacted)).toBe(
      true,
    );
  });

  it("is false for a known column not in the set", () => {
    expect(isColumnImpacted("model.shop.orders", "status", impacted)).toBe(
      false,
    );
  });

  it("resolves a column the sibling node genuinely has", () => {
    expect(
      isColumnImpacted("model.shop.orders_summary", "total", impacted),
    ).toBe(true);
  });

  it("is false when the impacted set is undefined", () => {
    expect(isColumnImpacted("model.shop.orders", "amount", undefined)).toBe(
      false,
    );
  });
});
