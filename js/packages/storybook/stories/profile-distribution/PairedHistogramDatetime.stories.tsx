import { useIsDark } from "@datarecce/ui";
import { InlineProfileDistributionCell } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { expect, within } from "storybook/test";
import {
  continuousDatetimeDays,
  continuousDatetimeMinutes,
  continuousDatetimeSeconds,
} from "./fixtures";
import { SchemaContainerMock, SchemaRowMock } from "./SchemaRowMock";

/**
 * DRC-3670 — intra-day histogram tooltips for TIMESTAMP columns.
 *
 * `formatEpochSeconds` historically rendered DATE-ONLY (UTC), so a paired
 * histogram over a timestamp column whose values all fall inside one calendar
 * day produced the information-free tooltip **"Jun 5, 2026 – Jun 5, 2026"**.
 *
 * The fix derives the tooltip precision from the **bin-edge span** (min..max of
 * both envs' edges):
 *   - span < 1 min → date + `HH:mm:ss` (seconds scale)
 *   - span < 1 day → date + `HH:mm`    (minutes / hours scale)
 *   - span ≥ 1 day → date only         (unchanged multi-day behavior)
 *
 * These three stories render the SAME `InlineProfileDistributionCell` (so the
 * real span-selection logic runs) at the three scales. The native histogram
 * tooltip is an SVG `<title>` that only appears on hover, so for visual review
 * each story also surfaces the bars' tooltip strings as a visible list under
 * the chart — that's what a reviewer eyeballs in a screenshot. Hover any bar to
 * confirm the same text shows natively.
 */
const meta: Meta<typeof InlineProfileDistributionCell> = {
  title: "Visualizations/Profile Distribution/Datetime Intra-day Tooltips",
  component: InlineProfileDistributionCell,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof InlineProfileDistributionCell>;

/** Pull the per-bar tooltip strings out of a rendered SVG. Bar titles carry the
 * `[base: …]` proportion bracket; the chart's own aria-label `<title>` does
 * not, so this filter keeps only the edge-range tooltips. */
function readBarTooltips(root: HTMLElement | null): string[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll("title"))
    .map((t) => t.textContent ?? "")
    .filter((t) => t.includes("[base:"));
}

/**
 * Renders the real cell, then reads back the bars' `<title>` tooltips and lists
 * them under the chart so they're visible without hovering (for screenshots).
 */
function DatetimeTooltipDemo({
  payload,
  columnName,
  title,
  subtitle,
}: {
  payload: Parameters<typeof InlineProfileDistributionCell>[0]["payload"];
  columnName: string;
  title: string;
  subtitle: string;
}): ReactNode {
  const isDark = useIsDark();
  const ref = useRef<HTMLDivElement>(null);
  const [tooltips, setTooltips] = useState<string[]>([]);

  useEffect(() => {
    setTooltips(readBarTooltips(ref.current));
  }, []);

  return (
    <SchemaContainerMock title={title} subtitle={subtitle}>
      <div ref={ref}>
        <SchemaRowMock
          columnName={columnName}
          status="changed"
          distribution={
            <InlineProfileDistributionCell
              payload={payload}
              columnType="timestamp without time zone"
            />
          }
        />
      </div>
      <div
        style={{
          padding: "10px 12px",
          fontSize: 11,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: isDark ? "#cbd5e1" : "#334155",
          borderTop: isDark ? "1px solid #1f2937" : "1px solid #e5e7eb",
          background: isDark ? "#0b1220" : "#fafafa",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBottom: 6,
            color: isDark ? "#e5e7eb" : "#1f2937",
          }}
        >
          Bar tooltips ({tooltips.length})
        </div>
        {tooltips.length === 0 ? (
          <div>— no bars rendered —</div>
        ) : (
          tooltips.map((t) => (
            <div key={t} style={{ lineHeight: 1.55 }}>
              {t}
            </div>
          ))
        )}
      </div>
    </SchemaContainerMock>
  );
}

export const SecondsScale: Story = {
  name: "Seconds scale (span ≈ 11s → HH:mm:ss)",
  render: () => (
    <DatetimeTooltipDemo
      payload={continuousDatetimeSeconds}
      columnName="ingested_at"
      title="ingest_log"
      subtitle="TIMESTAMP — bin-edge span ≈ 11 seconds"
    />
  ),
  play: async ({ canvasElement }) => {
    const titles = readBarTooltips(within(canvasElement).getByRole("img"));
    // Sub-minute span → labels carry HH:mm:ss, and adjacent edges differ.
    await expect(titles.some((t) => /\d{2}:\d{2}:\d{2}/.test(t))).toBe(true);
    await expect(new Set(titles).size).toBeGreaterThan(1);
  },
};

export const MinutesScale: Story = {
  name: "Minutes scale (span ≈ 22min → HH:mm)",
  render: () => (
    <DatetimeTooltipDemo
      payload={continuousDatetimeMinutes}
      columnName="checkout_at"
      title="checkout_events"
      subtitle="TIMESTAMP — bin-edge span ≈ 22 minutes"
    />
  ),
  play: async ({ canvasElement }) => {
    const titles = readBarTooltips(within(canvasElement).getByRole("img"));
    // Span < 1 day but ≥ 1 min → HH:mm (no seconds), still distinct per edge.
    await expect(titles.some((t) => /\d{2}:\d{2}\b/.test(t))).toBe(true);
    await expect(titles.some((t) => /\d{2}:\d{2}:\d{2}/.test(t))).toBe(false);
    await expect(new Set(titles).size).toBeGreaterThan(1);
  },
};

export const DaysScale: Story = {
  name: "Days scale (span ≈ 11d → date only)",
  render: () => (
    <DatetimeTooltipDemo
      payload={continuousDatetimeDays}
      columnName="signup_date"
      title="signups"
      subtitle="TIMESTAMP — bin-edge span ≈ 11 days"
    />
  ),
  play: async ({ canvasElement }) => {
    const titles = readBarTooltips(within(canvasElement).getByRole("img"));
    // Span ≥ 1 day → date only, no clock time appended.
    await expect(titles.some((t) => /\b20\d{2}\b/.test(t))).toBe(true);
    await expect(titles.some((t) => /\d{2}:\d{2}/.test(t))).toBe(false);
  },
};
