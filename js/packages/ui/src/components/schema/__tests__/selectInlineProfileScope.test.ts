/**
 * @file selectInlineProfileScope.test.ts
 * @description DRC-3390 Stage C — the schema-view scoping decision: which
 * columns the inline distribution profiles, whether it runs at all, and
 * whether the "Profile all columns" button shows. This is the wiring the
 * pass-1 MEDIUM flagged as untested.
 */

import { describe, expect, it } from "vitest";
import {
  type InlineProfileScopeInput,
  selectInlineProfileScope,
} from "../selectInlineProfileScope";

const base: InlineProfileScopeInput = {
  newCllExperience: true,
  columnChanges: null,
  impactedColumns: undefined,
  nodeId: "model.shop.orders",
  wholeModelChange: false,
  profileAllColumns: false,
};

describe("selectInlineProfileScope", () => {
  it("is fully off when the new-CLL experience flag is off", () => {
    const scope = selectInlineProfileScope({
      ...base,
      newCllExperience: false,
      columnChanges: { amount: "modified" },
      wholeModelChange: true,
    });
    // Even with changes and a whole-model change, the master flag wins.
    expect(scope).toEqual({
      changedColumns: undefined,
      scopedColumns: undefined,
      profileEnabled: false,
      profilingAll: false,
    });
  });

  it("scopes to this node's own changed columns", () => {
    const scope = selectInlineProfileScope({
      ...base,
      columnChanges: { amount: "modified", status: "added" },
    });
    expect(scope.changedColumns?.sort()).toEqual(["amount", "status"]);
    expect(scope.scopedColumns?.sort()).toEqual(["amount", "status"]);
    expect(scope.profileEnabled).toBe(true);
    // A scoped subset is not the whole model, so the expand button stays shown.
    expect(scope.profilingAll).toBe(false);
  });

  it("unions own changes with downstream-impacted columns, stripping the node prefix", () => {
    const scope = selectInlineProfileScope({
      ...base,
      columnChanges: { amount: "modified" },
      impactedColumns: new Set([
        "model.shop.orders_total", // this node, contributes `total`
        "model.shop.orders_amount", // duplicate of the own-change, deduped
        "model.shop.customers_email", // a different node, ignored
      ]),
    });
    expect(scope.changedColumns?.sort()).toEqual(["amount", "total"]);
    expect(scope.scopedColumns?.sort()).toEqual(["amount", "total"]);
  });

  it("ignores impacted columns when nodeId is missing (no prefix to strip)", () => {
    const scope = selectInlineProfileScope({
      ...base,
      nodeId: undefined,
      columnChanges: { amount: "modified" },
      impactedColumns: new Set(["model.shop.orders_total"]),
    });
    expect(scope.changedColumns).toEqual(["amount"]);
  });

  it("does not run when nothing changed and it is not a whole-model change", () => {
    const scope = selectInlineProfileScope(base);
    expect(scope.changedColumns).toEqual([]);
    expect(scope.scopedColumns).toBeUndefined();
    expect(scope.profileEnabled).toBe(false);
    expect(scope.profilingAll).toBe(false);
  });

  it("profiles every column on a whole-model change (no scoped subset)", () => {
    const scope = selectInlineProfileScope({
      ...base,
      wholeModelChange: true,
    });
    // No changed subset → widen to all columns; nothing left to expand into.
    expect(scope.scopedColumns).toBeUndefined();
    expect(scope.profileEnabled).toBe(true);
    expect(scope.profilingAll).toBe(true);
  });

  it("widens a scoped run to every column once the user opts into all", () => {
    const scoped = selectInlineProfileScope({
      ...base,
      columnChanges: { amount: "modified" },
    });
    expect(scoped.profilingAll).toBe(false); // button shown

    const widened = selectInlineProfileScope({
      ...base,
      columnChanges: { amount: "modified" },
      profileAllColumns: true,
    });
    expect(widened.scopedColumns).toBeUndefined();
    expect(widened.profileEnabled).toBe(true);
    expect(widened.profilingAll).toBe(true); // button now hidden
  });

  it("runs an all-columns profile when opted in even on an unchanged model", () => {
    const scope = selectInlineProfileScope({
      ...base,
      profileAllColumns: true,
    });
    expect(scope.scopedColumns).toBeUndefined();
    expect(scope.profileEnabled).toBe(true);
    expect(scope.profilingAll).toBe(true);
  });
});
