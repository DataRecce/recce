/**
 * @file IdleTimeoutContext.test.tsx
 * @description Tests for IdleTimeoutContext provider and hooks in @datarecce/ui
 *
 * Phase 2A: Context Unification - Establishing behavioral contracts
 * These tests verify the behavior of IdleTimeoutProvider, useIdleTimeout, and useIdleTimeoutSafe
 * to ensure IDENTICAL behavior to the OSS version during migration.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import type { RecceInstanceInfo } from "../../../api/instanceInfo";
import {
  getLastKeepAliveTime,
  resetKeepAliveState,
  setKeepAliveCallback,
} from "../../../api/keepAlive";

// Mock dependencies
jest.mock("../../instance/useRecceInstanceInfo", () => ({
  useRecceInstanceInfo: jest.fn(),
}));

jest.mock("../useIdleDetection", () => ({
  useIdleDetection: jest.fn(),
}));

jest.mock("../../../api/keepAlive", () => ({
  setKeepAliveCallback: jest.fn(),
  getLastKeepAliveTime: jest.fn(() => 0),
  resetKeepAliveState: jest.fn(),
}));

import { useRecceInstanceInfo } from "../../instance/useRecceInstanceInfo";
import {
  IdleTimeoutProvider,
  useIdleTimeout,
  useIdleTimeoutSafe,
} from "../IdleTimeoutContext";

const mockUseRecceInstanceInfo = useRecceInstanceInfo as jest.MockedFunction<
  typeof useRecceInstanceInfo
>;
const mockSetKeepAliveCallback = setKeepAliveCallback as jest.MockedFunction<
  typeof setKeepAliveCallback
>;
const mockGetLastKeepAliveTime = getLastKeepAliveTime as jest.MockedFunction<
  typeof getLastKeepAliveTime
>;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/**
 * Helper to create a stable mock return value for useRecceInstanceInfo
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
 * Test consumer component that displays context values using useIdleTimeout
 */
function TestConsumer() {
  const context = useIdleTimeout();
  return (
    <div>
      <span data-testid="is-enabled">{String(context.isEnabled)}</span>
      <span data-testid="idle-timeout">{String(context.idleTimeout)}</span>
      <span data-testid="remaining-seconds">
        {context.remainingSeconds !== null
          ? Math.floor(context.remainingSeconds)
          : "null"}
      </span>
      <span data-testid="is-disconnected">
        {String(context.isDisconnected)}
      </span>
    </div>
  );
}

/**
 * Test consumer component with interactive controls
 */
function TestConsumerWithControls() {
  const context = useIdleTimeout();
  return (
    <div>
      <span data-testid="is-enabled">{String(context.isEnabled)}</span>
      <span data-testid="idle-timeout">{String(context.idleTimeout)}</span>
      <span data-testid="remaining-seconds">
        {context.remainingSeconds !== null
          ? Math.floor(context.remainingSeconds)
          : "null"}
      </span>
      <span data-testid="is-disconnected">
        {String(context.isDisconnected)}
      </span>
      <button
        data-testid="set-disconnected"
        onClick={() => context.setDisconnected()}
      >
        Disconnect
      </button>
      <button
        data-testid="reset-connection"
        onClick={() => context.resetConnection()}
      >
        Reset
      </button>
    </div>
  );
}

/**
 * Test consumer for useIdleTimeoutSafe (nullable hook)
 */
function SafeConsumer() {
  const context = useIdleTimeoutSafe();
  return (
    <div>
      <span data-testid="has-context">{String(context !== null)}</span>
      <span data-testid="is-enabled">
        {context !== null ? String(context.isEnabled) : "no-context"}
      </span>
    </div>
  );
}

/**
 * Test consumer that calls useIdleTimeout outside provider (should throw)
 * Note: biome-ignore used because we intentionally test error throwing behavior
 */
function ThrowingConsumer() {
  const context = useIdleTimeout();
  return <span data-testid="result">{String(context.isEnabled)}</span>;
}

