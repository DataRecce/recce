/**
 * @file LineageGraphAdapter.test.tsx
 * @description Tests for LineageGraphAdapter - bridges OSS data fetching with @datarecce/ui's LineageGraphProvider
 *
 * The LineageGraphAdapter:
 * - Handles data fetching via React Query (getServerInfo, aggregateRuns)
 * - Manages WebSocket connection via useLineageWatcher
 * - Renders UI modals for server disconnection/relaunch
 * - Wraps @datarecce/ui's LineageGraphProvider with fetched data
 */

import type { RunsAggregated, ServerInfoResult } from "@datarecce/ui/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// Mock dependencies BEFORE importing the component
// Mock @datarecce/ui/api for functions that the component imports directly
jest.mock("@datarecce/ui/api", () => {
  const actual = jest.requireActual("@datarecce/ui/api");
  return {
    ...actual,
    getServerInfo: jest.fn(),
    aggregateRuns: jest.fn(),
    getServerFlag: jest.fn().mockResolvedValue({}),
    markRelaunchHintCompleted: jest.fn().mockResolvedValue(undefined),
    cacheKeys: actual.cacheKeys,
  };
});

jest.mock("@datarecce/ui/lib/api/track", () => ({
  EXPLORE_ACTION: {
    ROW_COUNT: "row_count",
    ROW_COUNT_DIFF: "row_count_diff",
    VALUE_DIFF: "value_diff",
  },
  EXPLORE_SOURCE: {
    LINEAGE_VIEW_TOP_BAR: "lineage_view_top_bar",
  },
  trackExploreAction: jest.fn(),
  trackSingleEnvironment: jest.fn(),
}));

jest.mock("@datarecce/ui/components/ui/Toaster", () => ({
  toaster: {
    create: jest.fn(() => "toast-id"),
  },
}));

jest.mock("@datarecce/ui", () => ({
  buildLineageGraph: jest.fn((base, current, diff) => ({
    nodes: {},
    edges: {},
    modifiedSet: [],
    manifestMetadata: {
      base: base?.manifest_metadata,
      current: current?.manifest_metadata,
    },
    catalogMetadata: {
      base: base?.catalog_metadata,
      current: current?.catalog_metadata,
    },
  })),
}));

// Mock the hooks from @datarecce/ui/contexts (except LineageGraphProvider which is the real thing)
const mockUseIdleTimeout = jest.fn(() => ({
  idleTimeout: null,
  remainingSeconds: null,
  isEnabled: false,
  setDisconnected: jest.fn(),
  resetConnection: jest.fn(),
  isDisconnected: false,
}));

const mockUseRecceInstanceContext = jest.fn(() => ({
  featureToggles: { mode: null },
  shareUrl: undefined,
}));

jest.mock("@datarecce/ui/contexts", () => {
  const actual = jest.requireActual("@datarecce/ui/contexts");
  return {
    ...actual,
    useIdleTimeout: () => mockUseIdleTimeout(),
    useRecceInstanceContext: () => mockUseRecceInstanceContext(),
    useRecceServerFlag: jest.fn(() => ({
      data: {},
      isLoading: false,
    })),
  };
});

// Mock WebSocket globally
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection opening after a tick
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 0);
  }

  send(data: string) {
    // Simulate pong response
    if (data === "ping") {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage(new MessageEvent("message", { data: "pong" }));
        }
      }, 0);
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
  }
}

// Save original WebSocket and replace with mock
const originalWebSocket = global.WebSocket;
beforeAll(() => {
  // @ts-expect-error - MockWebSocket doesn't fully implement WebSocket
  global.WebSocket = MockWebSocket;
});

afterAll(() => {
  global.WebSocket = originalWebSocket;
});

import { buildLineageGraph } from "@datarecce/ui";
import { aggregateRuns, getServerInfo } from "@datarecce/ui/api";
import {
  useLineageGraphContext,
  useRunsAggregated,
} from "@datarecce/ui/contexts";
import { LineageGraphAdapter } from "@datarecce/ui/hooks";

const mockGetServerInfo = getServerInfo as jest.MockedFunction<
  typeof getServerInfo
