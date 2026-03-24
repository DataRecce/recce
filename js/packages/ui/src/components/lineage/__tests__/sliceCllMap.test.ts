import type { CllInput, ColumnLineageData } from "../../../api/cll";
import { sliceCllMap } from "../sliceCllMap";

/**
 * Test graph topology:
 *
 *   source_a ──► staging ──► mart
 *
 *   source_a columns: id, name
 *   staging  columns: id, name, amount
 *   mart     columns: id, total
 *
 *   Column lineage:
 *     source_a.id   → staging.id   → mart.id
 *     source_a.name → staging.name
 *                      staging.amount → mart.total
 */

const SOURCE = "model.test.source_a";
const STAGING = "model.test.staging";
const MART = "model.test.mart";

function makeFullMap(): ColumnLineageData {
  return {
    current: {
      nodes: {
        [SOURCE]: {
          id: SOURCE,
          name: "source_a",
          source_name: "",
          resource_type: "source",
          change_status: "modified",
          change_category: "breaking",
          impacted: false,
        },
        [STAGING]: {
          id: STAGING,
          name: "staging",
          source_name: "",
          resource_type: "model",
          impacted: true,
        },
        [MART]: {
          id: MART,
          name: "mart",
          source_name: "",
          resource_type: "model",
          impacted: true,
        },
      },
      columns: {
        [`${SOURCE}_id`]: { name: "id", type: "INTEGER" },
        [`${SOURCE}_name`]: { name: "name", type: "VARCHAR" },
        [`${STAGING}_id`]: { name: "id", type: "INTEGER" },
        [`${STAGING}_name`]: { name: "name", type: "VARCHAR" },
        [`${STAGING}_amount`]: { name: "amount", type: "FLOAT" },
        [`${MART}_id`]: { name: "id", type: "INTEGER" },
        [`${MART}_total`]: { name: "total", type: "FLOAT" },
      },
      parent_map: {
        // Node-level parents (who feeds into this node)
        [SOURCE]: [],
        [STAGING]: [SOURCE],
        [MART]: [STAGING],
        // Column-level parents (who feeds into this column)
        [`${SOURCE}_id`]: [],
        [`${SOURCE}_name`]: [],
        [`${STAGING}_id`]: [`${SOURCE}_id`],
        [`${STAGING}_name`]: [`${SOURCE}_name`],
        [`${STAGING}_amount`]: [],
        [`${MART}_id`]: [`${STAGING}_id`],
        [`${MART}_total`]: [`${STAGING}_amount`],
      },
      child_map: {
        // Node-level children
        [SOURCE]: [STAGING],
        [STAGING]: [MART],
        [MART]: [],
        // Column-level children
        [`${SOURCE}_id`]: [`${STAGING}_id`],
        [`${SOURCE}_name`]: [`${STAGING}_name`],
        [`${STAGING}_id`]: [`${MART}_id`],
        [`${STAGING}_name`]: [],
        [`${STAGING}_amount`]: [`${MART}_total`],
        [`${MART}_id`]: [],
        [`${MART}_total`]: [],
      },
    },
  };
}

