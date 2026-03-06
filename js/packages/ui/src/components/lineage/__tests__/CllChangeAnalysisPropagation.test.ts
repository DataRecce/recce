/**
 * @file CllChangeAnalysisPropagation.test.ts
 *
 * Tests demonstrating the change_analysis state propagation bug.
 *
 * Bug: viewOptions.column_level_lineage is a dual-role object — both API
 * params and UI mode flag. Column clicks wholesale-replace this object via
 * showColumnLevelLineage({ node_id, column }), losing the change_analysis
 * flag. This causes isNodeShowingChangeAnalysis to return false even though
 * the user never turned off Impact Radius.
 *
 * See: docs/plans/state_model_repair.md
 *
 * The logic under test is extracted verbatim from LineageViewOss.tsx:923-942.
 * These tests validate the state machine, not React rendering.
 */

import type { CllInput } from "../../../api/cll";
import type { LineageDiffViewOptions } from "../../../api/lineagecheck";
import type {
  LineageGraph,
  LineageGraphNode,
} from "../../../contexts/lineage/types";

// ---------------------------------------------------------------------------
// Helpers — extracted verbatim from LineageViewOss.tsx
// ---------------------------------------------------------------------------

/**
 * Mirrors the isNodeShowingChangeAnalysis closure in LineageViewOss.tsx:923-942.
 * Once the fix lands, this will be replaced by an import of the real function.
 */
function isNodeShowingChangeAnalysis(
  nodeId: string,
  viewOptions: LineageDiffViewOptions,
  lineageGraph: LineageGraph,
): boolean {
  const node =
    nodeId in lineageGraph.nodes ? lineageGraph.nodes[nodeId] : undefined;

  if (viewOptions.column_level_lineage?.change_analysis) {
    const cll = viewOptions.column_level_lineage;

    if (cll.node_id && !cll.column) {
      return cll.node_id === nodeId && !!node?.data.changeStatus;
    }
    return !!node?.data.changeStatus;
  }

  return false;
}

/**
 * Mirrors what showColumnLevelLineage does to viewOptions (LineageViewOss.tsx:504-534).
 * It replaces column_level_lineage wholesale.
 */
function applyShowColumnLevelLineage(
  viewOptions: LineageDiffViewOptions,
  cllInput: CllInput | undefined,
): LineageDiffViewOptions {
  return {
    ...viewOptions,
    column_level_lineage: cllInput,
  };
}

/**
 * Mirrors what onColumnNodeClick passes to showColumnLevelLineage
 * (LineageViewOss.tsx:552-564). Only node_id and column — nothing else.
 */
function buildColumnClickInput(nodeId: string, column: string): CllInput {
  return { node_id: nodeId, column };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createLineageGraph(
  nodes: Record<string, Partial<LineageGraphNode["data"]>> = {},
): LineageGraph {
  const graphNodes: Record<string, LineageGraphNode> = {};
  for (const [id, overrides] of Object.entries(nodes)) {
    graphNodes[id] = {
      id,
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id,
        name: id.split(".").pop() ?? id,
        from: "both",
        data: { base: undefined, current: undefined },
        resourceType: "model",
        packageName: "test",
        parents: {},
        children: {},
        ...overrides,
      },
    };
  }
  return {
    nodes: graphNodes,
    edges: {},
    modifiedSet: Object.keys(graphNodes).filter(
      (id) => graphNodes[id].data.changeStatus,
    ),
    manifestMetadata: { base: undefined, current: undefined },
    catalogMetadata: { base: undefined, current: undefined },
  };
}

const MODIFIED_NODE = "model.test.orders";
const UNMODIFIED_NODE = "model.test.customers";