/**
 * Error boundary component for testing hook throws
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <span data-testid="error">{this.state.error.message}</span>;
    }
    return this.props.children;
  }
}

describe("IdleTimeoutContext (@datarecce/ui)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetLastKeepAliveTime.mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("disabled state (timeout is null)", () => {
    it("provides disabled state when idle_timeout is not configured", () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        // idle_timeout not set
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("is-enabled")).toHaveTextContent("false");
      expect(screen.getByTestId("idle-timeout")).toHaveTextContent("null");
      expect(screen.getByTestId("remaining-seconds")).toHaveTextContent("null");
    });

    it("provides disabled state when idle_timeout is 0", () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 0,
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("is-enabled")).toHaveTextContent("false");
      expect(screen.getByTestId("idle-timeout")).toHaveTextContent("0");
      expect(screen.getByTestId("remaining-seconds")).toHaveTextContent("null");
    });

    it("clears keep-alive callback when disabled", () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        // No idle_timeout
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      // When disabled, should clear the callback
      expect(mockSetKeepAliveCallback).toHaveBeenCalledWith(null);
    });
  });

  describe("enabled state (timeout is set)", () => {
    it("provides enabled state when idle_timeout is configured", () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300, // 5 minutes
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("is-enabled")).toHaveTextContent("true");
      expect(screen.getByTestId("idle-timeout")).toHaveTextContent("300");
    });

    it("calculates remaining seconds from timeout", () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300, // 5 minutes
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      // Initial remaining should be close to 300 (the timeout value)
      const remaining = screen.getByTestId("remaining-seconds").textContent;
      expect(Number(remaining)).toBeGreaterThanOrEqual(299);
      expect(Number(remaining)).toBeLessThanOrEqual(300);
    });

    it("registers keep-alive callback when enabled", () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300,
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      // When enabled, should register a callback function
      expect(mockSetKeepAliveCallback).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("uses existing keep-alive time if available", () => {
      // Simulate an existing keep-alive time
      mockGetLastKeepAliveTime.mockReturnValue(Date.now() - 10000); // 10 seconds ago

      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300,
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      // Should have retrieved the last keep-alive time
      expect(mockGetLastKeepAliveTime).toHaveBeenCalled();
    });
  });

  describe("countdown updates", () => {
    it("updates remaining seconds over time", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300,
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      // Get initial remaining
      const initialRemaining = Number(
        screen.getByTestId("remaining-seconds").textContent,
      );

      // Advance time by 2 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Remaining should have decreased
      await waitFor(() => {
        const newRemaining = Number(
          screen.getByTestId("remaining-seconds").textContent,
        );
        expect(newRemaining).toBeLessThan(initialRemaining);
      });
    });

    it("stops at 0 and does not go negative", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 5, // 5 seconds
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      // Advance time beyond the timeout
      act(() => {
        jest.advanceTimersByTime(10000); // 10 seconds
      });

      await waitFor(() => {
        const remaining = Number(
          screen.getByTestId("remaining-seconds").textContent,
        );
        expect(remaining).toBe(0);
      });
    });
  });

  describe("disconnected state", () => {
    it("stops countdown when disconnected", () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300,
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumerWithControls />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("is-disconnected")).toHaveTextContent("false");

      // Get initial remaining
      const initialRemaining = Number(
        screen.getByTestId("remaining-seconds").textContent,
      );

      // Click disconnect
      act(() => {
        screen.getByTestId("set-disconnected").click();
      });

      expect(screen.getByTestId("is-disconnected")).toHaveTextContent("true");

      // Advance time
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Remaining should NOT have changed after disconnect
      // (countdown stops when disconnected)
      const afterDisconnect = Number(
        screen.getByTestId("remaining-seconds").textContent,
      );
      // The value should be frozen at whatever it was when disconnected
      // Note: It might have changed slightly before the disconnect registered
      expect(afterDisconnect).toBeGreaterThan(initialRemaining - 3);
    });

    it("resets connection state with resetConnection", async () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300,
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumerWithControls />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      // Set disconnected
      act(() => {
        screen.getByTestId("set-disconnected").click();
      });

      expect(screen.getByTestId("is-disconnected")).toHaveTextContent("true");

      // Reset connection
      act(() => {
        screen.getByTestId("reset-connection").click();
      });

      expect(screen.getByTestId("is-disconnected")).toHaveTextContent("false");

      // Remaining should be reset to close to full timeout
      await waitFor(() => {
        const remaining = Number(
          screen.getByTestId("remaining-seconds").textContent,
        );
        expect(remaining).toBeGreaterThan(295);
      });
    });
  });

  describe("useIdleTimeoutSafe fallback behavior", () => {
    it("returns null when used outside provider", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <SafeConsumer />
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("has-context")).toHaveTextContent("false");
      expect(screen.getByTestId("is-enabled")).toHaveTextContent("no-context");
    });

    it("returns context when used inside provider", () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300,
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <SafeConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("has-context")).toHaveTextContent("true");
      expect(screen.getByTestId("is-enabled")).toHaveTextContent("true");
    });
  });

  describe("useIdleTimeout (strict hook)", () => {
    it("throws error when used outside provider", () => {
      // Suppress console.error for this test since React will log the error
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: Intentionally suppressing console.error
        .mockImplementation(() => {});

      const queryClient = createTestQueryClient();

      // Using error boundary to catch the hook error
      render(
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <ThrowingConsumer />
          </ErrorBoundary>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("error")).toHaveTextContent(
        "useIdleTimeout must be used within IdleTimeoutProvider",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("keep-alive callback registration", () => {
    it("cleans up callback on unmount", () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300,
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      // Clear the mock to track only unmount behavior
      mockSetKeepAliveCallback.mockClear();

      unmount();

      // Should have cleared the callback on unmount
      expect(mockSetKeepAliveCallback).toHaveBeenCalledWith(null);
    });

    it("transitions callback when timeout changes from enabled to disabled", async () => {
      const enabledData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300,
      };
      const disabledData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        // No idle_timeout
      };

      const enabledReturn = createMockReturnValue(enabledData, false);
      const disabledReturn = createMockReturnValue(disabledData, false);

      mockUseRecceInstanceInfo.mockReturnValue(enabledReturn);

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("is-enabled")).toHaveTextContent("true");

      // Clear mock to track transition
      mockSetKeepAliveCallback.mockClear();

      // Transition to disabled
      mockUseRecceInstanceInfo.mockReturnValue(disabledReturn);
      rerender(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-enabled")).toHaveTextContent("false");
      });

      // Should have cleared the callback
      expect(mockSetKeepAliveCallback).toHaveBeenCalledWith(null);
    });
  });

  describe("loading state", () => {
    it("provides disabled state while loading instance info", () => {
      const mockReturn = createMockReturnValue(undefined, true);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <TestConsumer />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      expect(screen.getByTestId("is-enabled")).toHaveTextContent("false");
      expect(screen.getByTestId("idle-timeout")).toHaveTextContent("null");
      expect(screen.getByTestId("remaining-seconds")).toHaveTextContent("null");
    });
  });

  describe("context value stability", () => {
    it("provides stable function references", () => {
      const instanceData: RecceInstanceInfo = {
        server_mode: "server",
        single_env: false,
        authed: false,
        cloud_instance: false,
        idle_timeout: 300,
      };
      const mockReturn = createMockReturnValue(instanceData, false);
      mockUseRecceInstanceInfo.mockReturnValue(mockReturn);

      let firstSetDisconnected: (() => void) | null = null;
      let firstResetConnection: (() => void) | null = null;
      let secondSetDisconnected: (() => void) | null = null;
      let secondResetConnection: (() => void) | null = null;

      function ReferenceCapture() {
        const context = useIdleTimeout();
        if (!firstSetDisconnected) {
          firstSetDisconnected = context.setDisconnected;
          firstResetConnection = context.resetConnection;
        } else {
          secondSetDisconnected = context.setDisconnected;
          secondResetConnection = context.resetConnection;
        }
        return null;
      }

      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <ReferenceCapture />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      // Force a re-render
      rerender(
        <QueryClientProvider client={queryClient}>
          <IdleTimeoutProvider>
            <ReferenceCapture />
          </IdleTimeoutProvider>
        </QueryClientProvider>,
      );

      // Callbacks should be stable across re-renders
      expect(secondSetDisconnected).toBe(firstSetDisconnected);
      expect(secondResetConnection).toBe(firstResetConnection);
    });
  });
});
