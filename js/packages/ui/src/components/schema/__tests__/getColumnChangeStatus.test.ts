import { describe, expect, it } from "vitest";
import {
  type ColumnChangeInput,
  type ColumnChangeStatus,
  getColumnChangeStatus,
} from "../getColumnChangeStatus";

// A present (non-added, non-removed) column with no deltas.
const base: ColumnChangeInput = {
  baseIndex: 1,
  currentIndex: 1,
  baseType: "INT",
  currentType: "INT",
};

describe("getColumnChangeStatus", () => {
  it.each<[string, ColumnChangeInput, boolean, ColumnChangeStatus]>([
    // presence wins over everything
    ["added column", { ...base, baseIndex: undefined }, false, "added"],
    ["removed column", { ...base, currentIndex: undefined }, false, "removed"],
    [
      "added wins even when impacted",
      { ...base, baseIndex: undefined },
      true,
      "added",
    ],

    // the crux: inherited type shift on an impacted column is IMPACTED, not changed
    [
      "inherited type shift on impacted column",
      { ...base, baseType: "DOUBLE", currentType: "HUGEINT" },
      true,
      "impacted",
    ],
    // same type shift but NOT impacted → it's a local change
    [
      "type change with no impact attribution",
      { ...base, baseType: "INT", currentType: "VARCHAR" },
      false,
      "changed",
    ],

    // local changes always win over impact (they describe the column's own edit)
    [
      "local definition change + impacted keeps changed",
      {
        ...base,
        baseType: "DOUBLE",
        currentType: "HUGEINT",
        definitionChanged: true,
      },
      true,
      "changed",
    ],
    [
      "reorder + impacted keeps changed",
      { ...base, reordered: true },
      true,
      "changed",
    ],
    [
      "definition change without type change",
      { ...base, definitionChanged: true },
      false,
      "changed",
    ],

    // unknown gates the inherited reclassification and beats plain impact
    [
      "changeUnknown + impacted (no type delta) is unknown",
      { ...base, changeUnknown: true },
      true,
      "unknown",
    ],
    [
      "changeUnknown + type delta is a (structural) change",
      {
        ...base,
        baseType: "DOUBLE",
        currentType: "HUGEINT",
        changeUnknown: true,
      },
      true,
      "changed",
    ],

    // plain impact (no type delta, no local change)
    ["plain downstream impact", { ...base }, true, "impacted"],

    // nothing changed
    ["unchanged", { ...base }, false, "unchanged"],
  ])("%s", (_label, row, isImpacted, expected) => {
    expect(getColumnChangeStatus(row, isImpacted)).toBe(expected);
  });
});