const lineageGraph = createLineageGraph({
  [MODIFIED_NODE]: { changeStatus: "modified" },
  [UNMODIFIED_NODE]: {},
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CLL change_analysis state propagation", () => {
  // =========================================================================
  // Baseline: isNodeShowingChangeAnalysis with correct state
  // =========================================================================

  describe("isNodeShowingChangeAnalysis baseline", () => {
    it("returns true for modified node when change_analysis is active (node-only, no column)", () => {
      const viewOptions: LineageDiffViewOptions = {
        column_level_lineage: {
          node_id: MODIFIED_NODE,
          change_analysis: true,
          no_upstream: true,
        },
      };

      expect(
        isNodeShowingChangeAnalysis(MODIFIED_NODE, viewOptions, lineageGraph),
      ).toBe(true);
    });

    it("returns false for unmodified node even when change_analysis is active", () => {
      const viewOptions: LineageDiffViewOptions = {
        column_level_lineage: {
          node_id: MODIFIED_NODE,
          change_analysis: true,
          no_upstream: true,
        },
      };

      expect(
        isNodeShowingChangeAnalysis(UNMODIFIED_NODE, viewOptions, lineageGraph),
      ).toBe(false);
    });

    it("returns true for modified node when change_analysis is active with a column selected", () => {
      const viewOptions: LineageDiffViewOptions = {
        column_level_lineage: {
          node_id: MODIFIED_NODE,
          column: "order_id",
          change_analysis: true,
        },
      };

      expect(
        isNodeShowingChangeAnalysis(MODIFIED_NODE, viewOptions, lineageGraph),
      ).toBe(true);
    });

    it("returns false when change_analysis is not set", () => {
      const viewOptions: LineageDiffViewOptions = {
        column_level_lineage: {
          node_id: MODIFIED_NODE,
          column: "order_id",
        },
      };

      expect(
        isNodeShowingChangeAnalysis(MODIFIED_NODE, viewOptions, lineageGraph),
      ).toBe(false);
    });

    it("returns false when column_level_lineage is undefined", () => {
      const viewOptions: LineageDiffViewOptions = {};

      expect(
        isNodeShowingChangeAnalysis(MODIFIED_NODE, viewOptions, lineageGraph),
      ).toBe(false);
    });
  });

  // =========================================================================
  // The bug: change_analysis lost during column navigation
  // =========================================================================

  describe("change_analysis during column navigation", () => {
    it.fails("preserves change_analysis mode when user clicks a column after activating impact radius", () => {
      // Step 1: Impact Radius activated on a modified node
      let viewOptions: LineageDiffViewOptions = {
        column_level_lineage: {
          node_id: MODIFIED_NODE,
          change_analysis: true,
          no_upstream: true,
        },
      };

      // Sanity: change analysis is active
      expect(
        isNodeShowingChangeAnalysis(MODIFIED_NODE, viewOptions, lineageGraph),
      ).toBe(true);

      // Step 2: User clicks a column — onColumnNodeClick fires
      const columnClick = buildColumnClickInput(MODIFIED_NODE, "order_id");
      viewOptions = applyShowColumnLevelLineage(viewOptions, columnClick);

      // BUG: change_analysis is lost because columnClick doesn't include it.
      // After the fix, this should still be true.
      expect(
        isNodeShowingChangeAnalysis(MODIFIED_NODE, viewOptions, lineageGraph),
      ).toBe(true);
    });

    it.fails("preserves change_analysis mode when user clicks columns on different nodes", () => {
      // Step 1: Impact Radius on modified node
      let viewOptions: LineageDiffViewOptions = {
        column_level_lineage: {
          node_id: MODIFIED_NODE,
          change_analysis: true,
          no_upstream: true,
        },
      };

      // Step 2: Click column on a DIFFERENT node
      const columnClick = buildColumnClickInput(UNMODIFIED_NODE, "customer_id");
      viewOptions = applyShowColumnLevelLineage(viewOptions, columnClick);

      // The modified node should still show change analysis
      expect(
        isNodeShowingChangeAnalysis(MODIFIED_NODE, viewOptions, lineageGraph),
      ).toBe(true);
    });

    it.fails("preserves change_analysis through multiple sequential column clicks", () => {
      // Step 1: Impact Radius
      let viewOptions: LineageDiffViewOptions = {
        column_level_lineage: {
          node_id: MODIFIED_NODE,
          change_analysis: true,
          no_upstream: true,
        },
      };

      // Step 2: Click column A
      viewOptions = applyShowColumnLevelLineage(
        viewOptions,
        buildColumnClickInput(MODIFIED_NODE, "order_id"),
      );

      // Step 3: Click column B
      viewOptions = applyShowColumnLevelLineage(
        viewOptions,
        buildColumnClickInput(MODIFIED_NODE, "customer_id"),
      );

      // Step 4: Click column on another node
      viewOptions = applyShowColumnLevelLineage(
        viewOptions,
        buildColumnClickInput(UNMODIFIED_NODE, "name"),
      );

      // change_analysis should survive all of these
      expect(
        isNodeShowingChangeAnalysis(MODIFIED_NODE, viewOptions, lineageGraph),
      ).toBe(true);
    });
  });

  // =========================================================================
  // CLL API params: change_analysis should reach the API during navigation
  // =========================================================================

  describe("CLL API params during column navigation", () => {
    it.fails("column click CllInput should include change_analysis when impact mode is active", () => {
      // When impact radius is active and user clicks a column,
      // the CllInput sent to the API should include change_analysis: true.
      // Currently, onColumnNodeClick builds { node_id, column } with no
      // change_analysis, so the API never receives it.

      const impactRadiusState: LineageDiffViewOptions = {
        column_level_lineage: {
          node_id: MODIFIED_NODE,
          change_analysis: true,
          no_upstream: true,
        },
      };

      // Simulate onColumnNodeClick: it builds a CllInput without change_analysis
      const columnClick = buildColumnClickInput(MODIFIED_NODE, "order_id");
      const apiInput = applyShowColumnLevelLineage(
        impactRadiusState,
        columnClick,
      );

      // The CllInput that goes to the API should still have change_analysis
      expect(apiInput.column_level_lineage?.change_analysis).toBe(true);
    });
  });

  // =========================================================================
  // Turning off CLL should clear change_analysis
  // =========================================================================

  describe("deactivation", () => {
    it("change_analysis is cleared when CLL is turned off", () => {
      // Step 1: Impact Radius active
      let viewOptions: LineageDiffViewOptions = {
        column_level_lineage: {
          node_id: MODIFIED_NODE,
          change_analysis: true,
          no_upstream: true,
        },
      };

      // Step 2: CLL turned off (resetColumnLevelLineage)
      viewOptions = applyShowColumnLevelLineage(viewOptions, undefined);

      expect(
        isNodeShowingChangeAnalysis(MODIFIED_NODE, viewOptions, lineageGraph),
      ).toBe(false);
    });
  });
});
