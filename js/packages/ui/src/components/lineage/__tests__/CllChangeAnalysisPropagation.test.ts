/**
 * @file CllChangeAnalysisPropagation.test.ts
 *
 * Tests for the change_analysis state model after the propagation fix.
 *
 * Fix: changeAnalysisMode is now an independent boolean, separate from
 * viewOptions.column_level_lineage. Column clicks replace CllInput wholesale
 * but can no longer lose the change_analysis flag because it lives elsewhere.
 *
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
 * Mirrors the isNodeShowingChangeAnalysis logic after the fix.
 * changeAnalysisMode is now an independent boolean, not derived from CllInput.
 */
function isNodeShowingChangeAnalysis(
  nodeId: string,
  changeAnalysisMode: boolean,
  viewOptions: LineageDiffViewOptions,
  lineageGraph: LineageGraph,
): boolean {
  const node =
    nodeId in lineageGraph.nodes ? lineageGraph.nodes[nodeId] : undefined;

  if (!changeAnalysisMode) {
    return false;
  }

  const cll = viewOptions.column_level_lineage;
  if (cll?.node_id && !cll.column) {
    return cll.node_id === nodeId && !!node?.data.changeStatus;
  }
  return !!node?.data.changeStatus;
}

/**
 * Mirrors what showColumnLevelLineage does after the fix.
 * It replaces column_level_lineage wholesale, and clears changeAnalysisMode
 * when CLL is turned off entirely.
 *
 * In new CLL experience, changeAnalysisMode is never cleared (one-way ratchet).
 */
function applyShowColumnLevelLineage(
  viewOptions: LineageDiffViewOptions,
  cllInput: CllInput | undefined,
  changeAnalysisMode: boolean,
  newCllExperience = false,
): { viewOptions: LineageDiffViewOptions; changeAnalysisMode: boolean } {
  return {
    viewOptions: {
      ...viewOptions,
      column_level_lineage: cllInput,
    },
    // Clear change analysis mode when CLL is turned off
    // In new CLL experience, impact is a one-way ratchet — never disable it.
    changeAnalysisMode:
      cllInput || newCllExperience ? changeAnalysisMode : false,
  };
}

/**
 * Mirrors what onColumnNodeClick passes to showColumnLevelLineage.
 * Only node_id and column — nothing else.
 */
function buildColumnClickInput(nodeId: string, column: string): CllInput {
  return { node_id: nodeId, column };
}

/**
 * Mirrors the refreshLayout clearing behavior: when CLL is cleared by any
 * path (reselect, selectParentNodes, selectChildNodes), changeAnalysisMode
 * is also cleared.
 *
 * In new CLL experience, changeAnalysisMode is preserved (one-way ratchet).
 */
function applyRefreshLayoutCllClearing(
  viewOptions: LineageDiffViewOptions,
  changeAnalysisMode: boolean,
  newCllExperience = false,
): { viewOptions: LineageDiffViewOptions; changeAnalysisMode: boolean } {
  if (!viewOptions.column_level_lineage && !newCllExperience) {
    return { viewOptions, changeAnalysisMode: false };
  }
  return { viewOptions, changeAnalysisMode };
}

/**
 * Mirrors resetColumnLevelLineage when called without `previous` arg.
 * In new CLL experience + changeAnalysisMode, resets to Layer 2 (global impact).
 * Otherwise clears CLL entirely.
 */
function applyResetColumnLevelLineage(
  viewOptions: LineageDiffViewOptions,
  changeAnalysisMode: boolean,
  newCllExperience = false,
): { viewOptions: LineageDiffViewOptions; changeAnalysisMode: boolean } {
  if (newCllExperience && changeAnalysisMode) {
    return applyShowColumnLevelLineage(
      viewOptions,
      { change_analysis: true, no_upstream: true },
      changeAnalysisMode,
      newCllExperience,
    );
  }
  return applyShowColumnLevelLineage(
    viewOptions,
    undefined,
    changeAnalysisMode,
    newCllExperience,
  );
}

/**
 * Mirrors activating Impact Radius: sets CLL params and flips the
 * independent changeAnalysisMode boolean to true.
 */
