import { describe, expect, it } from "vitest";
import type { CheckEvent } from "../../../../api/checkEvents";
import { mergeTimelineEntries } from "../CheckTimelineOss";
import type { RunEntry } from "../RunTimelineEntry";

describe("mergeTimelineEntries", () => {
  it("sorts events and runs by timestamp descending", () => {
    const events: CheckEvent[] = [
      { id: "e1", created_at: "2026-03-22T10:00:00Z" } as CheckEvent,
    ];
    const runs: RunEntry[] = [
      { run_id: "r1", run_at: "2026-03-21T09:00:00Z", status: "success" },
      { run_id: "r2", run_at: "2026-03-23T14:00:00Z", status: "failure" },
    ];

    const result = mergeTimelineEntries(events, runs);
    expect(result[0].kind).toBe("run"); // r2 (newest)
    expect(result[1].kind).toBe("event"); // e1
    expect(result[2].kind).toBe("run"); // r1 (oldest)
  });

  it("numbers runs from oldest to newest", () => {
    const runs: RunEntry[] = [
      { run_id: "r1", run_at: "2026-03-21T09:00:00Z", status: "success" },
      { run_id: "r2", run_at: "2026-03-22T10:00:00Z", status: "failure" },
    ];

    const result = mergeTimelineEntries([], runs);
    const runEntries = result.filter(
      (e): e is Extract<typeof e, { kind: "run" }> => e.kind === "run",
    );
    expect(runEntries[0].index).toBe(2); // newest run = #2 (sorted desc)
    expect(runEntries[1].index).toBe(1); // oldest run = #1
  });

  it("returns events only when no runs provided", () => {
    const events: CheckEvent[] = [
      { id: "e1", created_at: "2026-03-22T10:00:00Z" } as CheckEvent,
    ];
    const result = mergeTimelineEntries(events, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("event");
  });
});
