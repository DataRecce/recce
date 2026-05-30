/**
 * @file run/RunList.test.tsx
 * @description Tests for RunListItem sticky-cancel status override (DRC-3411)
 *
 * Tests verify:
 * - When a run's id is in the sticky cancel set, the row renders "Cancelled"
 *   status even if the source data says "Running" or "Finished".
 * - Control: when the sticky set is empty, the source status renders as-is.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { RunListItem } from "./RunList";

describe("RunListItem sticky-cancel override", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  test("renders Cancelled status when id is in sticky cancel set", () => {
    localStorage.setItem(
      "recce:canceledRuns",
      JSON.stringify(["run-canceled"]),
    );
    render(
      <RunListItem
        run={{
          id: "run-canceled",
          status: "Running",
          type: "query",
        }}
      />,
    );
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    expect(screen.queryByText(/^running$/i)).toBeNull();
  });

  test("renders source status when id is not in sticky cancel set", () => {
    render(
      <RunListItem
        run={{
          id: "run-canceled",
          status: "Running",
          type: "query",
        }}
      />,
    );
    expect(screen.getByText(/running/i)).toBeInTheDocument();
    expect(screen.queryByText(/cancelled/i)).toBeNull();
  });
});
