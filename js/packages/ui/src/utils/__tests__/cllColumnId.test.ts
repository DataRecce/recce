/**
 * @file cllColumnId.test.ts
 * @description The CLL column-id grammar + safe membership (DRC-3390 review #1,
 * DRC-3646). Shared by the schema grid's isImpacted painting and the inline
 * profile-distribution scope.
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

describe("isColumnImpacted", () => {
  const impacted = new Set([
    "model.shop.orders_amount",
    "model.shop.orders_summary_total", // a SIBLING model's column
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

  it("resolves a column the node genuinely has", () => {
    expect(
      isColumnImpacted("model.shop.orders_summary", "total", impacted),
    ).toBe(true);
  });

  it("cannot itself resolve the node/column boundary — that is the caller's job (DRC-3646)", () => {
    // `orders` + `summary_total` and `orders_summary` + `total` BOTH stringify
    // to `model.shop.orders_summary_total`, so the helper matches the
    // pathological pair too. It is safe only because callers ask exclusively
    // about columns the node actually has — `model.shop.orders` has no
    // `summary_total` column, so selectInlineProfileScope never makes this
    // query. The helper does honest exact-membership; it does not (and cannot)
    // disambiguate the underscore boundary on its own.
    expect(
      isColumnImpacted("model.shop.orders", "summary_total", impacted),
    ).toBe(true);
  });

  it("is false when the impacted set is undefined", () => {
    expect(isColumnImpacted("model.shop.orders", "amount", undefined)).toBe(
      false,
    );
  });
});
