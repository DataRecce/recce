/**
 * @file run/RunView.test.tsx
 * @description Tests for RunView cancel UX (DRC-3411)
 *
 * Tests verify:
 * - Cancel button invokes onCancel callback
 * - Cancelled run status renders terminal "Cancelled" state with no spinner
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Run } from "../../api";
import { useCanceledRuns } from "../../hooks/useCanceledRuns";
import { RunView } from "./RunView";

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("RunView cancel UX", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  test("clicking Cancel calls onCancel", () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <RunView
        run={
          // biome-ignore lint/suspicious/noExplicitAny: test fixture
          { run_id: "run-1", status: "Running", type: "query" } as any
        }
        isRunning
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  test("renders Cancelled state when run.status === Cancelled", () => {
    renderWithProviders(
      <RunView
        run={
          // biome-ignore lint/suspicious/noExplicitAny: test fixture
          { run_id: "run-1", status: "Cancelled", type: "query" } as any
        }
        isRunning={false}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  /**
   * Regression test for the race condition surfaced on PR #1376 review.
   *
   * Scenario (per T1's MutationObserver repro):
   * 1. User clicks Cancel on a Running run → run_id added to useCanceledRuns
   *    (localStorage), backend transitions the run to Cancelled.
   * 2. Meanwhile, a `waitRun(timeout=2)` poll that was already in-flight
   *    resolves AFTER the click and writes `{ status: "Running" }` back into
   *    the React Query cache (waitRun doesn't accept an AbortSignal, so
   *    React Query's `enabled: false` cannot abort it).
   * 3. Without the fix, RunView reads the stale Running status from the
   *    cache and reverts the UI from Cancelled → Running.
   *
   * Invariant: if the user has cancelled this run locally
   * (useCanceledRuns.has(run_id) === true), RunView MUST render Cancelled
   * regardless of what's in the cached run.status.
   *
   * This test fails against the pre-fix code (commit 4db2ee0d) and passes
   * against the userCanceled-gating fix on RunView.
   */
  test("renders Cancelled when user cancelled locally even if cached status is Running (DRC-3411 race)", () => {
    // Simulate the "user clicked Cancel" state by seeding localStorage that
    // useCanceledRuns reads on mount. This matches how the real CancelButton
    // path (RunResultPane) marks the run as user-cancelled before the
    // backend has acknowledged the cancel.
    localStorage.setItem("recce:canceledRuns", JSON.stringify(["run-race"]));

    renderWithProviders(
      <RunView
        run={
          // biome-ignore lint/suspicious/noExplicitAny: test fixture
          {
            run_id: "run-race",
            status: "Running", // late waitRun poll wrote Running back into cache
            type: "query",
          } as any
        }
        // isRunning also true, mirroring the React Query "isFetching" race
        isRunning
        onCancel={vi.fn()}
      />,
    );

    // Must show Cancelled UI...
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    // ...with no Running spinner...
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    // ...and no Cancel button (the Running branch is suppressed).
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument();
  });

  /**
   * Regression test for the "cancel before first poll" race surfaced on the
   * PR #1376 re-review (commit `395b3edd` review).
   *
   * Scenario:
   * 1. User submits a run, then clicks Cancel before the first `waitRun`
   *    poll has populated the React Query cache. `useRun.onCancel` calls
   *    `useCanceledRuns.add(runId)` and `setQueryData((prev) => prev ? ... : prev)`
   *    — leaving the cache empty.
   * 2. RunView receives `run === undefined` (cache miss) but
   *    `isRunning === true` (the parent's `submittedRunId ? !run : ...`
   *    branch).
   * 3. Without the `runId` prop, `isUserCanceled` was computed from
   *    `run?.run_id` alone — undefined when the cache is empty — so the
   *    sticky-set gate could not engage, and the Running branch rendered
   *    a "Loading..." spinner with a Cancel button for up to ~2 s until
   *    the late poll arrived. That is the original DRC-3411 "Cancel gives
   *    no UI feedback" symptom, narrowed to the pre-poll window.
   *
   * Invariant: when the caller passes `runId` and that id is in the sticky
   * cancel set, RunView MUST render Cancelled even if `run` is undefined
   * and `isRunning` is `true`.
   */
  test("renders Cancelled when runId prop is in sticky set and run is undefined (DRC-3411 pre-poll race)", () => {
    localStorage.setItem("recce:canceledRuns", JSON.stringify(["run-prepoll"]));

    renderWithProviders(
      <RunView
        runId="run-prepoll"
        run={undefined}
        // Mirrors `CheckDetailOss.tsx:145-147` after submit but before the
        // first poll: `!run` makes isRunning true.
        isRunning
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument();
  });

  /**
   * Regression for the exact production race: RunView is already mounted in
   * Running state, THEN a sibling consumer of useCanceledRuns (useRun.onCancel)
   * calls `add()`. RunView's hook instance must see the broadcast and flip to
   * Cancelled, even when the cached run.status is still "Running".
   *
   * Before the same-tab broadcast was added, each useCanceledRuns instance
   * kept its own stale ids state, so RunView's `has(run_id)` returned false
   * and the in-flight waitRun poll could revert the UI to Running.
   */
  test("flips to Cancelled when sibling component adds runId after mount (DRC-3411 broadcast)", async () => {
    function Sibling() {
      // Sibling component that holds the canceledRuns API and exposes add().
      const canceledRuns = useCanceledRuns();
      return (
        <button
          type="button"
          data-testid="sibling-add"
          onClick={() => canceledRuns.add("run-broadcast")}
        >
          add
        </button>
      );
    }

    renderWithProviders(
      <>
        <Sibling />
        <RunView
          run={
            // biome-ignore lint/suspicious/noExplicitAny: test fixture
            {
              run_id: "run-broadcast",
              status: "Running",
              type: "query",
            } as any
          }
          isRunning
          onCancel={vi.fn()}
        />
      </>,
    );

    // Initial state: RunView is in the Running branch.
    expect(screen.queryByText(/cancelled/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();

    // Sibling marks the run as user-cancelled.
    act(() => {
      fireEvent.click(screen.getByTestId("sibling-add"));
    });

    // RunView's hook instance must observe the broadcast and re-render.
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument();
  });
});
