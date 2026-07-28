/**
 * @file columnHeight.test.ts
 *
 * `COLUMN_HEIGHT` is the value the lineage canvas reserves per column when it
 * sizes a model node; `COLUMN_NODE_HEIGHT` is what the column node itself
 * renders at. They live in different modules and are joined only by a comment
 * ("Must match COLUMN_NODE_HEIGHT in columns/LineageColumnNode.tsx"), so
 * nothing but this test stops one from moving without the other — which shows
 * up as columns overflowing or under-filling their parent node, not as a
 * failure anywhere else.
 */

import { COLUMN_NODE_HEIGHT } from "../../../components/lineage/columns/LineageColumnNode";
import { COLUMN_HEIGHT } from "../utils";

describe("column height", () => {
  it("reserves exactly the height a column node renders at", () => {
    expect(COLUMN_HEIGHT).toBe(COLUMN_NODE_HEIGHT);
  });
});
