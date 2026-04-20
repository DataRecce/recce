/**
 * Regression test for CLL sidebar race (PR #1315).
 *
 * The publishing mechanism for impacted node/column sets MUST use React state,
 * not a ref. A ref mutation does not trigger a re-render, so downstream memos
 * (notably SchemaView's `impactedColumns`) latch onto the initial empty Set
 * and never refresh when async impact-CLL analysis resolves.
 *
 * If someone refactors this back to `useRef`, these tests fail.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePublishedImpactSets } from "./usePublishedImpactSets";

describe("usePublishedImpactSets", () => {
  it("starts with empty node and column sets", () => {
    const { result } = renderHook(() => usePublishedImpactSets());

    expect(result.current.impactedNodeIds.size).toBe(0);
    expect(result.current.impactedColumnIds.size).toBe(0);
  });

  it("publishing new sets changes the returned identity (triggers re-render)", () => {
    // This is the core regression assertion. With a ref-based implementation,
    // result.current would be frozen at the first render's snapshot and the
    // new Sets would never surface to consumers.
    const { result } = renderHook(() => usePublishedImpactSets());

    const initialNodeIds = result.current.impactedNodeIds;
    const initialColumnIds = result.current.impactedColumnIds;

    act(() => {
      result.current.publish({
        nodeIds: new Set(["model.test.orders"]),
        columnIds: new Set(["model.test.orders.status"]),
      });
    });

    expect(result.current.impactedNodeIds).not.toBe(initialNodeIds);
    expect(result.current.impactedColumnIds).not.toBe(initialColumnIds);
    expect(result.current.impactedNodeIds.has("model.test.orders")).toBe(true);
    expect(
      result.current.impactedColumnIds.has("model.test.orders.status"),
    ).toBe(true);
  });

  it("each publish exposes a fresh Set identity so useMemo dependencies re-fire", () => {
    // Simulates the SchemaView consumer: a useMemo keyed on impactedColumnIds.
    // If the hook re-publishes with new content, the memo must see a new
    // reference and re-run. Mutating a ref in place would break this contract.
    const { result } = renderHook(() => usePublishedImpactSets());

    act(() => {
      result.current.publish({
        nodeIds: new Set(["a"]),
        columnIds: new Set(["a.x"]),
      });
    });
    const first = result.current.impactedColumnIds;

    act(() => {
      result.current.publish({
        nodeIds: new Set(["a", "b"]),
        columnIds: new Set(["a.x", "b.y"]),
      });
    });
    const second = result.current.impactedColumnIds;

    expect(second).not.toBe(first);
    expect(second.size).toBe(2);
  });
});
