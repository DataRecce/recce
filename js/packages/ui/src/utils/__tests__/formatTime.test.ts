/**
 * @file formatTime.test.ts
 * @description Covers `formatTimeOfDay` — the wall-clock formatter for
 * seconds-since-midnight (DRC-3390 review note 1). Its contract differs from
 * `formatDuration("compact")`: clock times always show two-digit hours, never
 * drop the hours component, and wrap at 24h.
 */

import { describe, expect, it } from "vitest";
import { formatDuration, formatTimeOfDay } from "../formatTime";

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
