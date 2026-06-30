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
 * The fix derives the tooltip precision from the **smallest adjacent gap** in
 * the merged base∪current edge set (NOT the total span — DRC-3670 should-fix
 * #1, so sub-minute segments inside a wider span stay distinct):
 *   - min gap < 1 min → date + `HH:mm:ss` (seconds scale)
 *   - min gap < 1 day → date + `HH:mm`    (minutes / hours scale)
 *   - min gap ≥ 1 day → date only         (unchanged multi-day behavior)
 *
 * These three stories render the SAME `InlineProfileDistributionCell` (so the
 * real precision-selection logic runs) at the three scales. The native histogram
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

interface DemoProps {
  payload: Parameters<typeof InlineProfileDistributionCell>[0]["payload"];
  columnName: string;
  title: string;
  subtitle: string;
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
}: DemoProps): ReactNode {
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

/**
 * One story per scale: same demo component, differing only by fixture/labels and
 * the precision the merged-edge min-gap should produce. `precision` drives the
 * play assertions so each scale stays a single declarative object.
 */
function makeDatetimeStory(
  cfg: DemoProps & {
    name: string;
    precision: "seconds" | "minutes" | "days";
  },
): Story {
  const { name, precision, ...demo } = cfg;
  return {
    name,
    render: () => <DatetimeTooltipDemo {...demo} />,
    play: async ({ canvasElement }) => {
      const titles = readBarTooltips(within(canvasElement).getByRole("img"));
      const has = (re: RegExp) => titles.some((t) => re.test(t));
      const distinct = () => expect(new Set(titles).size).toBeGreaterThan(1);
      if (precision === "seconds") {
        // Sub-minute min gap → HH:mm:ss, adjacent edges differ.
        await expect(has(/\d{2}:\d{2}:\d{2}/)).toBe(true);
        distinct();
      } else if (precision === "minutes") {
        // Min gap ≥ 1 min but < 1 day → HH:mm (no seconds), distinct per edge.
        await expect(has(/\d{2}:\d{2}\b/)).toBe(true);
        await expect(has(/\d{2}:\d{2}:\d{2}/)).toBe(false);
        distinct();
      } else {
        // Min gap ≥ 1 day → date only, no clock time appended.
        await expect(has(/\b20\d{2}\b/)).toBe(true);
        await expect(has(/\d{2}:\d{2}/)).toBe(false);
      }
    },
  };
}

export const SecondsScale = makeDatetimeStory({
  name: "Seconds scale (1s gaps → HH:mm:ss)",
  payload: continuousDatetimeSeconds,
  columnName: "ingested_at",
  title: "ingest_log",
  subtitle: "TIMESTAMP — adjacent edges ≈ 1 second apart",
  precision: "seconds",
});

export const MinutesScale = makeDatetimeStory({
  name: "Minutes scale (60s gaps → HH:mm)",
  payload: continuousDatetimeMinutes,
  columnName: "checkout_at",
  title: "checkout_events",
  subtitle: "TIMESTAMP — adjacent edges ≈ 1 minute apart",
  precision: "minutes",
});

export const DaysScale = makeDatetimeStory({
  name: "Days scale (1d gaps → date only)",
  payload: continuousDatetimeDays,
  columnName: "signup_date",
  title: "signups",
  subtitle: "TIMESTAMP — adjacent edges ≈ 1 day apart",
  precision: "days",
});
