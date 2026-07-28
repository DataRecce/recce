/**
 * @file RecceActionAdapter.test.tsx
 * @description Tests for RecceActionAdapter - the bridge between OSS and @datarecce/ui
 *
 * The adapter keeps the OSS-specific half of running an action while delegating
 * run-result/history state to @datarecce/ui's RecceActionProvider. Its own
 * responsibilities are:
 * - submitting the run (or opening the run modal when the type needs params)
 * - invalidating the run cache so history and the result pane refetch
 * - reporting failures as an error toast
 * - navigating off a lineage subpath after a direct submission
 *
 * The provider's state machine (initial values, showRunId/clearRunResult/
 * closeRunResult, history open/close, hook surface) is covered by
 * packages/ui/src/contexts/action/__tests__/RecceActionContext.test.tsx and is
 * deliberately not re-tested here.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { type Mock, type Mocked, type MockedFunction, vi } from "vitest";

// Mock the API functions from @datarecce/ui/api
vi.mock("@datarecce/ui/api", async () => {
  const actual = await vi.importActual("@datarecce/ui/api");
  return {
    ...actual,
    submitRun: vi.fn(),
    searchRuns: vi.fn(),
    cacheKeys: (actual as Record<string, unknown>).cacheKeys,
  };
});

// Mock the toaster
vi.mock("@datarecce/ui/components/ui/Toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

// Mock the run registry
vi.mock("@datarecce/ui/components/run", () => ({
  findByRunType: vi.fn((type: string) => ({
    title: `${type} Title`,
    icon: () => null,
    RunResultView: () => <div>Result View</div>,
    RunForm: undefined,
  })),
  RunModalOss: vi.fn(({ isOpen, onClose, title }) =>
    isOpen ? (
      <div data-testid="run-modal">
        <span data-testid="modal-title">{title}</span>
        <button type="button" onClick={onClose} data-testid="modal-close">
          Close
        </button>
      </div>
    ) : null,
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/lineage"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

import { cacheKeys, searchRuns, submitRun } from "@datarecce/ui/api";
import { findByRunType } from "@datarecce/ui/components/run";
import { toaster } from "@datarecce/ui/components/ui/Toaster";
import { useRecceActionContext } from "@datarecce/ui/contexts";
import { RecceActionAdapter } from "@datarecce/ui/hooks";
import { usePathname, useRouter } from "next/navigation";

const mockSubmitRun = submitRun as MockedFunction<typeof submitRun>;
const mockSearchRuns = searchRuns as MockedFunction<typeof searchRuns>;
const mockFindByRunType = findByRunType as Mock;
const mockToaster = toaster as Mocked<typeof toaster>;
const mockUsePathname = usePathname as MockedFunction<typeof usePathname>;
const mockUseRouter = useRouter as MockedFunction<typeof useRouter>;

const createMockRouter = (
  overrides: Partial<ReturnType<typeof useRouter>> = {},
) => ({
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  ...overrides,
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/**
 * A registry entry for a run type that submits directly (no params to collect).
 */
function registerDirectRunType(title = "Query Diff") {
  mockFindByRunType.mockReturnValue({
    title,
    icon: () => null,
    RunResultView: () => <div>Result</div>,
    RunForm: undefined,
  });
}

/**
 * A registry entry for a run type that needs params, so runAction has to open
 * the run modal instead of submitting.
 */
function registerFormRunType(title: string) {
  mockFindByRunType.mockReturnValue({
    title,
    icon: () => null,
    RunResultView: () => <div>Result</div>,
    RunForm: () => <div data-testid="mock-run-form">Form</div>,
  });
}

function renderWithAdapter(
  children: ReactNode,
  queryClient = createTestQueryClient(),
) {
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <RecceActionAdapter>{children}</RecceActionAdapter>
    </QueryClientProvider>,
  );
  return { ...rendered, queryClient };
}

/**
 * Test consumer covering the surfaces the adapter drives: a direct run action,
 * the run id / result pane the adapter sets, and showRunId.
 */
function TestConsumer() {
  const context = useRecceActionContext();
  return (
    <div>
      <span data-testid="run-id">{context.runId ?? "none"}</span>
      <span data-testid="is-run-result-open">
        {String(context.isRunResultOpen)}
      </span>
      <button
        type="button"
        onClick={() =>
          context.runAction("query_diff", { sql_template: "SELECT 1" })
        }
        data-testid="run-action-btn"
      >
        Run Action
      </button>
      <button
        type="button"
        onClick={() => context.showRunId("test-run-123")}
        data-testid="show-run-btn"
      >
        Show Run
      </button>
    </div>
  );
}

