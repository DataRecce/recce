import { createTheme, ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, expectTypeOf, test } from "vitest";
import type { RunStatus as ApiRunStatus, Run } from "../../api";
import {
  type RunStatus as BadgeRunStatus,
  inferRunStatus,
  RunStatusAndDate,
  RunStatusBadge,
} from "./RunStatusBadge";

const statusTheme = createTheme({
  palette: {
    error: { main: "#a61b1b" },
    primary: { main: "#1a56a3" },
    text: { secondary: "#59636e" },
  },
});

function renderWithStatusTheme(ui: ReactNode) {
  return render(<ThemeProvider theme={statusTheme}>{ui}</ThemeProvider>);
}

describe("RunStatusBadge", () => {
  test.each([
    ["Running", "Running", "#1a56a3", true],
    ["Finished", "Last computed", "#59636e", false],
    ["Failed", "Failed", "#a61b1b", false],
    ["Cancelled", "Cancelled", "#59636e", false],
  ] as const)(
    "%s renders its intended label, semantic color, and spinner state",
    (status, label, color, hasSpinner) => {
      renderWithStatusTheme(<RunStatusBadge status={status} />);

      expect(screen.getByText(label)).toHaveStyle({ color });
      expect(screen.queryByRole("progressbar") !== null).toBe(hasSpinner);
    },
  );

  test("an unexpected runtime status falls back to neutral Last computed", () => {
    renderWithStatusTheme(
      <RunStatusBadge status={"Unknown" as BadgeRunStatus} />,
    );

    expect(screen.getByText("Last computed")).toHaveStyle({
      color: "#59636e",
    });
    expect(screen.queryByText("Finished")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  test("Running can suppress its spinner without changing its label", () => {
    renderWithStatusTheme(
      <RunStatusBadge status="Running" showSpinner={false} />,
    );

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("run status inference", () => {
  test("an indeterminate run displays as neutral Last computed", () => {
    const run = {
      run_id: "run-without-signals",
      run_at: "2026-08-24T08:00:00.000Z",
      type: "query",
    } as Run;

    renderWithStatusTheme(<RunStatusAndDate run={run} />);

    expect(inferRunStatus(run)).toBe("Finished");
    expect(screen.getByText("Last computed")).toHaveStyle({
      color: "#59636e",
    });
    expect(screen.queryByText("Finished")).not.toBeInTheDocument();
  });

  test("the badge and API status types retain the same wire literals", () => {
    expectTypeOf<BadgeRunStatus>().toEqualTypeOf<ApiRunStatus>();
    expectTypeOf<BadgeRunStatus>().toEqualTypeOf<
      "Running" | "Finished" | "Failed" | "Cancelled"
    >();
  });
});