function activateImpactRadius(
  viewOptions: LineageDiffViewOptions,
  nodeId: string,
): { viewOptions: LineageDiffViewOptions; changeAnalysisMode: boolean } {
  return {
    viewOptions: {
      ...viewOptions,
      column_level_lineage: {
        node_id: nodeId,
        change_analysis: true,
        no_upstream: true,
      },
    },
    changeAnalysisMode: true,
  };
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
        isNodeShowingChangeAnalysis(
          MODIFIED_NODE,
          true,
          viewOptions,
          lineageGraph,
        ),
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
        isNodeShowingChangeAnalysis(
          UNMODIFIED_NODE,
          true,
          viewOptions,
          lineageGraph,
        ),
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
        isNodeShowingChangeAnalysis(
          MODIFIED_NODE,
          true,
          viewOptions,
          lineageGraph,
        ),
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
        isNodeShowingChangeAnalysis(
          MODIFIED_NODE,
          false,
          viewOptions,
          lineageGraph,
        ),
      ).toBe(false);
    });

    it("returns false when column_level_lineage is undefined", () => {
      const viewOptions: LineageDiffViewOptions = {};

      expect(
        isNodeShowingChangeAnalysis(
          MODIFIED_NODE,
          false,
          viewOptions,
          lineageGraph,
        ),
      ).toBe(false);
    });
  });

  // =========================================================================
  // The bug: change_analysis lost during column navigation
  // =========================================================================

  describe("change_analysis during column navigation", () => {
    it("preserves change_analysis mode when user clicks a column after activating impact radius", () => {
      // Step 1: Impact Radius activated on a modified node
      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      // Sanity: change analysis is active
      expect(
        isNodeShowingChangeAnalysis(
          MODIFIED_NODE,
          changeAnalysisMode,
          viewOptions,
          lineageGraph,
        ),
      ).toBe(true);

      // Step 2: User clicks a column — onColumnNodeClick fires
      const columnClick = buildColumnClickInput(MODIFIED_NODE, "order_id");
      ({ viewOptions, changeAnalysisMode } = applyShowColumnLevelLineage(
        viewOptions,
        columnClick,
        changeAnalysisMode,
      ));

      // changeAnalysisMode is independent — column clicks don't clear it
      expect(
        isNodeShowingChangeAnalysis(
          MODIFIED_NODE,
          changeAnalysisMode,
          viewOptions,
          lineageGraph,
        ),
      ).toBe(true);
    });

    it("preserves change_analysis mode when user clicks columns on different nodes", () => {
      // Step 1: Impact Radius on modified node
      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      // Step 2: Click column on a DIFFERENT node
      const columnClick = buildColumnClickInput(UNMODIFIED_NODE, "customer_id");
      ({ viewOptions, changeAnalysisMode } = applyShowColumnLevelLineage(
        viewOptions,
        columnClick,
        changeAnalysisMode,
      ));

      // The modified node should still show change analysis
      expect(
        isNodeShowingChangeAnalysis(
          MODIFIED_NODE,
          changeAnalysisMode,
          viewOptions,
          lineageGraph,
        ),
      ).toBe(true);
    });

    it("preserves change_analysis through multiple sequential column clicks", () => {
      // Step 1: Impact Radius
      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      // Step 2: Click column A
      ({ viewOptions, changeAnalysisMode } = applyShowColumnLevelLineage(
        viewOptions,
        buildColumnClickInput(MODIFIED_NODE, "order_id"),
        changeAnalysisMode,
      ));

      // Step 3: Click column B
      ({ viewOptions, changeAnalysisMode } = applyShowColumnLevelLineage(
        viewOptions,
        buildColumnClickInput(MODIFIED_NODE, "customer_id"),
        changeAnalysisMode,
      ));

      // Step 4: Click column on another node
      ({ viewOptions, changeAnalysisMode } = applyShowColumnLevelLineage(
        viewOptions,
        buildColumnClickInput(UNMODIFIED_NODE, "name"),
        changeAnalysisMode,
      ));

      // change_analysis should survive all of these
      expect(
        isNodeShowingChangeAnalysis(
          MODIFIED_NODE,
          changeAnalysisMode,
          viewOptions,
          lineageGraph,
        ),
      ).toBe(true);
    });
  });

  // =========================================================================
  // CLL API params: change_analysis should reach the API during navigation
  // =========================================================================

  describe("CLL API params during column navigation", () => {
    it("changeAnalysisMode survives column clicks so API call site can inject it", () => {
      // When impact radius is active and user clicks a column,
      // changeAnalysisMode stays true — the API call site injects
      // change_analysis: changeAnalysisMode into the request.

      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      // Simulate onColumnNodeClick
      const columnClick = buildColumnClickInput(MODIFIED_NODE, "order_id");
      ({ viewOptions, changeAnalysisMode } = applyShowColumnLevelLineage(
        viewOptions,
        columnClick,
        changeAnalysisMode,
      ));

      // The independent boolean survives — API call site uses this to inject change_analysis
      expect(changeAnalysisMode).toBe(true);
    });
  });

  // =========================================================================
  // Turning off CLL should clear change_analysis
  // =========================================================================

  describe("deactivation", () => {
    it("change_analysis is cleared when CLL is turned off", () => {
      // Step 1: Impact Radius active
      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      // Step 2: CLL turned off (resetColumnLevelLineage)
      ({ viewOptions, changeAnalysisMode } = applyShowColumnLevelLineage(
        viewOptions,
        undefined,
        changeAnalysisMode,
      ));

      expect(changeAnalysisMode).toBe(false);
      expect(
        isNodeShowingChangeAnalysis(
          MODIFIED_NODE,
          changeAnalysisMode,
          viewOptions,
          lineageGraph,
        ),
      ).toBe(false);
    });

    it("change_analysis is cleared when CLL is cleared by reselect path", () => {
      // Step 1: Impact Radius active
      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      // Step 2: Reselect clears CLL (e.g. view mode change)
      viewOptions = { ...viewOptions, column_level_lineage: undefined };
      ({ viewOptions, changeAnalysisMode } = applyRefreshLayoutCllClearing(
        viewOptions,
        changeAnalysisMode,
      ));

      expect(changeAnalysisMode).toBe(false);
      expect(
        isNodeShowingChangeAnalysis(
          MODIFIED_NODE,
          changeAnalysisMode,
          viewOptions,
          lineageGraph,
        ),
      ).toBe(false);
    });

    it("change_analysis is cleared when selectParentNodes clears CLL", () => {
      // Step 1: Impact Radius active
      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      // Step 2: selectParentNodes calls handleViewOptionsChanged with CLL undefined
      viewOptions = { ...viewOptions, column_level_lineage: undefined };
      ({ viewOptions, changeAnalysisMode } = applyRefreshLayoutCllClearing(
        viewOptions,
        changeAnalysisMode,
      ));

      expect(changeAnalysisMode).toBe(false);
    });
  });

  // =========================================================================
  // New CLL experience: one-way ratchet behavior
  // =========================================================================

  describe("new CLL experience — one-way ratchet", () => {
    it("changeAnalysisMode survives CLL being turned off", () => {
      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      // CLL turned off — in new experience, changeAnalysisMode is preserved
      ({ viewOptions, changeAnalysisMode } = applyShowColumnLevelLineage(
        viewOptions,
        undefined,
        changeAnalysisMode,
        true,
      ));

      expect(changeAnalysisMode).toBe(true);
    });

    it("changeAnalysisMode survives reselect/selectParentNodes path", () => {
      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      // Reselect clears CLL
      viewOptions = { ...viewOptions, column_level_lineage: undefined };
      ({ viewOptions, changeAnalysisMode } = applyRefreshLayoutCllClearing(
        viewOptions,
        changeAnalysisMode,
        true,
      ));

      expect(changeAnalysisMode).toBe(true);
    });

    it("reset from Layer 3 returns to Layer 2 (global impact)", () => {
      // Step 1: Impact Radius active
      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      // Step 2: User clicks column → Layer 3
      ({ viewOptions, changeAnalysisMode } = applyShowColumnLevelLineage(
        viewOptions,
        buildColumnClickInput(MODIFIED_NODE, "order_id"),
        changeAnalysisMode,
        true,
      ));

      // Step 3: User hits reset (X button) → should return to Layer 2
      ({ viewOptions, changeAnalysisMode } = applyResetColumnLevelLineage(
        viewOptions,
        changeAnalysisMode,
        true,
      ));

      expect(changeAnalysisMode).toBe(true);
      expect(viewOptions.column_level_lineage).toEqual({
        change_analysis: true,
        no_upstream: true,
      });
    });

    it("without newCllExperience, reset still clears CLL entirely", () => {
      let { viewOptions, changeAnalysisMode } = activateImpactRadius(
        {},
        MODIFIED_NODE,
      );

      ({ viewOptions, changeAnalysisMode } = applyResetColumnLevelLineage(
        viewOptions,
        changeAnalysisMode,
        false,
      ));

      expect(changeAnalysisMode).toBe(false);
      expect(viewOptions.column_level_lineage).toBeUndefined();
    });
  });
});
