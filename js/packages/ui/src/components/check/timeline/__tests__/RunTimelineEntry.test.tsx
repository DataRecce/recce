import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type RunEntry, RunTimelineEntry } from "../RunTimelineEntry";

const baseRun: RunEntry = {
  run_id: "run-1",
  run_at: "2026-03-23T14:30:00Z",
  status: "success",
};

describe("RunTimelineEntry", () => {
  it("renders run status and timestamp", () => {
    render(<RunTimelineEntry run={baseRun} index={1} />);
    expect(screen.getByText(/Run #1/)).toBeInTheDocument();
  });

  it("renders summary when provided", () => {
    render(
      <RunTimelineEntry
        run={{ ...baseRun, summary: "30% reduction" }}
        index={1}
      />,
    );
    expect(screen.getByText("30% reduction")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<RunTimelineEntry run={baseRun} index={1} onClick={onClick} />);
    screen.getByText(/Run #1/).click();
    expect(onClick).toHaveBeenCalledWith("run-1");
  });
});
