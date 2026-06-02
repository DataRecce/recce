/**
 * @file run/RunResultPane.test.tsx
 * @description Tests for RunResultPane sticky-cancel gating (DRC-3411)
 *
 * Tests verify:
 * - Add-to-Check / Go-to-Check buttons are hidden when the run is in the
 *   sticky cancel set, even if run.result is present (warehouse didn't
 *   honor the cancel and the backend wrote a result anyway).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Run } from "../../api";
import { RunResultPane } from "./RunResultPane";

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

// Minimal run fixture: has a result (as the late-arriving server write would)
// but the runId is in the sticky cancel set.
const RUN_ID = "run-canceled";
function makeRunWithResult(): Run {
  return {
    run_id: RUN_ID,
    type: "query",
    status: "finished",
    result: { rows: [], schema: [] },
    // biome-ignore lint/suspicious/noExplicitAny: test fixture
  } as any;
}

describe("RunResultPane sticky-cancel gating", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  test("hides Add-to-Check button when run is in sticky cancel set", () => {
    localStorage.setItem("recce:canceledRuns", JSON.stringify([RUN_ID]));

    renderWithProviders(
      <RunResultPane
        runId={RUN_ID}
        run={makeRunWithResult()}
        isRunning={false}
        onAddToChecklist={vi.fn()}
        onGoToCheck={vi.fn()}
      />,
    );

    // Neither the "Add to Checklist" nor the "Go to Check" button should
    // render — even though run.result is truthy.
    expect(
      screen.queryByRole("button", { name: /add to checklist/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /go to check/i })).toBeNull();
  });

  test("hides Go-to-Check button when run with check_id is in sticky cancel set", () => {
    localStorage.setItem("recce:canceledRuns", JSON.stringify([RUN_ID]));

    const runWithCheck = {
      ...makeRunWithResult(),
      check_id: "check-123",
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any;

    renderWithProviders(
      <RunResultPane
        runId={RUN_ID}
        run={runWithCheck}
        isRunning={false}
        onAddToChecklist={vi.fn()}
        onGoToCheck={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /go to check/i })).toBeNull();
  });

  test("shows Add-to-Checklist button for normal (non-canceled) run with result", () => {
    // Sticky set is empty — control case to prove the gating is the only thing
    // hiding the button.
    renderWithProviders(
      <RunResultPane
        runId={RUN_ID}
        run={makeRunWithResult()}
        isRunning={false}
        onAddToChecklist={vi.fn()}
        onGoToCheck={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /add to checklist/i }),
    ).toBeInTheDocument();
  });

  /**
   * Regression for the status header race observed during PR #1376 screenshot
   * verification: even with RunView gating + same-tab broadcast in place, the
   * RunStatusAndDateDisplay still rendered "Running" because it read run.status
   * directly. Late waitRun polls that write Running back into the cache must
   * not flip the visible status text once the user has cancelled locally.
   */
  test("status header shows Cancelled when run is in sticky cancel set (DRC-3411 race)", () => {
    localStorage.setItem("recce:canceledRuns", JSON.stringify([RUN_ID]));

    // Cache state mid-race: late waitRun poll has written `Running` back.
    const runWithRunningStatus = {
      run_id: RUN_ID,
      type: "query",
      status: "Running",
      run_at: new Date().toISOString(),
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any;

    renderWithProviders(
      <RunResultPane
        runId={RUN_ID}
        run={runWithRunningStatus}
        isRunning
        onAddToChecklist={vi.fn()}
        onGoToCheck={vi.fn()}
      />,
    );

    // Status header must read Cancelled, not Running.
    const headerText = document.body.textContent ?? "";
    expect(headerText).toMatch(/Cancelled/);
    expect(headerText).not.toMatch(/Running・/);
  });

  test("invokes copySelectedRows from the export menu", async () => {
    const copySelectedRows = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <RunResultPane
        runId="run-1"
        run={
          { run_id: "run-1", type: "query", result: { columns: [] } } as never
        }
        csvExport={{
          canExportCSV: true,
          copyAsCSV: vi.fn().mockResolvedValue(undefined),
          copyAsTSV: vi.fn().mockResolvedValue(undefined),
          downloadAsCSV: vi.fn(),
          copySelectedRows,
        }}
        onCopyAsImage={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /export|share/i }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: /copy selected rows/i }),
    );
    expect(copySelectedRows).toHaveBeenCalledOnce();
  });

  test("omits Copy Selected Rows when no handler is provided", async () => {
    renderWithProviders(
      <RunResultPane
        runId="run-1"
        run={
          { run_id: "run-1", type: "query", result: { columns: [] } } as never
        }
        csvExport={{
          canExportCSV: true,
          copyAsCSV: vi.fn().mockResolvedValue(undefined),
          downloadAsCSV: vi.fn(),
        }}
        onCopyAsImage={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /export|share/i }),
    );
    expect(
      screen.queryByRole("menuitem", { name: /copy selected rows/i }),
    ).toBeNull();
  });
});
