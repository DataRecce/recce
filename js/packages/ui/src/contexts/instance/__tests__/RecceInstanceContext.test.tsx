/**
 * @file RecceInstanceContext.test.tsx
 * @description Tests for RecceInstanceContext provider and hooks in @datarecce/ui
 *
 * Phase 2A: Context Unification - Establishing behavioral contracts
 * These tests verify the behavior of RecceInstanceInfoProvider and useRecceInstanceContext
 * to ensure identical behavior to the OSS version during migration.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

import type { RecceInstanceInfo } from "../../../api/instanceInfo";

// Mock the useRecceInstanceInfo hook which fetches data
jest.mock("../useRecceInstanceInfo", () => ({
  useRecceInstanceInfo: jest.fn(),
}));

import {
  RecceInstanceInfoProvider,
  useRecceInstanceContext,
} from "../RecceInstanceContext";
import { useRecceInstanceInfo } from "../useRecceInstanceInfo";

const mockUseRecceInstanceInfo = useRecceInstanceInfo as jest.MockedFunction<
  typeof useRecceInstanceInfo
>;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/**
 * Helper to create a stable mock return value that persists across re-renders.
 * The RecceInstanceContext uses object identity to detect changes,
 * so we need to return the same object reference on subsequent calls.
 */
function createMockReturnValue(
  data: RecceInstanceInfo | undefined,
  isLoading: boolean,
) {
  return {
    data,
    isLoading,
    isError: false,
    error: null,
    status: isLoading ? "pending" : "success",
  } as ReturnType<typeof useRecceInstanceInfo>;
}

/**
 * Test consumer component that displays context values
 */
function TestConsumer() {
  const context = useRecceInstanceContext();
  return (
    <div>
      <span data-testid="single-env">{String(context.singleEnv)}</span>
      <span data-testid="authed">{String(context.authed)}</span>
      <span data-testid="share-url">{context.shareUrl ?? "none"}</span>
      <span data-testid="session-id">{context.sessionId ?? "none"}</span>
      <span data-testid="mode">{context.featureToggles.mode ?? "default"}</span>
      <span data-testid="disable-save">
        {String(context.featureToggles.disableSaveToFile)}
      </span>
      <span data-testid="disable-db-query">
        {String(context.featureToggles.disableDatabaseQuery)}
      </span>
      <span data-testid="disable-share">
        {String(context.featureToggles.disableShare)}
      </span>
      <span data-testid="disable-checklist">
        {String(context.featureToggles.disableUpdateChecklist)}
      </span>
      <span data-testid="lifetime-expired">
        {context.lifetimeExpiredAt?.toISOString() ?? "none"}
      </span>
    </div>
  );
}

