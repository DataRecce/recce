import { describe, expect, it } from "vitest";
import type { Run } from "../../../api";
import type { LineageGraphNodes } from "../../../contexts/lineage/types";
import {
  isNodeBoundRunResult,
  shouldCloseOrphanedRunResult,
} from "../runResultVisibility";

// Minimal stand-ins carrying only the fields the predicates / guard read.
const profileRun = (model: string) =>
  ({ type: "profile_diff", params: { model } }) as unknown as Run;
const rowCountRun = () =>
  ({ type: "row_count_diff", params: {} }) as unknown as Run;
const node = (name: string) =>
  ({
    id: name,
    type: "lineageGraphNode",
    data: { id: name, name },
  }) as unknown as LineageGraphNodes;

describe("isNodeBoundRunResult", () => {
  it("is true for a node-bound run (profile_diff)", () => {
    expect(isNodeBoundRunResult(profileRun("customers"))).toBe(true);
  });

  it("is false for a non-node-bound run (row_count_diff)", () => {
    expect(isNodeBoundRunResult(rowCountRun())).toBe(false);
  });

  it("is false for no run", () => {
    expect(isNodeBoundRunResult(undefined)).toBe(false);
  });
});

describe("shouldCloseOrphanedRunResult", () => {
  it("closes when the run's model is absent from a built graph", () => {
    expect(
      shouldCloseOrphanedRunResult(profileRun("customers"), [node("orders")]),
    ).toBe(true);
  });

  it("keeps the result open when the run's model is present in the graph", () => {
    expect(
      shouldCloseOrphanedRunResult(profileRun("customers"), [
        node("customers"),
      ]),
    ).toBe(false);
  });

  it("never closes a non-node-bound run, even with no matching node", () => {
    expect(shouldCloseOrphanedRunResult(rowCountRun(), [])).toBe(false);
  });

  // DRC-3532 deep-link race: a node-bound run result can be opened (e.g. via a
  // cloud `?id=` deep link calling showRunId) BEFORE the lineage graph's first
  // layout, while the react-flow node set is still empty. The orphaned-model
  // check must NOT fire in that window — otherwise it slams the just-opened run
  // shut and the page shows bare lineage ("Ready to run query"), flaky across
  // reloads. Once nodes exist, an absent model closes the pane as before.
  it("does NOT close while the lineage graph has not been built yet (no nodes)", () => {
    expect(shouldCloseOrphanedRunResult(profileRun("customers"), [])).toBe(
      false,
    );
  });
});
