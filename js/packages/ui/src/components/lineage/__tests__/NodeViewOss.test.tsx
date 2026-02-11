/**
 * @file NodeViewOss.test.tsx
 * @description Tests for NodeViewOss component - specifically the
 * onAddSchemaDiffClick callback that must invalidate checks cache.
 */

import { type Mock, vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

const mockCreateSchemaDiffCheck = vi.fn();
const mockCacheKeysChecks = vi.fn(() => ["checks", "list"]);

vi.mock("../../../api", () => ({
  cacheKeys: { checks: () => mockCacheKeysChecks() },
  createSchemaDiffCheck: (...args: unknown[]) =>
    mockCreateSchemaDiffCheck(...args),
}));

vi.mock("../../../contexts", () => ({
  useLineageGraphContext: vi.fn(() => ({
    isActionAvailable: () => true,
    envInfo: { adapterType: "dbt" },
  })),
  useRecceActionContext: vi.fn(() => ({
    runAction: vi.fn(),
  })),
  useRecceInstanceContext: vi.fn(() => ({
    singleEnv: false,
    featureToggles: { disableDatabaseQuery: false },
  })),
  useRouteConfig: vi.fn(() => ({ basePath: "" })),
}));

vi.mock("../../../hooks", () => ({
  useApiConfig: vi.fn(() => ({ apiClient: {} })),
  useIsDark: vi.fn(() => false),
  useModelColumns: vi.fn(() => ({ primaryKey: undefined })),
  useRecceQueryContext: vi.fn(() => ({
    setSqlQuery: vi.fn(),
    setPrimaryKeys: vi.fn(),
  })),
}));

// Mock the base NodeView to expose action callbacks
let capturedActionCallbacks: Record<string, (...args: unknown[]) => unknown> =
  {};
vi.mock("../NodeView", () => ({
  NodeView: vi.fn(
    (props: { actionCallbacks?: typeof capturedActionCallbacks }) => {
      capturedActionCallbacks = props.actionCallbacks ?? {};
      return <div data-testid="node-view" />;
    },
  ),
}));

// Mock sub-components used by NodeViewOss
vi.mock("../NodeSqlViewOss", () => ({
  NodeSqlViewOss: vi.fn(() => null),
}));
vi.mock("../SandboxViewOss", () => ({
  SandboxViewOss: vi.fn(() => null),
}));
vi.mock("../NodeTag", () => ({
  RowCountDiffTag: vi.fn(() => null),
  RowCountTag: vi.fn(() => null),
}));
vi.mock("../tags", () => ({
  ResourceTypeTag: vi.fn(() => null),
}));
vi.mock("../../schema", () => ({
  SchemaView: vi.fn(() => null),
  SingleEnvSchemaView: vi.fn(() => null),
}));
vi.mock("../../run", () => ({
  findByRunType: vi.fn(() => ({ icon: vi.fn(() => null) })),
}));
vi.mock("../../app", () => ({
  SetupConnectionPopover: vi.fn(
    ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ),
}));
vi.mock("../../onboarding-guide", () => ({
  LearnHowLink: vi.fn(() => null),
  RecceNotification: vi.fn(() => null),
}));
vi.mock("../../../utils", () => ({
  formatSelectColumns: vi.fn(() => []),
}));
vi.mock("../../../lib/api/track", () => ({
  EXPLORE_ACTION: {},
  EXPLORE_SOURCE: {},
  trackExploreAction: vi.fn(),
  trackPreviewChange: vi.fn(),
}));

// ============================================================================
// Imports
// ============================================================================

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { act } from "react";
import type { LineageGraphNode } from "../../..";
import { NodeViewOss } from "../NodeViewOss";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockNode = (): LineageGraphNode =>
  ({
    id: "model.test.users",
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id: "model.test.users",
      name: "users",
      from: "both",
      resourceType: "model",
      data: {
        base: { columns: {} },
        current: { columns: {} },
      },
      parents: {},
      children: {},
    },
  }) as unknown as LineageGraphNode;

// ============================================================================
// Tests
// ============================================================================

describe("NodeViewOss", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedActionCallbacks = {};
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  function renderWithProviders(node: LineageGraphNode) {
    return render(
      <QueryClientProvider client={queryClient}>
        <NodeViewOss node={node} onCloseNode={vi.fn()} />
      </QueryClientProvider>,
    );
  }

  describe("onAddSchemaDiffClick", () => {
    it("invalidates checks cache and navigates after creating schema diff check", async () => {
      const mockCheck = { check_id: "test-check-123" };
      mockCreateSchemaDiffCheck.mockResolvedValue(mockCheck);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderWithProviders(createMockNode());

      // The base NodeView receives actionCallbacks - invoke onAddSchemaDiffClick
      expect(capturedActionCallbacks.onAddSchemaDiffClick).toBeDefined();

      await act(async () => {
        await capturedActionCallbacks.onAddSchemaDiffClick();
      });

      // Verify createSchemaDiffCheck was called with the node id
      expect(mockCreateSchemaDiffCheck).toHaveBeenCalledWith(
        { node_id: "model.test.users" },
        expect.anything(),
      );

      // Verify checks cache was invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["checks", "list"],
      });

      // Verify navigation
      const mockRouter = global.mockNextNavigation.getRouter();
      expect(mockRouter.push).toHaveBeenCalledWith(
        "/checks/?id=test-check-123",
      );
    });

    it("invalidates cache before navigating", async () => {
      const callOrder: string[] = [];

      mockCreateSchemaDiffCheck.mockResolvedValue({
        check_id: "test-check-456",
      });

      vi.spyOn(queryClient, "invalidateQueries").mockImplementation(
        async () => {
          callOrder.push("invalidate");
        },
      );

      const mockRouter = global.mockNextNavigation.getRouter();
      (mockRouter.push as Mock).mockImplementation(() => {
        callOrder.push("navigate");
      });

      renderWithProviders(createMockNode());

      await act(async () => {
        await capturedActionCallbacks.onAddSchemaDiffClick();
      });

      // Cache invalidation must happen before navigation
      expect(callOrder).toEqual(["invalidate", "navigate"]);
    });
  });
});
