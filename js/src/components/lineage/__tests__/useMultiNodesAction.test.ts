/**
 * @file useMultiNodesAction.test.ts
 * @description Tests for the OSS wrapper of useMultiNodesAction hook
 *
 * This file tests the thin OSS wrapper that provides:
 * - Amplitude tracking integration for explore actions
 * - Mapping from generic action types to OSS-specific EXPLORE_ACTION constants
 *
 * The base hook functionality is tested comprehensively in:
 * packages/ui/src/hooks/__tests__/useMultiNodesAction.test.ts
 */

import { type MockedFunction, vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @datarecce/ui base hook
const mockActionState = {
  mode: "per_node" as const,
  status: "pending" as const,
  completed: 0,
  total: 0,
  actions: {},
};

const mockRunRowCount = vi.fn();
const mockRunRowCountDiff = vi.fn();
const mockRunValueDiff = vi.fn();
const mockAddLineageDiffCheck = vi.fn();
const mockAddSchemaDiffCheck = vi.fn();
const mockCancel = vi.fn();
const mockReset = vi.fn();

// Capture the options passed to the base hook
let capturedOptions: {
  onActionStarted?: () => void;
  onActionNodeUpdated?: (node: unknown) => void;
  onActionCompleted?: () => void;
  onTrackAction?: (props: unknown) => void;
  trackingSource?: string;
} = {};

vi.mock("@datarecce/ui/hooks/useMultiNodesAction", () => ({
  useMultiNodesAction: vi.fn((nodes, options) => {
    capturedOptions = options;
    return {
      actionState: mockActionState,
      runRowCount: mockRunRowCount,
      runRowCountDiff: mockRunRowCountDiff,
      runValueDiff: mockRunValueDiff,
      addLineageDiffCheck: mockAddLineageDiffCheck,
      addSchemaDiffCheck: mockAddSchemaDiffCheck,
      cancel: mockCancel,
      reset: mockReset,
    };
  }),
}));

// Mock tracking functions
vi.mock("@datarecce/ui/lib/api/track", () => ({
  trackExploreAction: vi.fn(),
  EXPLORE_ACTION: {
    ROW_COUNT: "row_count",
    ROW_COUNT_DIFF: "row_count_diff",
    VALUE_DIFF: "value_diff",
  },
  EXPLORE_SOURCE: {
    LINEAGE_VIEW_TOP_BAR: "lineage_view_top_bar",
  },
}));

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraphNode } from "@datarecce/ui";
import { useMultiNodesActionOss as useMultiNodesAction } from "@datarecce/ui/hooks/useMultiNodesActionOss";
import {
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  trackExploreAction,
} from "@datarecce/ui/lib/api/track";
import { renderHook } from "@testing-library/react";

// Get the mocked function for assertions
const mockTrackExploreAction = trackExploreAction as MockedFunction<
  typeof trackExploreAction
>;

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockNode = (
  overrides: Partial<{
    id: string;
    name: string;
    resourceType: string;
    primary_key: string | undefined;
  }> = {},
): LineageGraphNode => {
  const id = overrides.id ?? "model.test.test_model";
  const name = overrides.name ?? "test_model";
  const resourceType = overrides.resourceType ?? "model";
  const primary_key = overrides.primary_key ?? "id";

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
        current: {
          name,
          resource_type: resourceType,
          primary_key: primary_key,
        },
      },
      resourceType,
      parents: {},
      children: {},
    },
  } as LineageGraphNode;
};

// ============================================================================
// Tests
// ============================================================================

describe("useMultiNodesAction (OSS wrapper)", () => {
  const mockOnActionStarted = vi.fn();
  const mockOnActionNodeUpdated = vi.fn();
  const mockOnActionCompleted = vi.fn();

  const defaultCallbacks = {
    onActionStarted: mockOnActionStarted,
    onActionNodeUpdated: mockOnActionNodeUpdated,
    onActionCompleted: mockOnActionCompleted,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOptions = {};
  });

  describe("base hook integration", () => {
    it("passes callbacks to the base hook", () => {
      const nodes = [createMockNode()];
      renderHook(() => useMultiNodesAction(nodes, defaultCallbacks));

      expect(capturedOptions.onActionStarted).toBeDefined();
      expect(capturedOptions.onActionNodeUpdated).toBeDefined();
      expect(capturedOptions.onActionCompleted).toBeDefined();
    });

    it("returns the base hook result", () => {
      const nodes = [createMockNode()];
      const { result } = renderHook(() =>
        useMultiNodesAction(nodes, defaultCallbacks),
      );

      expect(result.current.actionState).toBe(mockActionState);
      expect(result.current.runRowCount).toBe(mockRunRowCount);
      expect(result.current.runRowCountDiff).toBe(mockRunRowCountDiff);
      expect(result.current.runValueDiff).toBe(mockRunValueDiff);
      expect(result.current.addLineageDiffCheck).toBe(mockAddLineageDiffCheck);
      expect(result.current.addSchemaDiffCheck).toBe(mockAddSchemaDiffCheck);
      expect(result.current.cancel).toBe(mockCancel);
      expect(result.current.reset).toBe(mockReset);
    });

    it("sets tracking source to LINEAGE_VIEW_TOP_BAR", () => {
      const nodes = [createMockNode()];
      renderHook(() => useMultiNodesAction(nodes, defaultCallbacks));

      expect(capturedOptions.trackingSource).toBe(
        EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
      );
    });
  });

  describe("tracking integration", () => {
    it("provides onTrackAction callback to base hook", () => {
      const nodes = [createMockNode()];
      renderHook(() => useMultiNodesAction(nodes, defaultCallbacks));

      expect(capturedOptions.onTrackAction).toBeDefined();
      expect(typeof capturedOptions.onTrackAction).toBe("function");
    });

    it("maps row_count action to EXPLORE_ACTION.ROW_COUNT", () => {
      const nodes = [createMockNode()];
      renderHook(() => useMultiNodesAction(nodes, defaultCallbacks));

      // Call the onTrackAction with row_count
      capturedOptions.onTrackAction?.({
        action: "row_count",
        source: "test_source",
        node_count: 2,
      });

      expect(mockTrackExploreAction).toHaveBeenCalledWith({
        action: EXPLORE_ACTION.ROW_COUNT,
        source: EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
        node_count: 2,
      });
    });

    it("maps row_count_diff action to EXPLORE_ACTION.ROW_COUNT_DIFF", () => {
      const nodes = [createMockNode()];
      renderHook(() => useMultiNodesAction(nodes, defaultCallbacks));

      capturedOptions.onTrackAction?.({
        action: "row_count_diff",
        source: "test_source",
        node_count: 3,
      });

      expect(mockTrackExploreAction).toHaveBeenCalledWith({
        action: EXPLORE_ACTION.ROW_COUNT_DIFF,
        source: EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
        node_count: 3,
      });
    });

    it("maps value_diff action to EXPLORE_ACTION.VALUE_DIFF", () => {
      const nodes = [createMockNode()];
      renderHook(() => useMultiNodesAction(nodes, defaultCallbacks));

      capturedOptions.onTrackAction?.({
        action: "value_diff",
        source: "test_source",
        node_count: 1,
      });

      expect(mockTrackExploreAction).toHaveBeenCalledWith({
        action: EXPLORE_ACTION.VALUE_DIFF,
        source: EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
        node_count: 1,
      });
    });
  });
});
