/**
 * @file nodeTypes.test.ts
 * @description Tests for the MiniMap node-color factory (DRC-3250).
 *
 * The MiniMap must show the same color the node card renders. Rather than
 * re-deriving the palette/impacted logic, `makeGetNodeColor` copies the node's
 * color via the shared `getNodeChangeStyle` — so these tests assert it equals
 * `getNodeChangeStyle(...).color` for the equivalent state (the single source
 * of truth `LineageNode` also renders from). The one thing the minimap can't
 * read off `node.data` is impact, so we also check the impacted set is honored.
 * The unchanged-node case is additionally pinned against a literal palette
 * value (not just `getNodeChangeStyle`) so a future drift is caught.
 */

import { describe, expect, it } from "vitest";
import type { LineageGraphNode } from "../../../../contexts/lineage/types";
import { colors } from "../../../../theme";
import { getNodeChangeStyle, getStyleForImpacted } from "../../styles";
import { makeGetNodeColor } from "../nodeTypes";

// Minimal node factory — only `id` and `data.changeStatus` matter here.
function makeNode(id: string, changeStatus?: string): LineageGraphNode {
  return {
    id,
    data: { id, changeStatus },
  } as unknown as LineageGraphNode;
}

describe("makeGetNodeColor", () => {
  describe("new CLL experience", () => {
    const impactedNodeIds = new Set(["impacted_model"]);
    const getColor = makeGetNodeColor({
      impactedNodeIds,
      newCllExperience: true,
    });

    it("paints an impacted, otherwise-unchanged node amber (matches the card)", () => {
      expect(getColor(makeNode("impacted_model"))).toBe(
        getStyleForImpacted().color,
      );
    });

    it("does not paint a non-impacted unchanged node amber", () => {
      expect(getColor(makeNode("plain_model"))).toBe(
        getNodeChangeStyle({ newCllExperience: true }).color,
      );
    });

    it("prefers the change-status color over impact when the node changed", () => {
      // A node can be both changed and in the impacted set — its own change wins,
      // exactly as the card resolves it.
      expect(getColor(makeNode("impacted_model", "modified"))).toBe(
        getNodeChangeStyle({
          changeStatus: "modified",
          isImpacted: true,
          newCllExperience: true,
        }).color,
      );
    });

    it("uses the muted cll palette for changed nodes", () => {
      expect(getColor(makeNode("added_model", "added"))).toBe(
        getNodeChangeStyle({ changeStatus: "added", newCllExperience: true })
          .color,
      );
    });
  });

  describe("legacy experience (newCllExperience: false)", () => {
    const getColor = makeGetNodeColor({
      impactedNodeIds: new Set(["impacted_model"]),
      newCllExperience: false,
    });

    it("ignores the impacted set entirely", () => {
      expect(getColor(makeNode("impacted_model"))).toBe(
        getNodeChangeStyle({}).color,
      );
    });

    it("uses the default palette for changed nodes", () => {
      expect(getColor(makeNode("modified_model", "modified"))).toBe(
        getNodeChangeStyle({ changeStatus: "modified" }).color,
      );
    });
  });

  describe("unchanged-node color (literal pin, DRC-3250)", () => {
    // The pre-refactor getNodeColor returned colors.neutral[400] for a node
    // with no changeStatus. Routing through getNodeChangeStyle now resolves
    // "unchanged" to colors.neutral[500] in both palettes — an intentional,
    // accepted shift. Pin the literal so any future palette change is caught.
    it("paints an unchanged node neutral[500] in the new experience", () => {
      const getColor = makeGetNodeColor({ newCllExperience: true });
      expect(getColor(makeNode("plain"))).toBe(colors.neutral[500]);
    });

    it("paints an unchanged node neutral[500] in the legacy experience", () => {
      const getColor = makeGetNodeColor({});
      expect(getColor(makeNode("plain"))).toBe(colors.neutral[500]);
    });
  });
});