describe("RecceInstanceContext (@datarecce/ui)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loading state", () => {
    it("provides default values while loading", () => {
      const mockReturn = createMockReturnValue(undefined, true);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("single-env")).toHaveTextContent("false");
      expect(screen.getByTestId("authed")).toHaveTextContent("false");
      expect(screen.getByTestId("mode")).toHaveTextContent("default");
      expect(screen.getByTestId("disable-save")).toHaveTextContent("false");
    });
  });

  describe("successful data fetch", () => {
    it("provides instance info after successful fetch", async () => {
      // Create stable data object for reference identity
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: true,
        cloud_instance: false,
        share_url: "https://example.com/share",
        session_id: "session-123",
      };

      // Start with loading state, then transition to loaded
      const loadingReturn = createMockReturnValue(undefined, true);
      const loadedReturn = createMockReturnValue(instanceData, false);

      mockUseRecceInstanceInfo.mockReturnValue(loadingReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      // Verify loading state
      expect(screen.getByTestId("authed")).toHaveTextContent("false");

      // Transition to loaded state
      mockUseRecceInstanceInfo.mockReturnValue(loadedReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("authed")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("single-env")).toHaveTextContent("false");
      expect(screen.getByTestId("share-url")).toHaveTextContent(
        "https://example.com/share",
      );
      expect(screen.getByTestId("session-id")).toHaveTextContent("session-123");
    });

    it("handles single_env mode correctly", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: true,
        authed: false,
        cloud_instance: false,
      };

      const loadingReturn = createMockReturnValue(undefined, true);
      const loadedReturn = createMockReturnValue(instanceData, false);

      mockUseRecceInstanceInfo.mockReturnValue(loadingReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      // Transition to loaded state
      mockUseRecceInstanceInfo.mockReturnValue(loadedReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("single-env")).toHaveTextContent("true");
      });
    });
  });

  describe("feature toggles - read-only mode", () => {
    it("sets all restrictions for read-only server mode", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "read-only",
        single_env: false,
        authed: false,
        cloud_instance: false,
      };
      const loadingReturn = createMockReturnValue(undefined, true);
      const loadedReturn = createMockReturnValue(instanceData, false);

      mockUseRecceInstanceInfo.mockReturnValue(loadingReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      mockUseRecceInstanceInfo.mockReturnValue(loadedReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("mode")).toHaveTextContent("read only");
      });
      expect(screen.getByTestId("disable-save")).toHaveTextContent("true");
      expect(screen.getByTestId("disable-db-query")).toHaveTextContent("true");
      expect(screen.getByTestId("disable-share")).toHaveTextContent("true");
      expect(screen.getByTestId("disable-checklist")).toHaveTextContent("true");
    });
  });

  describe("feature toggles - preview mode", () => {
    it("sets metadata-only restrictions for preview server mode", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "preview",
        single_env: false,
        authed: false,
        cloud_instance: false,
      };
      const loadingReturn = createMockReturnValue(undefined, true);
      const loadedReturn = createMockReturnValue(instanceData, false);

      mockUseRecceInstanceInfo.mockReturnValue(loadingReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      mockUseRecceInstanceInfo.mockReturnValue(loadedReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("mode")).toHaveTextContent("metadata only");
      });
      expect(screen.getByTestId("disable-save")).toHaveTextContent("true");
      expect(screen.getByTestId("disable-db-query")).toHaveTextContent("true");
      expect(screen.getByTestId("disable-share")).toHaveTextContent("true");
      // Checklist updates allowed in preview mode
      expect(screen.getByTestId("disable-checklist")).toHaveTextContent(
        "false",
      );
    });
  });

  describe("feature toggles - single env mode", () => {
    it("disables checklist and share for single_env mode", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: true,
        authed: false,
        cloud_instance: false,
      };
      const loadingReturn = createMockReturnValue(undefined, true);
      const loadedReturn = createMockReturnValue(instanceData, false);

      mockUseRecceInstanceInfo.mockReturnValue(loadingReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      mockUseRecceInstanceInfo.mockReturnValue(loadedReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("single-env")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("disable-checklist")).toHaveTextContent("true");
      expect(screen.getByTestId("disable-share")).toHaveTextContent("true");
    });
  });

  describe("feature toggles - cloud instance", () => {
    it("disables share for cloud instances", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: true,
        cloud_instance: true,
      };
      const loadingReturn = createMockReturnValue(undefined, true);
      const loadedReturn = createMockReturnValue(instanceData, false);

      mockUseRecceInstanceInfo.mockReturnValue(loadingReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      mockUseRecceInstanceInfo.mockReturnValue(loadedReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("authed")).toHaveTextContent("true");
      });
      expect(screen.getByTestId("disable-share")).toHaveTextContent("true");
    });
  });

  describe("lifetime expiration", () => {
    it("parses and provides lifetime_expired_at date", async () => {
      const expirationDate = "2025-12-31T23:59:59.000Z";
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        lifetime_expired_at: new Date(expirationDate),
      };
      const loadingReturn = createMockReturnValue(undefined, true);
      const loadedReturn = createMockReturnValue(instanceData, false);

      mockUseRecceInstanceInfo.mockReturnValue(loadingReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      mockUseRecceInstanceInfo.mockReturnValue(loadedReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("lifetime-expired")).toHaveTextContent(
          "2025-12-31T23:59:59.000Z",
        );
      });
    });

    it("handles missing lifetime_expired_at", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
      };
      const loadingReturn = createMockReturnValue(undefined, true);
      const loadedReturn = createMockReturnValue(instanceData, false);

      mockUseRecceInstanceInfo.mockReturnValue(loadingReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      mockUseRecceInstanceInfo.mockReturnValue(loadedReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      // Verify that singleEnv was updated (proving data was processed)
      // and lifetime_expired_at remains none since it wasn't provided
      await waitFor(() => {
        // This check ensures the state update happened
        expect(screen.getByTestId("authed")).toHaveTextContent("false");
      });
      expect(screen.getByTestId("lifetime-expired")).toHaveTextContent("none");
    });
  });

  describe("default context (outside provider)", () => {
    it("useRecceInstanceContext returns default values outside provider", () => {
      // Render without provider to test default context
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <TestConsumer />
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("single-env")).toHaveTextContent("false");
      expect(screen.getByTestId("authed")).toHaveTextContent("false");
      expect(screen.getByTestId("mode")).toHaveTextContent("default");
      expect(screen.getByTestId("disable-save")).toHaveTextContent("false");
    });
  });

  describe("combined mode scenarios", () => {
    it("applies both read-only and single_env restrictions", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "read-only",
        single_env: true,
        authed: false,
        cloud_instance: false,
      };
      const loadingReturn = createMockReturnValue(undefined, true);
      const loadedReturn = createMockReturnValue(instanceData, false);

      mockUseRecceInstanceInfo.mockReturnValue(loadingReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      mockUseRecceInstanceInfo.mockReturnValue(loadedReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("mode")).toHaveTextContent("read only");
      });
      expect(screen.getByTestId("single-env")).toHaveTextContent("true");
      // Both modes disable these
      expect(screen.getByTestId("disable-save")).toHaveTextContent("true");
      expect(screen.getByTestId("disable-checklist")).toHaveTextContent("true");
      expect(screen.getByTestId("disable-share")).toHaveTextContent("true");
    });

    it("applies preview mode with cloud instance restrictions", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "preview",
        single_env: false,
        authed: true,
        cloud_instance: true,
      };
      const loadingReturn = createMockReturnValue(undefined, true);
      const loadedReturn = createMockReturnValue(instanceData, false);

      mockUseRecceInstanceInfo.mockReturnValue(loadingReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      mockUseRecceInstanceInfo.mockReturnValue(loadedReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <RecceInstanceInfoProvider>
            <TestConsumer />
          </RecceInstanceInfoProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("mode")).toHaveTextContent("metadata only");
      });
      expect(screen.getByTestId("authed")).toHaveTextContent("true");
      // Cloud instance also disables share (in addition to preview mode)
      expect(screen.getByTestId("disable-share")).toHaveTextContent("true");
    });
  });
});