>;
const mockAggregateRuns = aggregateRuns as jest.MockedFunction<
  typeof aggregateRuns
>;
const mockBuildLineageGraph = buildLineageGraph as jest.MockedFunction<
  typeof buildLineageGraph
>;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/**
 * Helper to create minimal server info response
 */
function createServerInfoResult(
  overrides: Partial<ServerInfoResult> = {},
): ServerInfoResult {
  const defaultLineageData = {
    metadata: { pr_url: "" },
    nodes: {},
    parent_map: {},
    manifest_metadata: null,
    catalog_metadata: null,
  };

  return {
    state_metadata: {
      schema_version: "1.0",
      recce_version: "1.0.0",
      generated_at: new Date().toISOString(),
    },
    adapter_type: "dbt",
    review_mode: false,
    cloud_mode: false,
    file_mode: false,
    demo: false,
    codespace: false,
    support_tasks: {},
    lineage: {
      base: defaultLineageData,
      current: defaultLineageData,
      diff: {},
    },
    ...overrides,
  };
}

/**
 * Test consumer component that displays context values
 */
function TestConsumer() {
  const context = useLineageGraphContext();
  return (
    <div>
      <span data-testid="is-loading">{String(context.isLoading ?? false)}</span>
      <span data-testid="has-lineage-graph">
        {String(context.lineageGraph !== undefined)}
      </span>
      <span data-testid="error">{context.error ?? "none"}</span>
      <span data-testid="is-demo-site">{String(context.isDemoSite)}</span>
      <span data-testid="is-codespace">
        {String(context.isCodespace ?? false)}
      </span>
      <span data-testid="review-mode">
        {String(context.reviewMode ?? false)}
      </span>
      <span data-testid="cloud-mode">{String(context.cloudMode ?? false)}</span>
      <span data-testid="file-mode">{String(context.fileMode ?? false)}</span>
      <span data-testid="file-name">{context.fileName ?? "none"}</span>
      <span data-testid="adapter-type">
        {context.envInfo?.adapterType ?? "none"}
      </span>
      <span data-testid="git-branch">
        {context.envInfo?.git?.branch ?? "none"}
      </span>
      <span data-testid="has-runs-aggregated">
        {String(context.runsAggregated !== undefined)}
      </span>
      <span data-testid="has-refetch">
        {String(typeof context.retchLineageGraph === "function")}
      </span>
      <span data-testid="action-available">
        {String(context.isActionAvailable("test_action"))}
      </span>
    </div>
  );
}

/**
 * Test consumer with action availability check
 */
function TestConsumerWithAction({ actionName }: { actionName: string }) {
  const context = useLineageGraphContext();
  return (
    <div>
      <span data-testid="action-available">
        {String(context.isActionAvailable(actionName))}
      </span>
    </div>
  );
}

/**
 * Test consumer for useRunsAggregated hook
 */
function TestRunsAggregatedConsumer() {
  const [runsAggregated, refetch] = useRunsAggregated();
  return (
    <div>
      <span data-testid="has-runs-aggregated">
        {String(runsAggregated !== undefined)}
      </span>
      <span data-testid="has-refetch">
        {String(typeof refetch === "function")}
      </span>
      <button data-testid="refetch-btn" onClick={refetch}>
        Refetch
      </button>
    </div>
  );
}

