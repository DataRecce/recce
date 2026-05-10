/**
 * @file StalenessBanner.test.tsx
 * Tests for StalenessBanner and FirstTimePopover components.
 *
 * Tests verify:
 * - Banner hidden when cloudMode is false
 * - Banner hidden when no staleness in cache
 * - Banner hidden for legacy sessions (source_session_id === null)
 * - Banner hidden when session is up-to-date
 * - Banner rendered when session is outdated in cloud mode
 * - Refresh button click triggers apiClient.post with correct path
 * - 30s timeout clears refreshing state and shows error toast
 * - Refresh button disabled with no shared base
 * - FirstTimePopover shown on first mount, hidden after "Got it"
 * - Success toast when staleness transitions true → false
 * - Banner re-renders reactively when queryClient.setQueryData updates cache
 *   (no parent re-render required — validates the useQuery subscription in H1)
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi } from "vitest";
import type { ServerInfoResult, SessionStaleness } from "../../../api";
import { cacheKeys } from "../../../api";
import { LOCAL_STORAGE_KEYS } from "../../../api/storageKeys";

// ============================================================================
// Mocks - must be defined before vi.mock (vi.mock is hoisted but factories
// close over these variables, which are evaluated when the module is first
// imported — see Vitest docs on variable hoisting with mock factories)
// ============================================================================

const mockApiPost = vi.fn().mockResolvedValue({});
const mockApiGet = vi.fn().mockResolvedValue({ data: {} });
const mockUseLineageGraphContext = vi.fn(() => ({ cloudMode: true }));
const mockToasterSuccess = vi.fn();
const mockToasterError = vi.fn();

vi.mock("../../../contexts", () => ({
  useLineageGraphContext: () => mockUseLineageGraphContext(),
}));

vi.mock("../../../hooks", () => ({
  useApiConfig: () => ({
    apiClient: { get: mockApiGet, post: mockApiPost },
    apiPrefix: "",
  }),
}));

vi.mock("../../ui/Toaster", () => ({
  toaster: {
    create: vi.fn(() => "toast-id"),
    success: (...args: unknown[]) => mockToasterSuccess(...args),
    error: (...args: unknown[]) => mockToasterError(...args),
  },
}));

// Stub localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { StalenessBanner } from "../StalenessBanner";

// ============================================================================
// Fixture data
// ============================================================================

const OUTDATED_STALENESS: SessionStaleness = {
  source_session_id: "sess-old",
  source_session_updated_at: "2026-01-01T00:00:00Z",
  current_base_session_id: "sess-new",
  current_base_updated_at: "2026-02-01T00:00:00Z",
};

const UPTODATE_STALENESS: SessionStaleness = {
  source_session_id: "sess-same",
  source_session_updated_at: "2026-01-01T00:00:00Z",
  current_base_session_id: "sess-same",
  current_base_updated_at: "2026-01-01T00:00:00Z",
};

const LEGACY_STALENESS: SessionStaleness = {
  source_session_id: null,
  source_session_updated_at: null,
  current_base_session_id: "sess-new",
  current_base_updated_at: "2026-02-01T00:00:00Z",
};

const NO_SHARED_BASE_STALENESS: SessionStaleness = {
  source_session_id: "sess-old",
  source_session_updated_at: "2026-01-01T00:00:00Z",
  current_base_session_id: null,
  current_base_updated_at: null,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a minimal ServerInfoResult with the given session_staleness.
 * StalenessBanner subscribes to the lineage query cache, so tests must
 * pre-seed the queryClient with this shape.
 */
function makeServerInfo(
  staleness: SessionStaleness | undefined,
): Partial<ServerInfoResult> {
  return { session_staleness: staleness };
}

/**
 * Create a fresh QueryClient pre-seeded with the given staleness value,
 * and wrap the component in its provider.
 *
 * Passing `staleness: undefined` seeds no data → banner treats it as absent.
 */
function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Prevent auto-refetch from overwriting the seeded cache data during tests.
        staleTime: Infinity,
        gcTime: Infinity,
      },
    },
  });
}

function renderWithStaleness(
  staleness: SessionStaleness | undefined,
  options?: { existingClient?: QueryClient },
) {
  const client = options?.existingClient ?? createTestClient();

  client.setQueryData(
    cacheKeys.lineage(),
    makeServerInfo(staleness) as ServerInfoResult,
  );

  const result = render(
    <QueryClientProvider client={client}>
      <StalenessBanner />
    </QueryClientProvider>,
  );

  return { ...result, client };
}

// ============================================================================
// Tests
// ============================================================================

