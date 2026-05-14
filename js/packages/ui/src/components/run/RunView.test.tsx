/**
 * @file run/RunView.test.tsx
 * @description Tests for RunView cancel UX (DRC-3411)
 *
 * Tests verify:
 * - Cancel button invokes onCancel callback
 * - Cancelled run status renders terminal "Cancelled" state with no spinner
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Run } from "../../api";
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
});