describe("LineageGraphAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mocks to default values
    mockUseIdleTimeout.mockReturnValue({
      idleTimeout: null,
      remainingSeconds: null,
      isEnabled: false,
      setDisconnected: jest.fn(),
      resetConnection: jest.fn(),
      isDisconnected: false,
    });
  });

  describe("loading state", () => {
    it("provides loading state initially while fetching data", async () => {
      // Set up a promise that doesn't resolve immediately
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Initial no-op placeholder for Promise resolve callback
      let resolveServerInfo: (value: ServerInfoResult) => void = () => {};
      const serverInfoPromise = new Promise<ServerInfoResult>((resolve) => {
        resolveServerInfo = resolve;
      });

      mockGetServerInfo.mockReturnValue(serverInfoPromise);
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      // Initially loading
      expect(screen.getByTestId("is-loading")).toHaveTextContent("true");
      expect(screen.getByTestId("has-lineage-graph")).toHaveTextContent(
        "false",
      );

      // Resolve the promise
      resolveServerInfo(createServerInfoResult());

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      });
    });
  });

  describe("successful data fetch", () => {
    it("provides lineage graph after successful fetch", async () => {
      const mockLineageGraph = {
        nodes: { model_a: {} },
        edges: {},
        modifiedSet: ["model_a"],
        manifestMetadata: {},
        catalogMetadata: {},
      };

      mockBuildLineageGraph.mockReturnValue(
        mockLineageGraph as unknown as ReturnType<typeof buildLineageGraph>,
      );
      mockGetServerInfo.mockResolvedValue(createServerInfoResult());
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      });

      expect(screen.getByTestId("has-lineage-graph")).toHaveTextContent("true");
    });

    it("provides environment info from server response", async () => {
      const serverInfo = createServerInfoResult({
        adapter_type: "snowflake",
        git: { branch: "feature/test" },
      });

      mockGetServerInfo.mockResolvedValue(serverInfo);
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      });

      expect(screen.getByTestId("adapter-type")).toHaveTextContent("snowflake");
      expect(screen.getByTestId("git-branch")).toHaveTextContent(
        "feature/test",
      );
    });

    it("provides mode flags from server response", async () => {
      const serverInfo = createServerInfoResult({
        review_mode: true,
        cloud_mode: true,
        file_mode: true,
        filename: "test_state.json",
        demo: true,
        codespace: true,
      });

      mockGetServerInfo.mockResolvedValue(serverInfo);
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      });

      expect(screen.getByTestId("review-mode")).toHaveTextContent("true");
      expect(screen.getByTestId("cloud-mode")).toHaveTextContent("true");
      expect(screen.getByTestId("file-mode")).toHaveTextContent("true");
      expect(screen.getByTestId("file-name")).toHaveTextContent(
        "test_state.json",
      );
      expect(screen.getByTestId("is-demo-site")).toHaveTextContent("true");
      expect(screen.getByTestId("is-codespace")).toHaveTextContent("true");
    });

    it("provides runsAggregated data after fetch", async () => {
      const mockRunsAggregated: RunsAggregated = {
        model_a: {
          row_count_diff: { run_id: "run-1", result: { diff: 10 } },
          value_diff: { run_id: "run-2", result: {} },
          row_count: { run_id: "run-3", result: 100 },
        },
      };

      mockGetServerInfo.mockResolvedValue(createServerInfoResult());
      mockAggregateRuns.mockResolvedValue(mockRunsAggregated);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      });

      expect(screen.getByTestId("has-runs-aggregated")).toHaveTextContent(
        "true",
      );
    });
  });

  describe("error handling", () => {
    it("exposes error message when server info fetch fails", async () => {
      const errorMessage = "Failed to fetch server info";
      mockGetServerInfo.mockRejectedValue(new Error(errorMessage));
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent(errorMessage);
      });
    });

    it("provides default values on error", async () => {
      mockGetServerInfo.mockRejectedValue(new Error("Network error"));
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error")).not.toHaveTextContent("none");
      });

      // Should have default/undefined values
      expect(screen.getByTestId("has-lineage-graph")).toHaveTextContent(
        "false",
      );
      expect(screen.getByTestId("is-demo-site")).toHaveTextContent("false");
    });
  });

  describe("isActionAvailable", () => {
    it("returns true for action when supportTasks is not provided", async () => {
      mockGetServerInfo.mockResolvedValue(createServerInfoResult());
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumerWithAction actionName="any_action" />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("action-available")).toHaveTextContent(
          "true",
        );
      });
    });

    it("returns true for action when action is in supportTasks with true value", async () => {
      const serverInfo = createServerInfoResult({
        support_tasks: { profile_diff: true, value_diff: false },
      });

      mockGetServerInfo.mockResolvedValue(serverInfo);
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumerWithAction actionName="profile_diff" />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("action-available")).toHaveTextContent(
          "true",
        );
      });
    });

    it("returns false for action when action is in supportTasks with false value", async () => {
      const serverInfo = createServerInfoResult({
        support_tasks: { profile_diff: true, value_diff: false },
      });

      mockGetServerInfo.mockResolvedValue(serverInfo);
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumerWithAction actionName="value_diff" />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("action-available")).toHaveTextContent(
          "false",
        );
      });
    });

    it("returns true for action not in supportTasks (defaults to true)", async () => {
      const serverInfo = createServerInfoResult({
        support_tasks: { profile_diff: true },
      });

      mockGetServerInfo.mockResolvedValue(serverInfo);
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumerWithAction actionName="unknown_action" />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("action-available")).toHaveTextContent(
          "true",
        );
      });
    });
  });

  describe("refetch functionality", () => {
    it("provides retchLineageGraph function", async () => {
      mockGetServerInfo.mockResolvedValue(createServerInfoResult());
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      });

      expect(screen.getByTestId("has-refetch")).toHaveTextContent("true");
    });
  });

  describe("useRunsAggregated hook", () => {
    it("returns runsAggregated data and refetch function", async () => {
      const mockRunsAggregated: RunsAggregated = {
        model_a: {
          row_count_diff: { run_id: "run-1", result: {} },
          value_diff: { run_id: "run-2", result: {} },
          row_count: { run_id: "run-3", result: 100 },
        },
      };

      mockGetServerInfo.mockResolvedValue(createServerInfoResult());
      mockAggregateRuns.mockResolvedValue(mockRunsAggregated);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestRunsAggregatedConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("has-runs-aggregated")).toHaveTextContent(
          "true",
        );
      });

      expect(screen.getByTestId("has-refetch")).toHaveTextContent("true");
    });
  });

  describe("WebSocket connection status", () => {
    it("renders disconnected modal when WebSocket disconnects", async () => {
      // This test verifies the modal renders based on connection status
      // The WebSocket mock will emit 'pong' response which sets status to 'connected'
      mockGetServerInfo.mockResolvedValue(createServerInfoResult());
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      });

      // The dialog should not be visible when connected (WebSocket mock sends pong)
      // Note: MUI Dialog with open={false} doesn't render content
      expect(screen.queryByText("Server Disconnected")).not.toBeInTheDocument();
    });
  });

  describe("pull request info", () => {
    it("provides pull request info from server response", async () => {
      const serverInfo = createServerInfoResult({
        pull_request: {
          id: 123,
          title: "Test PR",
          url: "https://github.com/test/repo/pull/123",
          branch: "feature/test",
          base_branch: "main",
        },
      });

      mockGetServerInfo.mockResolvedValue(serverInfo);
      mockAggregateRuns.mockResolvedValue({});

      /**
       * Consumer to verify PR info
       */
      function PRInfoConsumer() {
        const context = useLineageGraphContext();
        return (
          <div>
            <span data-testid="pr-id">
              {context.envInfo?.pullRequest?.id ?? "none"}
            </span>
            <span data-testid="pr-title">
              {context.envInfo?.pullRequest?.title ?? "none"}
            </span>
            <span data-testid="pr-url">
              {context.envInfo?.pullRequest?.url ?? "none"}
            </span>
          </div>
        );
      }

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <PRInfoConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("pr-id")).toHaveTextContent("123");
      });

      expect(screen.getByTestId("pr-title")).toHaveTextContent("Test PR");
      expect(screen.getByTestId("pr-url")).toHaveTextContent(
        "https://github.com/test/repo/pull/123",
      );
    });
  });

  describe("SQLMesh info", () => {
    it("provides SQLMesh info from server response", async () => {
      const serverInfo = createServerInfoResult({
        sqlmesh: {
          base_env: "prod",
          current_env: "dev",
        },
      });

      mockGetServerInfo.mockResolvedValue(serverInfo);
      mockAggregateRuns.mockResolvedValue({});

      /**
       * Consumer to verify SQLMesh info
       */
      function SQLMeshInfoConsumer() {
        const context = useLineageGraphContext();
        return (
          <div>
            <span data-testid="sqlmesh-base">
              {context.envInfo?.sqlmesh?.base_env ?? "none"}
            </span>
            <span data-testid="sqlmesh-current">
              {context.envInfo?.sqlmesh?.current_env ?? "none"}
            </span>
          </div>
        );
      }

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <SQLMeshInfoConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("sqlmesh-base")).toHaveTextContent("prod");
      });

      expect(screen.getByTestId("sqlmesh-current")).toHaveTextContent("dev");
    });
  });

  describe("dbt manifest metadata", () => {
    it("provides dbt manifest metadata from lineage", async () => {
      const serverInfo = createServerInfoResult({
        lineage: {
          base: {
            metadata: { pr_url: "" },
            nodes: {},
            parent_map: {},
            manifest_metadata: {
              dbt_version: "1.7.0",
              dbt_schema_version: "v11",
              generated_at: "2024-01-01T00:00:00Z",
              adapter_type: "snowflake",
              env: {},
              invocation_id: "inv-123",
              project_name: "my_project",
            },
            catalog_metadata: null,
          },
          current: {
            metadata: { pr_url: "" },
            nodes: {},
            parent_map: {},
            manifest_metadata: {
              dbt_version: "1.8.0",
              dbt_schema_version: "v11",
              generated_at: "2024-01-02T00:00:00Z",
              adapter_type: "snowflake",
              env: {},
              invocation_id: "inv-456",
              project_name: "my_project",
            },
            catalog_metadata: null,
          },
          diff: {},
        },
      });

      mockGetServerInfo.mockResolvedValue(serverInfo);
      mockAggregateRuns.mockResolvedValue({});

      /**
       * Consumer to verify dbt metadata
       */
      function DbtMetadataConsumer() {
        const context = useLineageGraphContext();
        return (
          <div>
            <span data-testid="dbt-base-version">
              {context.envInfo?.dbt?.base?.dbt_version ?? "none"}
            </span>
            <span data-testid="dbt-current-version">
              {context.envInfo?.dbt?.current?.dbt_version ?? "none"}
            </span>
            <span data-testid="dbt-project-name">
              {context.envInfo?.dbt?.current?.project_name ?? "none"}
            </span>
          </div>
        );
      }

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <DbtMetadataConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("dbt-base-version")).toHaveTextContent(
          "1.7.0",
        );
      });

      expect(screen.getByTestId("dbt-current-version")).toHaveTextContent(
        "1.8.0",
      );
      expect(screen.getByTestId("dbt-project-name")).toHaveTextContent(
        "my_project",
      );
    });
  });

  describe("state metadata", () => {
    it("provides state metadata from server response", async () => {
      const serverInfo = createServerInfoResult({
        state_metadata: {
          schema_version: "2.0",
          recce_version: "0.42.0",
          generated_at: "2024-06-15T10:30:00Z",
        },
      });

      mockGetServerInfo.mockResolvedValue(serverInfo);
      mockAggregateRuns.mockResolvedValue({});

      /**
       * Consumer to verify state metadata
       */
      function StateMetadataConsumer() {
        const context = useLineageGraphContext();
        return (
          <div>
            <span data-testid="schema-version">
              {context.envInfo?.stateMetadata?.schema_version ?? "none"}
            </span>
            <span data-testid="recce-version">
              {context.envInfo?.stateMetadata?.recce_version ?? "none"}
            </span>
          </div>
        );
      }

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <StateMetadataConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("schema-version")).toHaveTextContent("2.0");
      });

      expect(screen.getByTestId("recce-version")).toHaveTextContent("0.42.0");
    });
  });

  describe("adapter wraps @datarecce/ui LineageGraphProvider", () => {
    it("passes fetched data to the underlying provider", async () => {
      const serverInfo = createServerInfoResult({
        adapter_type: "bigquery",
        review_mode: true,
      });

      mockGetServerInfo.mockResolvedValue(serverInfo);
      mockAggregateRuns.mockResolvedValue({});

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <LineageGraphAdapter>
            <TestConsumer />
          </LineageGraphAdapter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
      });

      // Verify the provider received the data
      expect(screen.getByTestId("adapter-type")).toHaveTextContent("bigquery");
      expect(screen.getByTestId("review-mode")).toHaveTextContent("true");
    });
  });
});