describe("StalenessBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Suppress FirstTimePopover so it doesn't add aria-hidden to the document,
    // which would break role-based queries in these tests.
    localStorageMock.setItem(LOCAL_STORAGE_KEYS.snapshotBaseIntroSeen, "1");
    mockApiPost.mockResolvedValue({});
    mockApiGet.mockResolvedValue({ data: {} });
    mockUseLineageGraphContext.mockReturnValue({ cloudMode: true });
  });

  describe("visibility", () => {
    it("hidden when cloudMode is false", () => {
      mockUseLineageGraphContext.mockReturnValue({ cloudMode: false });

      renderWithStaleness(OUTDATED_STALENESS);

      expect(screen.queryByText(/Production data has changed/)).toBeNull();
    });

    it("hidden when no staleness in cache", () => {
      renderWithStaleness(undefined);

      expect(screen.queryByText(/Production data has changed/)).toBeNull();
    });

    it("hidden for legacy sessions (source_session_id null)", () => {
      renderWithStaleness(LEGACY_STALENESS);

      expect(screen.queryByText(/Production data has changed/)).toBeNull();
    });

    it("hidden when session is up-to-date", () => {
      renderWithStaleness(UPTODATE_STALENESS);

      expect(screen.queryByText(/Production data has changed/)).toBeNull();
    });

    it("visible when cloudMode=true and session is outdated", () => {
      renderWithStaleness(OUTDATED_STALENESS);

      expect(
        screen.getByText(/Production data has changed/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Refresh base/ }),
      ).toBeEnabled();
    });
  });

  describe("Refresh button", () => {
    it("triggers apiClient.post with /api/refresh-base", async () => {
      const user = userEvent.setup();

      renderWithStaleness(OUTDATED_STALENESS);

      await user.click(screen.getByRole("button", { name: /Refresh base/ }));

      expect(mockApiPost).toHaveBeenCalledWith("/api/refresh-base");
    });

    it("shows spinner after click while request is pending", async () => {
      const user = userEvent.setup();
      // Make the post hang indefinitely
      mockApiPost.mockImplementation(() => new Promise(() => undefined));

      renderWithStaleness(OUTDATED_STALENESS);

      await user.click(screen.getByRole("button", { name: /Refresh base/ }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Refreshing/ }),
        ).toBeDisabled();
      });
    });

    it("shows error toast and clears spinner on request failure", async () => {
      const user = userEvent.setup();
      mockApiPost.mockRejectedValue(new Error("Network error"));

      renderWithStaleness(OUTDATED_STALENESS);

      await user.click(screen.getByRole("button", { name: /Refresh base/ }));

      await waitFor(() => {
        expect(mockToasterError).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Refresh failed — try again.",
          }),
        );
      });
      // Spinner should clear and button returns to enabled state
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Refresh base/ }),
        ).toBeEnabled();
      });
    });

    it("disabled with no shared base configured", () => {
      renderWithStaleness(NO_SHARED_BASE_STALENESS);

      expect(
        screen.getByRole("button", { name: /Refresh base/ }),
      ).toBeDisabled();
    });

    it("shows error toast on 30s timeout", async () => {
      vi.useFakeTimers();
      try {
        mockApiPost.mockImplementation(() => new Promise(() => undefined));

        renderWithStaleness(OUTDATED_STALENESS);

        const button = screen.getByRole("button", { name: /Refresh base/ });
        await act(async () => {
          button.click();
        });

        await act(async () => {
          vi.advanceTimersByTime(30_000);
        });

        expect(mockToasterError).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Refresh failed — try again.",
          }),
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("success toast on staleness clear", () => {
    it("fires success toast when outdated transitions from true to false via cache update", async () => {
      const { client } = renderWithStaleness(OUTDATED_STALENESS);

      // Verify banner is visible
      expect(
        screen.getByText(/Production data has changed/),
      ).toBeInTheDocument();

      // Simulate WS metadata_updated → queryClient.setQueryData updates cache.
      // No parent re-render needed — the useQuery subscription in StalenessBanner
      // picks up the change directly, proving the reactive path (H1 fix).
      await act(async () => {
        client.setQueryData(
          cacheKeys.lineage(),
          makeServerInfo(UPTODATE_STALENESS) as ServerInfoResult,
        );
      });

      await waitFor(() => {
        expect(mockToasterSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            description: expect.stringContaining("Base refreshed"),
          }),
        );
      });
    });
  });

  describe("reactive subscription (H1)", () => {
    it("shows banner without parent re-render when queryClient cache is updated to outdated", async () => {
      // Start with up-to-date staleness — banner should be hidden.
      const { client } = renderWithStaleness(UPTODATE_STALENESS);

      expect(screen.queryByText(/Production data has changed/)).toBeNull();

      // Update the cache directly (simulates WS metadata_updated invalidation
      // followed by a refetch returning new staleness). No parent re-renders.
      await act(async () => {
        client.setQueryData(
          cacheKeys.lineage(),
          makeServerInfo(OUTDATED_STALENESS) as ServerInfoResult,
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Production data has changed/),
        ).toBeInTheDocument();
      });
    });
  });
});

// ============================================================================
// FirstTimePopover tests
// ============================================================================

import { FirstTimePopover } from "../FirstTimePopover";

describe("FirstTimePopover", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("renders on first mount when localStorage flag absent", () => {
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);

    render(<FirstTimePopover anchorEl={anchor} />);

    expect(
      screen.getByText(/Recce now snapshots your base data/),
    ).toBeInTheDocument();

    document.body.removeChild(anchor);
  });

  it("does not render when flag is already set", () => {
    localStorageMock.setItem(LOCAL_STORAGE_KEYS.snapshotBaseIntroSeen, "1");
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);

    render(<FirstTimePopover anchorEl={anchor} />);

    expect(screen.queryByText(/Recce now snapshots your base data/)).toBeNull();

    document.body.removeChild(anchor);
  });

  it("sets localStorage flag and closes on 'Got it'", async () => {
    const user = userEvent.setup();
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);

    render(<FirstTimePopover anchorEl={anchor} />);

    expect(
      screen.getByText(/Recce now snapshots your base data/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Got it/ }));

    expect(
      localStorageMock.getItem(LOCAL_STORAGE_KEYS.snapshotBaseIntroSeen),
    ).toBe("1");
    expect(screen.queryByText(/Recce now snapshots your base data/)).toBeNull();

    document.body.removeChild(anchor);
  });
});
