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
});
