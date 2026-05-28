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

// Inline a thin stand-in for useServerInfo that subscribes via useQuery to
// the same queryKey used by the real hook. Tests pre-seed the queryClient
// with that key, so the banner sees the seeded data through the real React
// Query subscription path (preserves the H1 reactive-subscription coverage).
vi.mock("../../../hooks", async () => {
  const reactQuery = await vi.importActual<
    typeof import("@tanstack/react-query")
  >("@tanstack/react-query");
  return {
    useApiConfig: () => ({
      apiClient: { get: mockApiGet, post: mockApiPost },
      apiPrefix: "",
    }),
    useServerInfo: (options?: { select?: (d: ServerInfoResult) => unknown }) =>
      reactQuery.useQuery({
        queryKey: cacheKeys.lineage(),
        queryFn: () => Promise.resolve({} as ServerInfoResult),
        select: options?.select,
      }),
  };
});

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

  describe("FirstTimePopover anchor (regression: PR #1366 review)", () => {
    it("opens FirstTimePopover when banner mounts and localStorage flag is absent", async () => {
      // The popover's anchor must be a state-backed ref so MUI re-renders
      // after the banner DOM commits. A plain useRef would leave anchorEl
      // null on first render and the popover would stay closed.
      localStorageMock.clear();

      renderWithStaleness(OUTDATED_STALENESS);

      await waitFor(() => {
        expect(
          screen.getByText(/Recce now snapshots your base data/),
        ).toBeInTheDocument();
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
// Cross-shell prop surface (DRC-3508)
// ============================================================================

describe("StalenessBanner props (cross-shell)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem(LOCAL_STORAGE_KEYS.snapshotBaseIntroSeen, "1");
    mockApiPost.mockResolvedValue({});
    mockUseLineageGraphContext.mockReturnValue({ cloudMode: false });
  });

  function renderWithProps(
    staleness: SessionStaleness | undefined,
    props: React.ComponentProps<typeof StalenessBanner>,
  ) {
    const client = createTestClient();
    client.setQueryData(
      cacheKeys.lineage(),
      makeServerInfo(staleness) as ServerInfoResult,
    );
    const result = render(
      <QueryClientProvider client={client}>
        <StalenessBanner {...props} />
      </QueryClientProvider>,
    );
    return { ...result, client };
  }

  it("requireCloudMode=false renders even when cloudMode is unset", () => {
    renderWithProps(OUTDATED_STALENESS, { requireCloudMode: false });

    expect(screen.getByText(/Production data has changed/)).toBeInTheDocument();
  });

  it("messageVariant='metadata' uses the cloud-side wording", () => {
    renderWithProps(OUTDATED_STALENESS, {
      requireCloudMode: false,
      messageVariant: "metadata",
    });

    expect(
      screen.getByText(/Production metadata has changed/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Production data has changed/)).toBeNull();
  });

  it("dismissible=true renders a close button and hides after click", async () => {
    const user = userEvent.setup();
    renderWithProps(OUTDATED_STALENESS, {
      requireCloudMode: false,
      dismissible: true,
      sessionId: "sess-1",
    });

    const dismiss = screen.getByRole("button", { name: /Dismiss/ });
    await user.click(dismiss);

    expect(screen.queryByText(/Production data has changed/)).toBeNull();
  });

  it("dismissible=true scopes the dismissal key per sessionId", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProps(OUTDATED_STALENESS, {
      requireCloudMode: false,
      dismissible: true,
      sessionId: "sess-A",
    });
    await user.click(screen.getByRole("button", { name: /Dismiss/ }));
    expect(screen.queryByText(/Production data has changed/)).toBeNull();
    unmount();

    // Same staleness shape, different sessionId — banner should re-fire.
    renderWithProps(OUTDATED_STALENESS, {
      requireCloudMode: false,
      dismissible: true,
      sessionId: "sess-B",
    });
    expect(screen.getByText(/Production data has changed/)).toBeInTheDocument();
  });

  it("toastAdapter override routes refresh-error toast through the adapter", async () => {
    const user = userEvent.setup();
    mockApiPost.mockRejectedValue(new Error("Network error"));
    const adapterSuccess = vi.fn();
    const adapterError = vi.fn();

    renderWithProps(OUTDATED_STALENESS, {
      requireCloudMode: false,
      toastAdapter: { success: adapterSuccess, error: adapterError },
    });

    await user.click(screen.getByRole("button", { name: /Refresh base/ }));

    await waitFor(() => {
      expect(adapterError).toHaveBeenCalledWith(
        "Refresh failed — try again.",
        expect.objectContaining({ duration: 5000 }),
      );
    });
    // Default adapter (OSS toaster) must NOT have been called.
    expect(mockToasterError).not.toHaveBeenCalled();
  });

  it("successToastOnlyOnUserRefresh=true suppresses spurious success toast", async () => {
    const adapterSuccess = vi.fn();
    const { client } = renderWithProps(OUTDATED_STALENESS, {
      requireCloudMode: false,
      successToastOnlyOnUserRefresh: true,
      toastAdapter: { success: adapterSuccess, error: vi.fn() },
    });

    // Simulate an unrelated cache update (other tab refreshed) — no user click.
    await act(async () => {
      client.setQueryData(
        cacheKeys.lineage(),
        makeServerInfo(UPTODATE_STALENESS) as ServerInfoResult,
      );
    });

    expect(adapterSuccess).not.toHaveBeenCalled();
  });

  it("successToastOnlyOnUserRefresh=true fires success toast when user clicked Refresh", async () => {
    const user = userEvent.setup();
    const adapterSuccess = vi.fn();
    const { client } = renderWithProps(OUTDATED_STALENESS, {
      requireCloudMode: false,
      successToastOnlyOnUserRefresh: true,
      toastAdapter: { success: adapterSuccess, error: vi.fn() },
    });

    await user.click(screen.getByRole("button", { name: /Refresh base/ }));
    await act(async () => {
      client.setQueryData(
        cacheKeys.lineage(),
        makeServerInfo(UPTODATE_STALENESS) as ServerInfoResult,
      );
    });

    await waitFor(() => {
      expect(adapterSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Base refreshed"),
        expect.objectContaining({ duration: 8000 }),
      );
    });
  });

  it("showFirstTimePopover=false omits the popover", async () => {
    localStorageMock.clear();
    renderWithProps(OUTDATED_STALENESS, {
      requireCloudMode: false,
      showFirstTimePopover: false,
    });

    expect(screen.getByText(/Production data has changed/)).toBeInTheDocument();
    expect(screen.queryByText(/Recce now snapshots your base data/)).toBeNull();
  });

  describe("variant='card' (cloud floating-overlay surface)", () => {
    it("renders a MUI Paper root instead of the default Box", () => {
      const { container } = renderWithProps(OUTDATED_STALENESS, {
        requireCloudMode: false,
        variant: "card",
      });

      // Card branch wraps content in <Paper> (which MUI renders with a
      // `MuiPaper-root` class). Banner branch uses a plain <Box>, so this
      // assertion fails for the default variant — proves the branch ran.
      expect(container.querySelector(".MuiPaper-root")).not.toBeNull();
    });

    it("supports the full cloud-shell prop bundle end-to-end", async () => {
      const user = userEvent.setup();
      const adapter = { success: vi.fn(), error: vi.fn() };

      renderWithProps(OUTDATED_STALENESS, {
        requireCloudMode: false,
        variant: "card",
        dismissible: true,
        sessionId: "sess-cloud-1",
        toastAdapter: adapter,
        successToastOnlyOnUserRefresh: true,
        messageVariant: "metadata",
        showFirstTimePopover: false,
        cardSx: { top: 180 },
      });

      // Wording flips to the metadata variant.
      expect(
        screen.getByText(/Production metadata has changed/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Production data has changed/)).toBeNull();

      // Refresh button still wired through to the apiClient.
      await user.click(screen.getByRole("button", { name: /Refresh base/ }));
      expect(mockApiPost).toHaveBeenCalledWith("/api/refresh-base");

      // Dismiss button hides the card (sessionStorage-backed dismissal).
      await user.click(screen.getByRole("button", { name: /Dismiss/ }));
      expect(screen.queryByText(/Production metadata has changed/)).toBeNull();

      // Popover opted out — must not appear even without the localStorage flag.
      expect(
        screen.queryByText(/Recce now snapshots your base data/),
      ).toBeNull();
    });

    it("cardSx object override produces different emotion classes than defaults", () => {
      const { container, unmount } = renderWithProps(OUTDATED_STALENESS, {
        requireCloudMode: false,
        variant: "card",
      });
      const defaultClass =
        container.querySelector(".MuiPaper-root")?.className ?? "";
      unmount();

      const { container: overrideContainer } = renderWithProps(
        OUTDATED_STALENESS,
        {
          requireCloudMode: false,
          variant: "card",
          // Use a sentinel offset that the default does not set.
          cardSx: { top: 999 },
        },
      );
      const overrideClass =
        overrideContainer.querySelector(".MuiPaper-root")?.className ?? "";

      // Emotion compiles `sx` to className suffixes; an additional rule must
      // produce a non-identical className. This proves the `cardSx` merge is
      // reaching the Paper element rather than being silently dropped.
      expect(overrideClass).not.toBe(defaultClass);
    });

    it("cardSx array form (multiple sx layers) flattens without throwing", () => {
      // The component does `Array.isArray(cardSx) ? cardSx : [cardSx]` so it
      // can spread either shape into MUI's sx array. Regression target: if
      // someone "simplifies" that branch to `[cardSx]` always, MUI receives
      // a nested array and warns at runtime.
      expect(() => {
        renderWithProps(OUTDATED_STALENESS, {
          requireCloudMode: false,
          variant: "card",
          cardSx: [{ top: 200 }, { bgcolor: "primary.light" }],
        });
      }).not.toThrow();

      expect(
        screen.getByText(/Production data has changed/),
      ).toBeInTheDocument();
    });

    it("zIndex theme callback resolves against the MUI theme", () => {
      // The card branch sets `zIndex: (theme) => theme.zIndex.drawer + 1`.
      // If the theme is not in scope, MUI logs a warning. We spy on
      // console.error so any theme-resolution warning would fail the test.
      const errSpy = vi
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: Intentionally suppressing console.error for this test
        .mockImplementation(() => {});

      const { container } = renderWithProps(OUTDATED_STALENESS, {
        requireCloudMode: false,
        variant: "card",
      });

      expect(container.querySelector(".MuiPaper-root")).not.toBeNull();
      expect(errSpy).not.toHaveBeenCalled();

      errSpy.mockRestore();
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