describe("sliceCllMap", () => {
  describe("impact overview (no params)", () => {
    it("returns the full map unchanged when no node_id or column given", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {});

      expect(result.current.nodes).toEqual(fullMap.current.nodes);
      expect(result.current.columns).toEqual(fullMap.current.columns);
      expect(result.current.parent_map).toEqual(fullMap.current.parent_map);
      expect(result.current.child_map).toEqual(fullMap.current.child_map);
    });
  });

  describe("node-level (node_id only)", () => {
    it("includes the anchor node and its upstream/downstream", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, { node_id: STAGING });

      expect(Object.keys(result.current.nodes).sort()).toEqual(
        [SOURCE, STAGING, MART].sort(),
      );
    });

    it("includes columns for all reachable nodes", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, { node_id: STAGING });

      // All columns from source, staging, and mart should be present
      expect(Object.keys(result.current.columns).sort()).toEqual(
        [
          `${SOURCE}_id`,
          `${SOURCE}_name`,
          `${STAGING}_id`,
          `${STAGING}_name`,
          `${STAGING}_amount`,
          `${MART}_id`,
          `${MART}_total`,
        ].sort(),
      );
    });

    it("respects no_upstream — excludes upstream nodes", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
        no_upstream: true,
      });

      expect(Object.keys(result.current.nodes).sort()).toEqual(
        [STAGING, MART].sort(),
      );
      // source_a columns should not appear
      expect(result.current.columns[`${SOURCE}_id`]).toBeUndefined();
      expect(result.current.columns[`${SOURCE}_name`]).toBeUndefined();
    });

    it("respects no_downstream — excludes downstream nodes", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
        no_downstream: true,
      });

      expect(Object.keys(result.current.nodes).sort()).toEqual(
        [SOURCE, STAGING].sort(),
      );
      // mart columns should not appear
      expect(result.current.columns[`${MART}_id`]).toBeUndefined();
      expect(result.current.columns[`${MART}_total`]).toBeUndefined();
    });

    it("respects both no_upstream and no_downstream — anchor only", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
        no_upstream: true,
        no_downstream: true,
      });

      expect(Object.keys(result.current.nodes)).toEqual([STAGING]);
      expect(Object.keys(result.current.columns).sort()).toEqual(
        [`${STAGING}_id`, `${STAGING}_name`, `${STAGING}_amount`].sort(),
      );
    });

    it("filters parent_map and child_map to only include reachable entries", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
        no_upstream: true,
      });

      // parent_map should not reference source columns
      expect(result.current.parent_map[`${STAGING}_id`] ?? []).toEqual([]);
      expect(result.current.parent_map[`${STAGING}_name`] ?? []).toEqual([]);
      // child_map for staging columns should still point to mart
      expect(result.current.child_map[`${STAGING}_id`]).toEqual([`${MART}_id`]);
    });

    it("handles anchor at the edge (leaf node)", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, { node_id: MART });

      expect(Object.keys(result.current.nodes).sort()).toEqual(
        [SOURCE, STAGING, MART].sort(),
      );
    });
  });

  describe("column-level (node_id + column)", () => {
    it("traces upstream and downstream from the anchor column", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
        column: "id",
      });

      // Should trace: source_a.id → staging.id → mart.id
      const columnKeys = Object.keys(result.current.columns).sort();
      expect(columnKeys).toEqual(
        [`${SOURCE}_id`, `${STAGING}_id`, `${MART}_id`].sort(),
      );
    });

    it("does not include nodes in column-level results (matches backend)", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
        column: "id",
      });

      // Backend returns only columns for column-level queries, not nodes
      expect(Object.keys(result.current.nodes)).toEqual([]);
    });

    it("does not include unrelated columns", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
        column: "id",
      });

      // staging.name and staging.amount are not in the id lineage
      expect(result.current.columns[`${STAGING}_name`]).toBeUndefined();
      expect(result.current.columns[`${STAGING}_amount`]).toBeUndefined();
      expect(result.current.columns[`${SOURCE}_name`]).toBeUndefined();
    });

    it("respects no_upstream with column anchor", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
        column: "id",
        no_upstream: true,
      });

      const columnKeys = Object.keys(result.current.columns).sort();
      expect(columnKeys).toEqual([`${STAGING}_id`, `${MART}_id`].sort());
      expect(result.current.nodes[SOURCE]).toBeUndefined();
    });

    it("respects no_downstream with column anchor", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
        column: "id",
        no_downstream: true,
      });

      const columnKeys = Object.keys(result.current.columns).sort();
      expect(columnKeys).toEqual([`${SOURCE}_id`, `${STAGING}_id`].sort());
      expect(result.current.nodes[MART]).toBeUndefined();
    });

    it("traces column with no upstream parents (origin column)", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
        column: "amount",
      });

      // amount has no upstream, but flows to mart.total
      const columnKeys = Object.keys(result.current.columns).sort();
      expect(columnKeys).toEqual([`${STAGING}_amount`, `${MART}_total`].sort());
    });

    it("preserves change metadata on nodes in node-level results", () => {
      const fullMap = makeFullMap();
      const result = sliceCllMap(fullMap, {
        node_id: STAGING,
      });

      expect(result.current.nodes[SOURCE].change_status).toBe("modified");
      expect(result.current.nodes[SOURCE].change_category).toBe("breaking");
      expect(result.current.nodes[STAGING].impacted).toBe(true);
    });
  });
});
