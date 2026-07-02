/**
 * @file formatTime.test.ts
 * @description Covers `formatTimeOfDay` — the wall-clock formatter for
 * seconds-since-midnight. Its contract differs from `formatDuration("compact")`:
 * clock times always show two-digit hours, never drop the hours component, and
 * wrap at 24h. Also covers `formatEpochSeconds`, whose load-bearing detail is
 * that it renders in UTC (so day-boundary edges don't shift to the host's
 * local calendar day).
 */

import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatEpochSeconds,
  formatTimeOfDay,
} from "../formatTime";

describe("formatTimeOfDay", () => {
  it("formats whole hours as zero-padded HH:MM:SS", () => {
    expect(formatTimeOfDay(0)).toBe("00:00:00");
    expect(formatTimeOfDay(3600)).toBe("01:00:00");
    expect(formatTimeOfDay(22 * 3600)).toBe("22:00:00");
  });

  it("keeps the hours component even before noon (unlike a duration)", () => {
    // 00:05:30 — a duration would render "5:30"; a clock time must not.
    expect(formatTimeOfDay(330)).toBe("00:05:30");
    expect(formatDuration(330, "compact")).toBe("5:30");
  });

  it("includes minutes and seconds", () => {
    expect(formatTimeOfDay(13 * 3600 + 45 * 60 + 9)).toBe("13:45:09");
  });

  it("wraps at 24h and floors fractional seconds", () => {
    expect(formatTimeOfDay(86400)).toBe("00:00:00"); // exactly midnight next day
    expect(formatTimeOfDay(3600.9)).toBe("01:00:00"); // sub-second precision dropped
  });

  it("normalizes slightly-negative sketch noise into a real clock time", () => {
    // APPROX_PERCENTILE can emit an edge just below the empirical min; wrap it
    // rather than render "-1:00:-5".
    expect(formatTimeOfDay(-5)).toBe("23:59:55");
    expect(formatTimeOfDay(-3600)).toBe("23:00:00");
  });

  it("passes non-finite input through as a string", () => {
    expect(formatTimeOfDay(Number.NaN)).toBe("NaN");
    expect(formatTimeOfDay(Number.POSITIVE_INFINITY)).toBe("Infinity");
  });
});

describe("formatEpochSeconds", () => {
  // 2021-01-01T00:00:00Z and 2021-01-01T23:00:00Z — the same UTC calendar day.
  const startOfDayUtc = 1609459200;
  const endOfDayUtc = startOfDayUtc + 23 * 3600;

  it("collapses a day's edges to one date when time is omitted (multi-day default)", () => {
    // Both timestamps are the same day in UTC, so date-only formatting renders
    // them identically — the correct behavior for a histogram whose bin-edge
    // span is ≥ 1 day (AC5). The `timeZone: "UTC"` pin is what keeps them on a
    // single calendar day; without it they'd split across two local days on any
    // host with a non-zero UTC offset.
    expect(formatEpochSeconds(endOfDayUtc)).toBe(
      formatEpochSeconds(startOfDayUtc),
    );
  });

  it("renders distinct HH:mm labels for intra-day edges (includeTime=true)", () => {
    // 14:32 vs 14:35 on the same UTC day. Date-only collapses these to one
    // information-free "Jan 1, 2021 – Jan 1, 2021" range; the minute-scale time
    // variant keeps adjacent edges distinct (AC4).
    const t1 = startOfDayUtc + 14 * 3600 + 32 * 60;
    const t2 = startOfDayUtc + 14 * 3600 + 35 * 60;
    const a = formatEpochSeconds(t1, true);
    const b = formatEpochSeconds(t2, true);
    expect(a).not.toBe(b);
    expect(a).toContain("14:32");
    expect(b).toContain("14:35");
    // Still carries the date prefix — the time is appended, not a replacement.
    expect(a).toContain("2021");
  });

  it("renders distinct HH:mm:ss labels for second-scale edges (includeTime='seconds')", () => {
    // 00:00:05 vs 00:00:09 — only a second apart. The minute variant would
    // collapse both to "00:00"; the seconds variant keeps them distinct (AC4).
    const a = formatEpochSeconds(startOfDayUtc + 5, "seconds");
    const b = formatEpochSeconds(startOfDayUtc + 9, "seconds");
    expect(a).not.toBe(b);
    expect(a).toContain("00:00:05");
    expect(b).toContain("00:00:09");
  });

  it("reads the appended time in UTC, not the host-local zone (AC6)", () => {
    // 23:00 UTC. A local-tz clock would print a different hour on any host with
    // a non-zero offset, and could even disagree with the UTC calendar day.
    expect(formatEpochSeconds(endOfDayUtc, true)).toContain("23:00");
  });

  it("renders the correct UTC calendar day (not the host-local one)", () => {
    const out = formatEpochSeconds(startOfDayUtc);
    expect(out).toContain("2021");
    // Never the previous day west of UTC.
    expect(out).not.toContain("2020");
  });

  it("returns the raw seconds as a string for a non-finite input", () => {
    expect(formatEpochSeconds(Number.NaN)).toBe("NaN");
  });
});
