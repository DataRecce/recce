/**
 * @file LineageGraphContext.test.tsx
 * @description Tests for LineageGraphContext provider and hooks in @datarecce/ui
 *
 * Phase 2A: Context Unification - Establishing behavioral contracts
 * These tests verify the behavior of LineageGraphProvider, useLineageGraphContext,
 * and useRunsAggregated to ensure identical behavior during migration.
 *
 * IMPORTANT: This is a PROPS-DRIVEN provider (different from OSS which has internal data fetching).
 * - It receives `lineageGraph`, `isLoading`, `error` as PROPS
 * - It does NOT do internal data fetching (no useQuery)
 * - Consumer provides callbacks like `onRefetchLineageGraph`
 */

import { render, screen } from "@testing-library/react";

import type { RunsAggregated } from "../../../api/runs";
import {
  LineageGraphProvider,
  useLineageGraphContext,
  useRunsAggregated,
} from "../LineageGraphContext";
import type { EnvInfo, LineageGraph, LineageGraphNode } from "../types";

/**
 * Create a minimal mock LineageGraphNode for testing
 */
function createMockNode(id: string, name: string): LineageGraphNode {
  return {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name,
      from: "both",
      data: {},
      parents: {},
      children: {},
    },
  };
}

/**
 * Create a mock LineageGraph for testing
 */
function createMockLineageGraph(): LineageGraph {
  return {
    nodes: {
      "model.test.users": createMockNode("model.test.users", "users"),
      "model.test.orders": createMockNode("model.test.orders", "orders"),
    },
    edges: {},
    modifiedSet: ["model.test.users"],
    manifestMetadata: {
      base: undefined,
      current: undefined,
    },
    catalogMetadata: {
      base: undefined,
      current: undefined,
    },
  };
}

/**
 * Create mock EnvInfo for testing
 */
function createMockEnvInfo(): EnvInfo {
  return {
    adapterType: "dbt",
    git: {
      branch: "feature/test",
    },
  };
}

/**
 * Create mock RunsAggregated for testing
 * Note: We use a partial type since in practice not all run types are present
 */
function createMockRunsAggregated(): RunsAggregated {
  return {
    "model.test.users": {
      row_count_diff: {
        run_id: "run-1",
        result: { base: 100, current: 110 },
      },
      value_diff: {
        run_id: "run-2",
        result: null,
      },
      row_count: {
        run_id: "run-3",
        result: 100,
      },
    },
  };
}

/**
 * Test consumer component that displays context values
 */
function TestConsumer() {
  const context = useLineageGraphContext();
  return (
    <div>
      <span data-testid="has-lineage-graph">
        {String(context.lineageGraph !== undefined)}
      </span>
      <span data-testid="is-loading">{String(context.isLoading)}</span>
      <span data-testid="error">{context.error ?? "none"}</span>
      <span data-testid="is-demo-site">{String(context.isDemoSite)}</span>
      <span data-testid="review-mode">{String(context.reviewMode)}</span>
      <span data-testid="cloud-mode">{String(context.cloudMode)}</span>
      <span data-testid="file-mode">{String(context.fileMode)}</span>
      <span data-testid="file-name">{context.fileName ?? "none"}</span>
      <span data-testid="is-codespace">{String(context.isCodespace)}</span>
      <span data-testid="has-env-info">
        {String(context.envInfo !== undefined)}
      </span>
      <span data-testid="adapter-type">
        {context.envInfo?.adapterType ?? "none"}
      </span>
      <span data-testid="has-refetch">
        {String(context.retchLineageGraph !== undefined)}
      </span>
      <span data-testid="has-runs-aggregated">
        {String(context.runsAggregated !== undefined)}
      </span>
      <span data-testid="has-refetch-runs">
        {String(context.refetchRunsAggregated !== undefined)}
      </span>
    </div>
  );
}

/**
 * Test consumer for isActionAvailable functionality
 */
function ActionAvailabilityConsumer() {
  const context = useLineageGraphContext();
  return (
    <div>
      <span data-testid="action-row_count_diff">
        {String(context.isActionAvailable("row_count_diff"))}
      </span>
      <span data-testid="action-profile_diff">
        {String(context.isActionAvailable("profile_diff"))}
      </span>
      <span data-testid="action-unknown">
        {String(context.isActionAvailable("unknown_action"))}
      </span>
    </div>
  );
}

/**
 * Test consumer for useRunsAggregated hook
 */
function RunsAggregatedConsumer() {
  const [runsAggregated, refetchRunsAggregated] = useRunsAggregated();
  return (
    <div>
      <span data-testid="has-runs">{String(runsAggregated !== undefined)}</span>
      <span data-testid="has-refetch">
        {String(refetchRunsAggregated !== undefined)}
      </span>
      <span data-testid="user-run-data">
        {runsAggregated?.["model.test.users"]?.row_count_diff?.run_id ?? "none"}
      </span>
    </div>
  );
}

