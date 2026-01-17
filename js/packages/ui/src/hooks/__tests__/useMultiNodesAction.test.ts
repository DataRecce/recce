/**
 * @file useMultiNodesAction.test.ts
 * @description Comprehensive tests for useMultiNodesAction hook from @datarecce/ui
 *
 * Tests verify:
 * - Initialization with correct default actionState
 * - runRowCount behavior (multi_nodes mode, skips non-models)
 * - runRowCountDiff behavior (multi_nodes mode, skips non-models)
 * - runValueDiff behavior (per_node mode, skips nodes without primary_key)
 * - addLineageDiffCheck and addSchemaDiffCheck API calls
 * - cancel functionality (status transitions, cancelRun API call)
 * - reset functionality (restores initial state)
 * - Error handling (graceful handling without throwing)
 * - Callback invocations (onActionStarted, onActionNodeUpdated, onActionCompleted)
 * - Tracking callback invocations
 */

import type React from "react";
import { vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock ApiClient
const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Mock providers module
vi.mock("../../providers", () => ({
  useApiClient: vi.fn(() => mockApiClient),
}));

// Mock action context
const mockShowRunId = vi.fn();
vi.mock("../../contexts/action", () => ({
  useRecceActionContext: vi.fn(() => ({
    showRunId: mockShowRunId,
  })),
}));

// Mock API functions
const mockSubmitRun = vi.fn();
const mockWaitRun = vi.fn();
const mockCancelRun = vi.fn();
const mockCreateLineageDiffCheck = vi.fn();
const mockCreateSchemaDiffCheck = vi.fn();

vi.mock("../../api", () => ({
  submitRun: (...args: unknown[]) => mockSubmitRun(...args),
  waitRun: (...args: unknown[]) => mockWaitRun(...args),
  cancelRun: (...args: unknown[]) => mockCancelRun(...args),
  createLineageDiffCheck: (...args: unknown[]) =>
    mockCreateLineageDiffCheck(...args),
  createSchemaDiffCheck: (...args: unknown[]) =>
    mockCreateSchemaDiffCheck(...args),
}));

// ============================================================================
// Imports
// ============================================================================

import { act, renderHook, waitFor } from "@testing-library/react";
import type { LineageGraphNode } from "../../contexts/lineage/types";
import { useMultiNodesAction } from "../useMultiNodesAction";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockNode = (
  overrides: Partial<{
    id: string;
    name: string;
    resourceType: string;
    primary_key: string | undefined;
    hasCurrent: boolean;
  }> = {},
): LineageGraphNode => {
  const id = overrides.id ?? "model.test.test_model";
  const name = overrides.name ?? "test_model";
  const resourceType = overrides.resourceType ?? "model";
  const primary_key = overrides.primary_key ?? "id";
  const hasCurrent = overrides.hasCurrent ?? true;

  return {
    id,
    position: { x: 0, y: 0 },
    type: "lineageGraphNode",
    data: {
      id,
      name,
      from: "both",
      data: {
        base: {
          name,
          resource_type: resourceType,
          primary_key: primary_key,
        },
        current: hasCurrent
          ? {
              name,
              resource_type: resourceType,
              primary_key: primary_key,
            }
          : undefined,
      },
      resourceType,
      parents: {},
      children: {},
    },
  } as LineageGraphNode;
};

const createMockRun = (
  overrides: Partial<{
    run_id: string;
    result: unknown;
    error: string | undefined;
    progress: { percentage?: number };
  }> = {},
) => ({
  run_id: overrides.run_id ?? "test-run-id",
  type: "row_count_diff",
  run_at: new Date().toISOString(),
  result: overrides.result ?? null,
  error: overrides.error ?? undefined,
  progress: overrides.progress ?? undefined,
});

// ============================================================================
// Test Setup
// ============================================================================

describe("useMultiNodesAction", () => {
  const mockOnActionStarted = vi.fn();
  const mockOnActionNodeUpdated = vi.fn();
  const mockOnActionCompleted = vi.fn();
  const mockOnTrackAction = vi.fn();

  const defaultOptions = {
    onActionStarted: mockOnActionStarted,
    onActionNodeUpdated: mockOnActionNodeUpdated,
    onActionCompleted: mockOnActionCompleted,
    onTrackAction: mockOnTrackAction,
    trackingSource: "test_source",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitRun.mockReset();
    mockWaitRun.mockReset();
    mockCancelRun.mockReset();
    mockCreateLineageDiffCheck.mockReset();
    mockCreateSchemaDiffCheck.mockReset();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe("initialization", () => {
    it("returns initial actionState with status pending", () => {
      const nodes = [createMockNode()];
      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      expect(result.current.actionState).toEqual({
        mode: "per_node",
        status: "pending",
        completed: 0,
        total: 0,
        actions: {},
      });
    });

    it("returns all action functions", () => {
      const nodes = [createMockNode()];
      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      expect(result.current.runRowCount).toBeDefined();
      expect(result.current.runRowCountDiff).toBeDefined();
      expect(result.current.runValueDiff).toBeDefined();
      expect(result.current.addLineageDiffCheck).toBeDefined();
      expect(result.current.addSchemaDiffCheck).toBeDefined();
      expect(result.current.cancel).toBeDefined();
      expect(result.current.reset).toBeDefined();
    });

    it("returns same actionState reference across renders", () => {
      const nodes = [createMockNode()];
      const { result, rerender } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      const firstActionState = result.current.actionState;
      rerender();
      const secondActionState = result.current.actionState;

      expect(firstActionState).toBe(secondActionState);
    });
  });

  // ==========================================================================
  // runRowCount Tests
  // ==========================================================================

  describe("runRowCount", () => {
    it("calls onActionStarted when starting", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(mockOnActionStarted).toHaveBeenCalledTimes(1);
    });

    it("calls onTrackAction with row_count action", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(mockOnTrackAction).toHaveBeenCalledWith({
        action: "row_count",
        source: "test_source",
        node_count: 1,
      });
    });

    it("skips non-model nodes with 'Not a model' reason", async () => {
      const sourceNode = createMockNode({
        id: "source.test.source_node",
        name: "source_node",
        resourceType: "source",
      });
      const modelNode = createMockNode();

      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction([sourceNode, modelNode], defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(result.current.actionState.actions[sourceNode.id]).toEqual({
        mode: "multi_nodes",
        status: "skipped",
        skipReason: "Not a model",
      });
    });

    it("calls submitRun with correct params for model nodes", async () => {
      const node1 = createMockNode({ id: "model.test.model1", name: "model1" });
      const node2 = createMockNode({ id: "model.test.model2", name: "model2" });

      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction([node1, node2], defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(mockSubmitRun).toHaveBeenCalledWith(
        "row_count",
        { node_names: ["model1", "model2"] },
        { nowait: true },
        mockApiClient,
      );
    });

    it("updates actionState status through running to completed", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(result.current.actionState.status).toBe("completed");
    });

    it("calls onActionNodeUpdated for each node", async () => {
      const node1 = createMockNode({ id: "model.test.model1" });
      const node2 = createMockNode({ id: "model.test.model2" });

      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction([node1, node2], defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      // Should be called for each node when updating status
      expect(mockOnActionNodeUpdated).toHaveBeenCalled();
    });

    it("calls onActionCompleted when done", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(mockOnActionCompleted).toHaveBeenCalledTimes(1);
    });

    it("sets mode to multi_nodes", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(result.current.actionState.mode).toBe("multi_nodes");
    });

    it("calls showRunId with the run_id", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "my-run-123" });
      mockWaitRun.mockResolvedValue(
        createMockRun({ run_id: "my-run-123", result: { total: 100 } }),
      );

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(mockShowRunId).toHaveBeenCalledWith("my-run-123");
    });
  });

  // ==========================================================================
  // runRowCountDiff Tests
  // ==========================================================================

  describe("runRowCountDiff", () => {
    it("calls submitRun with row_count_diff type", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { diff: 10 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCountDiff();
      });

      expect(mockSubmitRun).toHaveBeenCalledWith(
        "row_count_diff",
        expect.any(Object),
        { nowait: true },
        mockApiClient,
      );
    });

    it("calls onTrackAction with row_count_diff action", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { diff: 10 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCountDiff();
      });

      expect(mockOnTrackAction).toHaveBeenCalledWith({
        action: "row_count_diff",
        source: "test_source",
        node_count: 1,
      });
    });

    it("skips non-model nodes with 'Not a model' reason", async () => {
      const seedNode = createMockNode({
        id: "seed.test.seed_node",
        name: "seed_node",
        resourceType: "seed",
      });

      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { diff: 10 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction([seedNode], defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCountDiff();
      });

      expect(result.current.actionState.actions[seedNode.id]).toEqual({
        mode: "multi_nodes",
        status: "skipped",
        skipReason: "Not a model",
      });
    });

    it("handles failure status from run error", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(
        createMockRun({ error: "Database connection failed" }),
      );

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCountDiff();
      });

      expect(result.current.actionState.actions[nodes[0].id].status).toBe(
        "failure",
      );
    });
  });

  // ==========================================================================
  // runValueDiff Tests
  // ==========================================================================

  describe("runValueDiff", () => {
    it("runs in per_node mode (sequential)", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { diff: [] } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runValueDiff();
      });

      expect(result.current.actionState.mode).toBe("per_node");
    });

    it("calls onTrackAction with value_diff action", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { diff: [] } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runValueDiff();
      });

      expect(mockOnTrackAction).toHaveBeenCalledWith({
        action: "value_diff",
        source: "test_source",
        node_count: 1,
      });
    });

    it("skips nodes without primary_key", async () => {
      // Create a node where current.primary_key is undefined
      const nodeWithoutPK: LineageGraphNode = {
        id: "model.test.no_pk",
        position: { x: 0, y: 0 },
        type: "lineageGraphNode",
        data: {
          id: "model.test.no_pk",
          name: "no_pk",
          from: "both",
          data: {
            base: {
              name: "no_pk",
              resource_type: "model",
              primary_key: undefined,
            },
            current: {
              name: "no_pk",
              resource_type: "model",
              primary_key: undefined, // No primary key
            },
          },
          resourceType: "model",
          parents: {},
          children: {},
        },
      } as LineageGraphNode;

      const { result } = renderHook(() =>
        useMultiNodesAction([nodeWithoutPK], defaultOptions),
      );

      await act(async () => {
        await result.current.runValueDiff();
      });

      expect(result.current.actionState.actions[nodeWithoutPK.id]).toEqual({
        mode: "per_node",
        status: "skipped",
        skipReason:
          "No primary key found. The first unique column is used as primary key.",
      });
    });

    it("calls submitRun with value_diff type and correct params", async () => {
      const node = createMockNode({
        id: "model.test.my_model",
        name: "my_model",
        primary_key: "user_id",
      });
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { diff: [] } }));

      const { result } = renderHook(() =>
        useMultiNodesAction([node], defaultOptions),
      );

      await act(async () => {
        await result.current.runValueDiff();
      });

      expect(mockSubmitRun).toHaveBeenCalledWith(
        "value_diff",
        { model: "my_model", primary_key: "user_id" },
        { nowait: true },
        mockApiClient,
      );
    });

    it("processes nodes sequentially", async () => {
      const node1 = createMockNode({ id: "model.test.model1", name: "model1" });
      const node2 = createMockNode({ id: "model.test.model2", name: "model2" });

      let submitCallCount = 0;
      mockSubmitRun.mockImplementation(() => {
        submitCallCount++;
        return Promise.resolve({ run_id: `run-${submitCallCount}` });
      });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { diff: [] } }));

      const { result } = renderHook(() =>
        useMultiNodesAction([node1, node2], defaultOptions),
      );

      await act(async () => {
        await result.current.runValueDiff();
      });

      // Should have been called twice, once for each node
      expect(mockSubmitRun).toHaveBeenCalledTimes(2);
    });

    it("updates total to number of nodes", async () => {
      const node1 = createMockNode({ id: "model.test.model1" });
      const node2 = createMockNode({ id: "model.test.model2" });

      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { diff: [] } }));

      const { result } = renderHook(() =>
        useMultiNodesAction([node1, node2], defaultOptions),
      );

      await act(async () => {
        await result.current.runValueDiff();
      });

      expect(result.current.actionState.total).toBe(2);
    });
  });

  // ==========================================================================
  // addLineageDiffCheck Tests
  // ==========================================================================

  describe("addLineageDiffCheck", () => {
    it("calls createLineageDiffCheck with node_ids", async () => {
      const node1 = createMockNode({ id: "model.test.model1" });
      const node2 = createMockNode({ id: "model.test.model2" });
      mockCreateLineageDiffCheck.mockResolvedValue({ check_id: "check-123" });

      const { result } = renderHook(() =>
        useMultiNodesAction([node1, node2], defaultOptions),
      );

      await act(async () => {
        await result.current.addLineageDiffCheck();
      });

      expect(mockCreateLineageDiffCheck).toHaveBeenCalledWith(
        { node_ids: ["model.test.model1", "model.test.model2"] },
        mockApiClient,
      );
    });

    it("returns the check result", async () => {
      const nodes = [createMockNode()];
      const expectedCheck = { check_id: "check-456", type: "lineage_diff" };
      mockCreateLineageDiffCheck.mockResolvedValue(expectedCheck);

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      let checkResult;
      await act(async () => {
        checkResult = await result.current.addLineageDiffCheck();
      });

      expect(checkResult).toEqual(expectedCheck);
    });
  });

  // ==========================================================================
  // addSchemaDiffCheck Tests
  // ==========================================================================

  describe("addSchemaDiffCheck", () => {
    it("calls createSchemaDiffCheck with single node_id for one node", async () => {
      const node = createMockNode({ id: "model.test.single_model" });
      mockCreateSchemaDiffCheck.mockResolvedValue({ check_id: "check-123" });

      const { result } = renderHook(() =>
        useMultiNodesAction([node], defaultOptions),
      );

      await act(async () => {
        await result.current.addSchemaDiffCheck();
      });

      expect(mockCreateSchemaDiffCheck).toHaveBeenCalledWith(
        { node_id: "model.test.single_model" },
        mockApiClient,
      );
    });

    it("calls createSchemaDiffCheck with array of node_ids for multiple nodes", async () => {
      const node1 = createMockNode({ id: "model.test.model1" });
      const node2 = createMockNode({ id: "model.test.model2" });
      mockCreateSchemaDiffCheck.mockResolvedValue({ check_id: "check-123" });

      const { result } = renderHook(() =>
        useMultiNodesAction([node1, node2], defaultOptions),
      );

      await act(async () => {
        await result.current.addSchemaDiffCheck();
      });

      expect(mockCreateSchemaDiffCheck).toHaveBeenCalledWith(
        { node_id: ["model.test.model1", "model.test.model2"] },
        mockApiClient,
      );
    });
  });

  // ==========================================================================
  // Cancel Tests
  // ==========================================================================

  describe("cancel", () => {
    it("sets status to canceling", async () => {
      const nodes = [createMockNode()];

      // Set up a long-running operation
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      let resolveWait!: (value: unknown) => void;
      const waitPromise = new Promise((resolve) => {
        resolveWait = resolve;
      });
      mockWaitRun.mockReturnValue(waitPromise);

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      // Start the operation but don't await it
      act(() => {
        result.current.runRowCount();
      });

      // Wait for the run to start
      await waitFor(() => {
        expect(result.current.actionState.status).toBe("running");
      });

      // Cancel while running
      await act(async () => {
        await result.current.cancel();
      });

      expect(result.current.actionState.status).toBe("canceling");

      // Clean up: resolve the wait promise
      resolveWait?.(createMockRun({ result: {} }));
    });

    it("calls cancelRun with current run_id", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "run-to-cancel" });
      let resolveWait!: (value: unknown) => void;
      const waitPromise = new Promise((resolve) => {
        resolveWait = resolve;
      });
      mockWaitRun.mockReturnValue(waitPromise);
      mockCancelRun.mockResolvedValue({});

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      // Start the operation
      act(() => {
        result.current.runRowCount();
      });

      // Wait for the run to start
      await waitFor(() => {
        expect(result.current.actionState.currentRun?.run_id).toBe(
          "run-to-cancel",
        );
      });

      // Cancel
      await act(async () => {
        await result.current.cancel();
      });

      expect(mockCancelRun).toHaveBeenCalledWith(
        "run-to-cancel",
        mockApiClient,
      );

      // Clean up
      resolveWait?.(createMockRun({ result: {} }));
    });

    it("transitions to canceled status after operation completes", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      let resolveWait!: (value: unknown) => void;
      const waitPromise = new Promise((resolve) => {
        resolveWait = resolve;
      });
      mockWaitRun.mockReturnValue(waitPromise);
      mockCancelRun.mockResolvedValue({});

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      // Start the operation
      let runPromise: Promise<void>;
      act(() => {
        runPromise = result.current.runRowCount();
      });

      // Wait for running state
      await waitFor(() => {
        expect(result.current.actionState.status).toBe("running");
      });

      // Cancel
      await act(async () => {
        await result.current.cancel();
      });

      // Resolve the wait to complete the operation
      act(() => {
        resolveWait?.(createMockRun({ result: {} }));
      });

      await act(async () => {
        await runPromise;
      });

      expect(result.current.actionState.status).toBe("canceled");
    });

    it("does not call cancelRun if no currentRun", async () => {
      const nodes = [createMockNode()];

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.cancel();
      });

      expect(mockCancelRun).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Reset Tests
  // ==========================================================================

  describe("reset", () => {
    it("resets core actionState properties to initial values", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      // Run an action to change state
      await act(async () => {
        await result.current.runRowCount();
      });

      expect(result.current.actionState.status).toBe("completed");
      expect(result.current.actionState.mode).toBe("multi_nodes");

      // Reset
      act(() => {
        result.current.reset();
      });

      // Core properties from initValue are reset
      expect(result.current.actionState.mode).toBe("per_node");
      expect(result.current.actionState.status).toBe("pending");
      expect(result.current.actionState.completed).toBe(0);
      expect(result.current.actionState.total).toBe(0);
    });

    it("allows running a new action after reset", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      // Run first action
      await act(async () => {
        await result.current.runRowCount();
      });

      expect(result.current.actionState.status).toBe("completed");

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.actionState.status).toBe("pending");

      // Run second action
      await act(async () => {
        await result.current.runRowCountDiff();
      });

      expect(result.current.actionState.status).toBe("completed");
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe("error handling", () => {
    it("handles submitRun failures gracefully", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      // Should not throw
      await act(async () => {
        await result.current.runRowCount();
      });

      expect(result.current.actionState.status).toBe("completed");
    });

    it("handles waitRun failures gracefully", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockRejectedValue(new Error("Timeout"));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      // Should not throw
      await act(async () => {
        await result.current.runRowCount();
      });

      expect(result.current.actionState.status).toBe("completed");
    });

    it("continues to call onActionCompleted even on error", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockRejectedValue(new Error("API error"));

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(mockOnActionCompleted).toHaveBeenCalled();
    });

    it("handles per_node mode errors without stopping other nodes", async () => {
      const node1 = createMockNode({ id: "model.test.model1", name: "model1" });
      const node2 = createMockNode({ id: "model.test.model2", name: "model2" });

      let callCount = 0;
      mockSubmitRun.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("First node failed"));
        }
        return Promise.resolve({ run_id: "run-2" });
      });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { diff: [] } }));

      const { result } = renderHook(() =>
        useMultiNodesAction([node1, node2], defaultOptions),
      );

      await act(async () => {
        await result.current.runValueDiff();
      });

      // Should have tried both nodes
      expect(mockSubmitRun).toHaveBeenCalledTimes(2);
      expect(result.current.actionState.status).toBe("completed");
    });
  });

  // ==========================================================================
  // Polling Behavior Tests
  // ==========================================================================

  describe("polling behavior", () => {
    it("polls waitRun until result is available", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });

      let pollCount = 0;
      mockWaitRun.mockImplementation(() => {
        pollCount++;
        if (pollCount < 3) {
          // Return running state (no result, no error)
          return Promise.resolve(createMockRun({ result: null }));
        }
        // Return completed state
        return Promise.resolve(createMockRun({ result: { total: 100 } }));
      });

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(pollCount).toBe(3);
      expect(result.current.actionState.status).toBe("completed");
    });

    it("stops polling when error is received", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });

      let pollCount = 0;
      mockWaitRun.mockImplementation(() => {
        pollCount++;
        if (pollCount < 2) {
          return Promise.resolve(createMockRun({ result: null }));
        }
        return Promise.resolve(
          createMockRun({ error: "Execution failed", result: null }),
        );
      });

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultOptions),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(pollCount).toBe(2);
    });
  });

  // ==========================================================================
  // Tracking Callback Tests
  // ==========================================================================

  describe("tracking callback", () => {
    it("does not error when onTrackAction is not provided", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const optionsWithoutTracking = {
        onActionStarted: mockOnActionStarted,
        onActionNodeUpdated: mockOnActionNodeUpdated,
        onActionCompleted: mockOnActionCompleted,
        // No onTrackAction
      };

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, optionsWithoutTracking),
      );

      // Should not throw
      await act(async () => {
        await result.current.runRowCount();
      });

      expect(result.current.actionState.status).toBe("completed");
    });

    it("uses default tracking source when not provided", async () => {
      const nodes = [createMockNode()];
      mockSubmitRun.mockResolvedValue({ run_id: "test-run-id" });
      mockWaitRun.mockResolvedValue(createMockRun({ result: { total: 100 } }));

      const optionsWithDefaultSource = {
        onActionStarted: mockOnActionStarted,
        onActionNodeUpdated: mockOnActionNodeUpdated,
        onActionCompleted: mockOnActionCompleted,
        onTrackAction: mockOnTrackAction,
        // No trackingSource - should use default
      };

      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, optionsWithDefaultSource),
      );

      await act(async () => {
        await result.current.runRowCount();
      });

      expect(mockOnTrackAction).toHaveBeenCalledWith({
        action: "row_count",
        source: "lineage_view_top_bar", // Default value
        node_count: 1,
      });
    });
  });
});
