/**
 * @file CllChangeAnalysisPropagation.test.ts
 *
 * Behavior of change analysis ("Impact Radius") as the user navigates CLL.
 *
 * Every step below drives the same transitions production runs — the helpers in
 * `../changeAnalysisState`, which LineageViewOss, the CLL control, and the node
 * context menu all call. `changeAnalysisMode` is independent of
 * `viewOptions.column_level_lineage`, so column clicks that replace the
 * CllInput wholesale can no longer drop it.
 *
 * A scenario is a sequence of those transitions, mirroring the call order of
 * the production handlers it names.
 */

import type { CllInput } from "../../../api/cll";
import type {
  LineageGraph,
  LineageGraphNode,
} from "../../../contexts/lineage/types";
import {
  activateImpactRadius,
  buildCllApiInput,
  columnClickCllInput,
  isNodeShowingChangeAnalysis,
  nextChangeAnalysisMode,
  resolveResetCllInput,
} from "../changeAnalysisState";

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
const OTHER_MODIFIED_NODE = "model.test.payments";
const UNMODIFIED_NODE = "model.test.customers";

const lineageGraph = createLineageGraph({
  [MODIFIED_NODE]: { changeStatus: "modified" },
  [OTHER_MODIFIED_NODE]: { changeStatus: "modified" },
  [UNMODIFIED_NODE]: {},
});

/**
 * The view state the transitions move: the CLL request in viewOptions plus the
 * independent change-analysis flag.
 */
interface CllViewState {
  cllInput: CllInput | undefined;
  changeAnalysisMode: boolean;
}

/**
 * Impact Radius activation. Runs the production activation the CLL control
 * button and the node context menu item both run, wired to the same two
 * callbacks they pass it, and records where the view state lands. Nothing about
 * what activation does is restated here — drop the mode-setting from
 * `activateImpactRadius` and every scenario below starts from mode off.
 */
function impactRadiusActivation(nodeId?: string): CllViewState {
  const state: CllViewState = {
    cllInput: undefined,
    changeAnalysisMode: false,
  };
  activateImpactRadius({
    nodeId,
    setChangeAnalysisMode: (active) => {
      state.changeAnalysisMode = active;
    },
    showColumnLevelLineage: (cllInput) => {
      state.cllInput = cllInput;
    },
  });
  return state;
}

/** `showColumnLevelLineage(cllInput)` — the CLL request is replaced wholesale. */
function showColumnLevelLineage(
  state: CllViewState,
  cllInput: CllInput | undefined,
  newCllExperience = false,
): CllViewState {
  return {
    cllInput,
    changeAnalysisMode: nextChangeAnalysisMode({
      cllInput,
      changeAnalysisMode: state.changeAnalysisMode,
      newCllExperience,
    }),
  };
}

/**
 * The paths that clear CLL without going through `showColumnLevelLineage`
 * (reselect, selectParentNodes, selectChildNodes) — `refreshLayout` applies the
 * same transition with no CLL input.
 */
function refreshLayoutWithClearedCll(
  state: CllViewState,
  newCllExperience = false,
): CllViewState {
  return {
    cllInput: undefined,
    changeAnalysisMode: nextChangeAnalysisMode({
      cllInput: undefined,
      changeAnalysisMode: state.changeAnalysisMode,
      newCllExperience,
    }),
  };
}

/** `resetColumnLevelLineage()` — the X button, with no history to restore. */
function resetColumnLevelLineage(
  state: CllViewState,
  newCllExperience = false,
): CllViewState {
  return showColumnLevelLineage(
    state,
    resolveResetCllInput({
      changeAnalysisMode: state.changeAnalysisMode,
      newCllExperience,
    }),
    newCllExperience,
  );
}