/**
 * Test consumer for lineage graph node data
 */
function LineageGraphDataConsumer() {
  const context = useLineageGraphContext();
  const nodeNames = context.lineageGraph
    ? Object.values(context.lineageGraph.nodes).map((n) => n.data.name)
    : [];
  const modifiedSet = context.lineageGraph?.modifiedSet ?? [];
  return (
    <div>
      <span data-testid="node-count">
        {context.lineageGraph
          ? Object.keys(context.lineageGraph.nodes).length
          : 0}
      </span>
      <span data-testid="node-names">{nodeNames.join(",")}</span>
      <span data-testid="modified-count">{modifiedSet.length}</span>
      <span data-testid="modified-set">{modifiedSet.join(",")}</span>
    </div>
  );
}

describe("LineageGraphContext (@datarecce/ui)", () => {
  describe("props-driven behavior", () => {
    it("exposes isLoading=true from props", () => {
      render(
        <LineageGraphProvider isLoading={true} isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("is-loading")).toHaveTextContent("true");
    });

    it("exposes isLoading=false from props", () => {
      render(
        <LineageGraphProvider isLoading={false} isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
    });

    it("exposes isLoading=undefined as undefined", () => {
      render(
        <LineageGraphProvider isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("is-loading")).toHaveTextContent("undefined");
    });
  });

  describe("lineageGraph prop", () => {
    it("exposes lineageGraph data from props", () => {
      const mockGraph = createMockLineageGraph();
      render(
        <LineageGraphProvider lineageGraph={mockGraph} isDemoSite={false}>
          <LineageGraphDataConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("node-count")).toHaveTextContent("2");
      expect(screen.getByTestId("node-names")).toHaveTextContent(
        "users,orders",
      );
      expect(screen.getByTestId("modified-count")).toHaveTextContent("1");
      expect(screen.getByTestId("modified-set")).toHaveTextContent(
        "model.test.users",
      );
    });

    it("handles undefined lineageGraph", () => {
      render(
        <LineageGraphProvider isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-lineage-graph")).toHaveTextContent(
        "false",
      );
    });

    it("handles empty lineageGraph nodes", () => {
      const emptyGraph: LineageGraph = {
        nodes: {},
        edges: {},
        modifiedSet: [],
        manifestMetadata: { base: undefined, current: undefined },
        catalogMetadata: { base: undefined, current: undefined },
      };
      render(
        <LineageGraphProvider lineageGraph={emptyGraph} isDemoSite={false}>
          <LineageGraphDataConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("node-count")).toHaveTextContent("0");
      expect(screen.getByTestId("modified-count")).toHaveTextContent("0");
    });
  });

  describe("error prop", () => {
    it("exposes error message from props", () => {
      render(
        <LineageGraphProvider error="Failed to load lineage" isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("error")).toHaveTextContent(
        "Failed to load lineage",
      );
    });

    it("handles undefined error (no error case)", () => {
      render(
        <LineageGraphProvider isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("error")).toHaveTextContent("none");
    });
  });

  describe("envInfo prop", () => {
    it("exposes envInfo from props", () => {
      const mockEnvInfo = createMockEnvInfo();
      render(
        <LineageGraphProvider envInfo={mockEnvInfo} isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-env-info")).toHaveTextContent("true");
      expect(screen.getByTestId("adapter-type")).toHaveTextContent("dbt");
    });

    it("handles undefined envInfo", () => {
      render(
        <LineageGraphProvider isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-env-info")).toHaveTextContent("false");
      expect(screen.getByTestId("adapter-type")).toHaveTextContent("none");
    });
  });

  describe("mode props", () => {
    it("exposes reviewMode from props", () => {
      render(
        <LineageGraphProvider reviewMode={true} isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("review-mode")).toHaveTextContent("true");
    });

    it("exposes cloudMode from props", () => {
      render(
        <LineageGraphProvider cloudMode={true} isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("cloud-mode")).toHaveTextContent("true");
    });

    it("exposes fileMode and fileName from props", () => {
      render(
        <LineageGraphProvider
          fileMode={true}
          fileName="test_state.json"
          isDemoSite={false}
        >
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("file-mode")).toHaveTextContent("true");
      expect(screen.getByTestId("file-name")).toHaveTextContent(
        "test_state.json",
      );
    });

    it("exposes isDemoSite from props", () => {
      render(
        <LineageGraphProvider isDemoSite={true}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("is-demo-site")).toHaveTextContent("true");
    });

    it("exposes isCodespace from props", () => {
      render(
        <LineageGraphProvider isCodespace={true} isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("is-codespace")).toHaveTextContent("true");
    });
  });

  describe("callback props", () => {
    it("exposes onRefetchLineageGraph callback via retchLineageGraph", () => {
      const mockRefetch = jest.fn();
      render(
        <LineageGraphProvider
          onRefetchLineageGraph={mockRefetch}
          isDemoSite={false}
        >
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-refetch")).toHaveTextContent("true");
    });

    it("handles undefined onRefetchLineageGraph", () => {
      render(
        <LineageGraphProvider isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-refetch")).toHaveTextContent("false");
    });

    it("exposes onRefetchRunsAggregated callback", () => {
      const mockRefetch = jest.fn();
      render(
        <LineageGraphProvider
          onRefetchRunsAggregated={mockRefetch}
          isDemoSite={false}
        >
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-refetch-runs")).toHaveTextContent("true");
    });
  });

  describe("runsAggregated prop", () => {
    it("exposes runsAggregated from props", () => {
      const mockRuns = createMockRunsAggregated();
      render(
        <LineageGraphProvider runsAggregated={mockRuns} isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-runs-aggregated")).toHaveTextContent(
        "true",
      );
    });

    it("handles undefined runsAggregated", () => {
      render(
        <LineageGraphProvider isDemoSite={false}>
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-runs-aggregated")).toHaveTextContent(
        "false",
      );
    });
  });

  describe("isActionAvailable functionality", () => {
    it("returns true for all actions when supportTasks is not provided", () => {
      render(
        <LineageGraphProvider isDemoSite={false}>
          <ActionAvailabilityConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("action-row_count_diff")).toHaveTextContent(
        "true",
      );
      expect(screen.getByTestId("action-profile_diff")).toHaveTextContent(
        "true",
      );
      expect(screen.getByTestId("action-unknown")).toHaveTextContent("true");
    });

    it("returns correct availability based on supportTasks", () => {
      const supportTasks = {
        row_count_diff: true,
        profile_diff: false,
      };
      render(
        <LineageGraphProvider supportTasks={supportTasks} isDemoSite={false}>
          <ActionAvailabilityConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("action-row_count_diff")).toHaveTextContent(
        "true",
      );
      expect(screen.getByTestId("action-profile_diff")).toHaveTextContent(
        "false",
      );
    });

    it("defaults to true for unknown actions when supportTasks is provided", () => {
      const supportTasks = {
        row_count_diff: true,
      };
      render(
        <LineageGraphProvider supportTasks={supportTasks} isDemoSite={false}>
          <ActionAvailabilityConsumer />
        </LineageGraphProvider>,
      );

      // Unknown action should default to true
      expect(screen.getByTestId("action-unknown")).toHaveTextContent("true");
    });
  });

  describe("useRunsAggregated hook", () => {
    it("returns runsAggregated and refetch function from context", () => {
      const mockRuns = createMockRunsAggregated();
      const mockRefetch = jest.fn();
      render(
        <LineageGraphProvider
          runsAggregated={mockRuns}
          onRefetchRunsAggregated={mockRefetch}
          isDemoSite={false}
        >
          <RunsAggregatedConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-runs")).toHaveTextContent("true");
      expect(screen.getByTestId("has-refetch")).toHaveTextContent("true");
      expect(screen.getByTestId("user-run-data")).toHaveTextContent("run-1");
    });

    it("returns undefined when runsAggregated is not provided", () => {
      render(
        <LineageGraphProvider isDemoSite={false}>
          <RunsAggregatedConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-runs")).toHaveTextContent("false");
      expect(screen.getByTestId("has-refetch")).toHaveTextContent("false");
      expect(screen.getByTestId("user-run-data")).toHaveTextContent("none");
    });
  });

  describe("default context (outside provider)", () => {
    it("useLineageGraphContext returns default values outside provider", () => {
      // Note: Unlike some contexts that throw, this one returns a default context
      render(<TestConsumer />);

      // Default context should have isActionAvailable returning true
      // and isDemoSite as false
      expect(screen.getByTestId("is-demo-site")).toHaveTextContent("false");
      expect(screen.getByTestId("has-lineage-graph")).toHaveTextContent(
        "false",
      );
    });

    it("useRunsAggregated returns undefined tuple outside provider", () => {
      render(<RunsAggregatedConsumer />);

      expect(screen.getByTestId("has-runs")).toHaveTextContent("false");
      expect(screen.getByTestId("has-refetch")).toHaveTextContent("false");
    });
  });

  describe("context value stability", () => {
    it("memoizes context value based on props", () => {
      const mockGraph = createMockLineageGraph();
      const mockRefetch = jest.fn();

      let firstContext: ReturnType<typeof useLineageGraphContext> | null = null;
      let secondContext: ReturnType<typeof useLineageGraphContext> | null =
        null;

      function ContextCapture() {
        const context = useLineageGraphContext();
        if (!firstContext) {
          firstContext = context;
        } else {
          secondContext = context;
        }
        return null;
      }

      const { rerender } = render(
        <LineageGraphProvider
          lineageGraph={mockGraph}
          onRefetchLineageGraph={mockRefetch}
          isDemoSite={false}
        >
          <ContextCapture />
        </LineageGraphProvider>,
      );

      // Re-render with same props
      rerender(
        <LineageGraphProvider
          lineageGraph={mockGraph}
          onRefetchLineageGraph={mockRefetch}
          isDemoSite={false}
        >
          <ContextCapture />
        </LineageGraphProvider>,
      );

      // Context value should be stable (same object reference)
      // when props don't change
      expect(secondContext).toBe(firstContext);
    });

    it("updates context value when props change", () => {
      const contextValues: ReturnType<typeof useLineageGraphContext>[] = [];

      function ContextCapture() {
        const context = useLineageGraphContext();
        contextValues.push(context);
        return null;
      }

      const { rerender } = render(
        <LineageGraphProvider isLoading={true} isDemoSite={false}>
          <ContextCapture />
        </LineageGraphProvider>,
      );

      rerender(
        <LineageGraphProvider isLoading={false} isDemoSite={false}>
          <ContextCapture />
        </LineageGraphProvider>,
      );

      // Context values should differ when props change
      expect(contextValues[0]?.isLoading).toBe(true);
      expect(contextValues[1]?.isLoading).toBe(false);
    });

    it("isActionAvailable function is stable across re-renders with same supportTasks", () => {
      const supportTasks = { row_count_diff: true };
      let firstFn: ((name: string) => boolean) | null = null;
      let secondFn: ((name: string) => boolean) | null = null;

      function FnCapture() {
        const context = useLineageGraphContext();
        if (!firstFn) {
          firstFn = context.isActionAvailable;
        } else {
          secondFn = context.isActionAvailable;
        }
        return null;
      }

      const { rerender } = render(
        <LineageGraphProvider supportTasks={supportTasks} isDemoSite={false}>
          <FnCapture />
        </LineageGraphProvider>,
      );

      rerender(
        <LineageGraphProvider supportTasks={supportTasks} isDemoSite={false}>
          <FnCapture />
        </LineageGraphProvider>,
      );

      // Function should be stable
      expect(secondFn).toBe(firstFn);
    });
  });

  describe("combined props scenarios", () => {
    it("handles full configuration with all props", () => {
      const mockGraph = createMockLineageGraph();
      const mockEnvInfo = createMockEnvInfo();
      const mockRuns = createMockRunsAggregated();
      const mockRefetch = jest.fn();
      const mockRefetchRuns = jest.fn();

      render(
        <LineageGraphProvider
          lineageGraph={mockGraph}
          envInfo={mockEnvInfo}
          reviewMode={true}
          cloudMode={true}
          fileMode={false}
          fileName="state.json"
          isDemoSite={false}
          isCodespace={true}
          isLoading={false}
          error={undefined}
          supportTasks={{ row_count_diff: true }}
          onRefetchLineageGraph={mockRefetch}
          runsAggregated={mockRuns}
          onRefetchRunsAggregated={mockRefetchRuns}
        >
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("has-lineage-graph")).toHaveTextContent("true");
      expect(screen.getByTestId("has-env-info")).toHaveTextContent("true");
      expect(screen.getByTestId("review-mode")).toHaveTextContent("true");
      expect(screen.getByTestId("cloud-mode")).toHaveTextContent("true");
      expect(screen.getByTestId("file-mode")).toHaveTextContent("false");
      expect(screen.getByTestId("is-codespace")).toHaveTextContent("true");
      expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      expect(screen.getByTestId("error")).toHaveTextContent("none");
      expect(screen.getByTestId("has-refetch")).toHaveTextContent("true");
      expect(screen.getByTestId("has-runs-aggregated")).toHaveTextContent(
        "true",
      );
      expect(screen.getByTestId("has-refetch-runs")).toHaveTextContent("true");
    });

    it("handles loading state with error", () => {
      render(
        <LineageGraphProvider
          isLoading={false}
          error="Connection failed"
          isDemoSite={false}
        >
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Connection failed",
      );
      expect(screen.getByTestId("has-lineage-graph")).toHaveTextContent(
        "false",
      );
    });

    it("handles file mode configuration", () => {
      render(
        <LineageGraphProvider
          fileMode={true}
          fileName="exported_state.json"
          reviewMode={true}
          isDemoSite={false}
        >
          <TestConsumer />
        </LineageGraphProvider>,
      );

      expect(screen.getByTestId("file-mode")).toHaveTextContent("true");
      expect(screen.getByTestId("file-name")).toHaveTextContent(
        "exported_state.json",
      );
      expect(screen.getByTestId("review-mode")).toHaveTextContent("true");
    });
  });
});