describe("RecceActionAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset router mocks
    mockUsePathname.mockReturnValue("/lineage");
    mockUseRouter.mockReturnValue(createMockRouter());
  });

  describe("submitting a run", () => {
    it("submits the run and shows its result when the type needs no params", async () => {
      registerDirectRunType();
      mockSubmitRun.mockResolvedValue({ run_id: "new-run-456" });

      renderWithAdapter(<TestConsumer />);

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(mockSubmitRun).toHaveBeenCalledWith(
          "query_diff",
          { sql_template: "SELECT 1" },
          expect.objectContaining({ nowait: true }),
          expect.anything(),
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent("new-run-456");
      });
      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "true",
      );
    });

    it("forwards trackProps to the submitted run", async () => {
      registerDirectRunType();
      mockSubmitRun.mockResolvedValue({ run_id: "tracked-run-123" });

      function TrackPropsConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.runAction(
                "query_diff",
                { sql_template: "SELECT 1" },
                {
                  showForm: false,
                  trackProps: {
                    source: "lineage_model_node",
                    breaking_change_analysis: true,
                  },
                },
              )
            }
            data-testid="track-props-btn"
          >
            Run With Track Props
          </button>
        );
      }

      renderWithAdapter(<TrackPropsConsumer />);

      act(() => {
        screen.getByTestId("track-props-btn").click();
      });

      await waitFor(() => {
        expect(mockSubmitRun).toHaveBeenCalledWith(
          "query_diff",
          { sql_template: "SELECT 1" },
          expect.objectContaining({
            nowait: true,
            trackProps: expect.objectContaining({
              source: "lineage_model_node",
              breaking_change_analysis: true,
            }),
          }),
          expect.anything(),
        );
      });
    });

    it("looks up the previous run to prefill the form when showLast is set", async () => {
      // showLast is an OSS-only option: the adapter fetches the most recent
      // matching run so the modal can open on its params.
      mockSearchRuns.mockResolvedValue([
        {
          run_id: "existing-run-789",
          type: "query_diff" as const,
          run_at: "2024-01-01T00:00:00Z",
        },
      ]);
      registerFormRunType("Query Diff");

      function ShowLastTestConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.runAction(
                "query_diff",
                { sql_template: "SELECT 1" },
                { showForm: true, showLast: true },
              )
            }
            data-testid="run-show-last-btn"
          >
            Run Show Last
          </button>
        );
      }

      renderWithAdapter(<ShowLastTestConsumer />);

      act(() => {
        screen.getByTestId("run-show-last-btn").click();
      });

      await waitFor(() => {
        expect(mockSearchRuns).toHaveBeenCalledWith(
          "query_diff",
          { sql_template: "SELECT 1" },
          1,
          expect.anything(),
        );
      });
    });
  });

  describe("run modal", () => {
    it("opens the modal titled after the run type instead of submitting", async () => {
      registerFormRunType("Profile Diff");

      function FormTestConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() =>
              context.runAction(
                "profile_diff",
                { model: "test" },
                { showForm: true },
              )
            }
            data-testid="run-with-form-btn"
          >
            Run With Form
          </button>
        );
      }

      renderWithAdapter(<FormTestConsumer />);

      // No action pending yet, so no modal is mounted.
      expect(screen.queryByTestId("run-modal")).not.toBeInTheDocument();

      act(() => {
        screen.getByTestId("run-with-form-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-modal")).toBeInTheDocument();
      });
      expect(screen.getByTestId("modal-title")).toHaveTextContent(
        "Profile Diff",
      );
      expect(mockSubmitRun).not.toHaveBeenCalled();
    });
  });

  describe("run cache invalidation", () => {
    // handleRunAction also invalidates at its submit site, but that call is
    // indistinguishable from the showRunId one below — it submits, then calls
    // showRunId, which invalidates again. Asserting it separately would pass
    // with the submit-site call deleted, so only the showRunId contract is
    // covered here.
    it("invalidates the run cache when a run is shown", async () => {
      // showRunId is the provider's; the adapter's onShowRunId callback is what
      // refetches history so a newly surfaced run appears in the run list.
      const queryClient = createTestQueryClient();
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

      renderWithAdapter(<TestConsumer />, queryClient);

      act(() => {
        screen.getByTestId("show-run-btn").click();
      });

      await waitFor(() => {
        expect(invalidateQueries).toHaveBeenCalledWith({
          queryKey: cacheKeys.runs(),
        });
      });
    });
  });

  describe("failure reporting", () => {
    it("reports a failed submission as an error toast carrying the reason", async () => {
      registerDirectRunType();
      mockSubmitRun.mockRejectedValue(new Error("API timeout"));

      renderWithAdapter(<TestConsumer />);

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(mockToaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to submit a run",
            description: "API timeout",
            type: "error",
          }),
        );
      });
    });

    it("refuses to run a type that has no result view", async () => {
      mockFindByRunType.mockReturnValue({
        title: "Schema Diff",
        icon: () => null,
        RunResultView: undefined,
        RunForm: undefined,
      });

      function NoResultViewConsumer() {
        const context = useRecceActionContext();
        return (
          <button
            type="button"
            onClick={() => context.runAction("schema_diff", {})}
            data-testid="no-result-view-btn"
          >
            Run Schema Diff
          </button>
        );
      }

      renderWithAdapter(<NoResultViewConsumer />);

      act(() => {
        screen.getByTestId("no-result-view-btn").click();
      });

      await waitFor(() => {
        expect(mockToaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to submit a run",
            type: "error",
          }),
        );
      });
      expect(mockSubmitRun).not.toHaveBeenCalled();
    });
  });

  describe("navigation after a direct submission", () => {
    /**
     * REGRESSION TEST: state is set before navigation on lineage subpaths.
     *
     * The order of operations matters:
     * - Correct: showRunId(run_id) → router.push("/lineage")
     * - Broken: router.push("/lineage") → return run_id → provider calls showRunId
     *
     * The broken order caused an empty ResultView pane when running diffs and a
     * NodeView that could not be closed after a profile diff, because state was
     * not set before navigation-triggered re-renders. handleRunAction calls
     * showRunId first and returns undefined so the provider does not call it twice.
     */
    it("sets the run result then returns to the lineage base from a subpath", async () => {
      const mockPush = vi.fn();
      mockUsePathname.mockReturnValue("/lineage/node/test");
      mockUseRouter.mockReturnValue(createMockRouter({ push: mockPush }));

      registerDirectRunType("Profile Diff");
      mockSubmitRun.mockResolvedValue({ run_id: "timing-test-run-123" });

      renderWithAdapter(<TestConsumer />);

      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "false",
      );

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent(
          "timing-test-run-123",
        );
      });

      // Both must hold: state set AND navigation performed.
      expect(screen.getByTestId("is-run-result-open")).toHaveTextContent(
        "true",
      );
      expect(mockPush).toHaveBeenCalledWith("/lineage");
    });

    /**
     * REGRESSION TEST (DRC-2779): no navigation from the lineage base path.
     *
     * A row_count/row_count_diff action triggered from the NodeView must not
     * push while already on the lineage base path — the redundant navigation
     * deselected the node, reset the zoom via the resize observer's fitView,
     * and closed the NodeView panel.
     */
    it("does not navigate when already on the lineage base path", async () => {
      const mockPush = vi.fn();
      mockUsePathname.mockReturnValue("/lineage");
      mockUseRouter.mockReturnValue(createMockRouter({ push: mockPush }));

      registerDirectRunType("Row Count");
      mockSubmitRun.mockResolvedValue({ run_id: "row-count-run-123" });

      renderWithAdapter(<TestConsumer />);

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent(
          "row-count-run-123",
        );
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("does not navigate when off the lineage path entirely", async () => {
      const mockPush = vi.fn();
      mockUsePathname.mockReturnValue("/checks");
      mockUseRouter.mockReturnValue(createMockRouter({ push: mockPush }));

      registerDirectRunType();
      mockSubmitRun.mockResolvedValue({ run_id: "no-nav-run-456" });

      renderWithAdapter(<TestConsumer />);

      act(() => {
        screen.getByTestId("run-action-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("run-id")).toHaveTextContent(
          "no-nav-run-456",
        );
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