function showsChangeAnalysis(nodeId: string, state: CllViewState): boolean {
  return isNodeShowingChangeAnalysis({
    nodeId,
    changeAnalysisMode: state.changeAnalysisMode,
    cllInput: state.cllInput,
    lineageGraph,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CLL change analysis", () => {
  describe("activation radius", () => {
    it("shows change analysis on the radius node", () => {
      const state = impactRadiusActivation(MODIFIED_NODE);

      expect(showsChangeAnalysis(MODIFIED_NODE, state)).toBe(true);
    });

    it("treats every changed node in a global radius and leaves unchanged ones alone", () => {
      // The CLL control's Impact Radius button activates without a node id, so
      // the radius covers the whole graph — the only thing separating the two
      // kinds of node here is their change status.
      const state = impactRadiusActivation();

      expect(showsChangeAnalysis(MODIFIED_NODE, state)).toBe(true);
      expect(showsChangeAnalysis(OTHER_MODIFIED_NODE, state)).toBe(true);
      expect(showsChangeAnalysis(UNMODIFIED_NODE, state)).toBe(false);
    });

    it("scopes the radius to its own node while no column is selected", () => {
      const state = impactRadiusActivation(OTHER_MODIFIED_NODE);

      expect(showsChangeAnalysis(OTHER_MODIFIED_NODE, state)).toBe(true);
      // Another changed node outside the radius stays untreated.
      expect(showsChangeAnalysis(MODIFIED_NODE, state)).toBe(false);
    });

    it("shows nothing until the radius is activated", () => {
      const state: CllViewState = {
        cllInput: undefined,
        changeAnalysisMode: false,
      };

      expect(showsChangeAnalysis(MODIFIED_NODE, state)).toBe(false);
    });
  });

  describe("column navigation", () => {
    it("keeps change analysis when a column on the radius node is clicked", () => {
      let state = impactRadiusActivation(MODIFIED_NODE);

      state = showColumnLevelLineage(
        state,
        columnClickCllInput(MODIFIED_NODE, "order_id"),
      );

      expect(showsChangeAnalysis(MODIFIED_NODE, state)).toBe(true);
    });

    it("keeps change analysis when a column on another node is clicked", () => {
      let state = impactRadiusActivation(MODIFIED_NODE);

      state = showColumnLevelLineage(
        state,
        columnClickCllInput(UNMODIFIED_NODE, "customer_id"),
      );

      expect(showsChangeAnalysis(MODIFIED_NODE, state)).toBe(true);
    });

    it("keeps change analysis across a run of column clicks", () => {
      let state = impactRadiusActivation(MODIFIED_NODE);

      state = showColumnLevelLineage(
        state,
        columnClickCllInput(MODIFIED_NODE, "order_id"),
      );
      state = showColumnLevelLineage(
        state,
        columnClickCllInput(MODIFIED_NODE, "customer_id"),
      );
      state = showColumnLevelLineage(
        state,
        columnClickCllInput(UNMODIFIED_NODE, "name"),
      );

      expect(showsChangeAnalysis(MODIFIED_NODE, state)).toBe(true);
    });

    it("still requests change analysis from the API after a column click", () => {
      let state = impactRadiusActivation(MODIFIED_NODE);

      state = showColumnLevelLineage(
        state,
        columnClickCllInput(MODIFIED_NODE, "order_id"),
      );

      // The column click carries no change_analysis of its own; the mode is
      // injected when the request is built.
      expect(state.cllInput?.change_analysis).toBeUndefined();
      expect(
        buildCllApiInput(state.cllInput!, state.changeAnalysisMode)
          .change_analysis,
      ).toBe(true);
    });

    it("does not request change analysis once the mode is off", () => {
      const cllInput = columnClickCllInput(MODIFIED_NODE, "order_id");

      expect(buildCllApiInput(cllInput, false).change_analysis).toBe(false);
    });
  });

  describe("reset and deactivation", () => {
    it("clears change analysis when CLL is turned off", () => {
      let state = impactRadiusActivation(MODIFIED_NODE);

      state = showColumnLevelLineage(state, undefined);

      expect(state.changeAnalysisMode).toBe(false);
      expect(showsChangeAnalysis(MODIFIED_NODE, state)).toBe(false);
    });

    it("clears change analysis when a reselect drops CLL", () => {
      let state = impactRadiusActivation(MODIFIED_NODE);

      state = refreshLayoutWithClearedCll(state);

      expect(state.changeAnalysisMode).toBe(false);
      expect(showsChangeAnalysis(MODIFIED_NODE, state)).toBe(false);
    });

    it("clears CLL entirely on reset", () => {
      let state = impactRadiusActivation(MODIFIED_NODE);

      state = resetColumnLevelLineage(state);

      expect(state.cllInput).toBeUndefined();
      expect(state.changeAnalysisMode).toBe(false);
    });
  });

  describe("new CLL experience — one-way ratchet", () => {
    it("keeps change analysis when CLL is turned off", () => {
      let state = impactRadiusActivation(MODIFIED_NODE);

      state = showColumnLevelLineage(state, undefined, true);

      expect(state.changeAnalysisMode).toBe(true);
    });

    it("keeps change analysis when a reselect drops CLL", () => {
      let state = impactRadiusActivation(MODIFIED_NODE);

      state = refreshLayoutWithClearedCll(state, true);

      expect(state.changeAnalysisMode).toBe(true);
    });

    it("resets from a column back to the global impact radius", () => {
      let state = impactRadiusActivation(MODIFIED_NODE);
      state = showColumnLevelLineage(
        state,
        columnClickCllInput(MODIFIED_NODE, "order_id"),
        true,
      );

      state = resetColumnLevelLineage(state, true);

      expect(state.changeAnalysisMode).toBe(true);
      expect(state.cllInput).toEqual({
        change_analysis: true,
        no_upstream: true,
      });
    });
  });
});
