import { InlineProfileDistributionCell } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { SchemaContainerMock, SchemaRowMock } from "./SchemaRowMock";

/**
 * Continuous tooltip formatting by column type (DRC-3390 review note 1).
 *
 * The backend wraps datetime columns in an `epoch()` cast before binning, but
 * the numeric edges mean different things per type:
 *   - `DATE` / `TIMESTAMP` / `DATETIME` → **seconds since the Unix epoch** →
 *     formatted as a calendar date.
 *   - `TIME` → **seconds since midnight** (0–86399) → formatted as an `HH:MM:SS`
 *     clock time. Running these through the date formatter collapsed every
 *     tooltip edge to "Jan 1, 1970"; this story locks in the clock-time path.
 *
 * Hover any bar to see the range tooltip (`<title>`); the play functions assert
 * the format programmatically.
 */
const meta: Meta<typeof InlineProfileDistributionCell> = {
  title: "Visualizations/Profile Distribution/Datetime Tooltips",
  component: InlineProfileDistributionCell,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof InlineProfileDistributionCell>;

const HOUR = 3600;

/** Per-bin proportions → constant-area densities for a fixed-span edge grid. */
function densitiesFor(edges: number[], proportions: number[]): number[] {
  return proportions.map((p, i) => {
    const span = edges[i + 1] - edges[i];
    return span > 0 ? p / span : 0;
  });
}

// TIME column: edges are seconds-since-midnight (every two hours across the
// day), with an activity bump around midday — the shape `epoch(TIME)` emits.
const timeEdges = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map(
  (h) => h * HOUR,
);
const timeProportions = [
  0.01, 0.02, 0.04, 0.08, 0.13, 0.19, 0.18, 0.13, 0.1, 0.07, 0.05,
];
const currentTimeProportions = [
  0.02, 0.03, 0.05, 0.09, 0.14, 0.18, 0.16, 0.12, 0.1, 0.07, 0.04,
];
const timeOfDayHistogram = {
  kind: "histogram" as const,
  base_bin_edges: timeEdges,
  current_bin_edges: timeEdges,
  base_density: densitiesFor(timeEdges, timeProportions),
  current_density: densitiesFor(timeEdges, currentTimeProportions),
  base_total: 5000,
  current_total: 5200,
};

// TIMESTAMP column: edges are Unix-epoch seconds (one day apart from
// 2021-01-01). `timestamp` contains the substring "time" but must NOT be read
// as a clock time.
const tsStart = 1609459200; // 2021-01-01T00:00:00Z
const tsEdges = Array.from({ length: 12 }, (_, i) => tsStart + i * 86400);
const timestampHistogram = {
  kind: "histogram" as const,
  base_bin_edges: tsEdges,
  current_bin_edges: tsEdges,
  base_density: densitiesFor(tsEdges, timeProportions),
  current_density: densitiesFor(tsEdges, currentTimeProportions),
  base_total: 5000,
  current_total: 5200,
};

export const TimeColumn: Story = {
  name: "TIME — clock-time tooltips",
  render: () => (
    <SchemaContainerMock
      title="events"
      subtitle="TIME column — edges are seconds since midnight"
    >
      <SchemaRowMock
        columnName="event_time"
        status="changed"
        distribution={
          <InlineProfileDistributionCell
            payload={timeOfDayHistogram}
            columnType="time"
          />
        }
      />
    </SchemaContainerMock>
  ),
  play: async ({ canvasElement }) => {
    const titles = Array.from(
      within(canvasElement).getByRole("img").querySelectorAll("title"),
    ).map((t) => t.textContent ?? "");
    // Tooltips read as HH:MM:SS clock times, never the bogus 1970 epoch date.
    await expect(titles.some((t) => /\d{2}:\d{2}:\d{2}/.test(t))).toBe(true);
    await expect(titles.some((t) => t.includes("1970"))).toBe(false);
  },
};

export const TimestampColumn: Story = {
  name: "TIMESTAMP — calendar-date tooltips",
  render: () => (
    <SchemaContainerMock
      title="orders"
      subtitle="TIMESTAMP column — edges are Unix-epoch seconds"
    >
      <SchemaRowMock
        columnName="created_at"
        status="changed"
        distribution={
          <InlineProfileDistributionCell
            payload={timestampHistogram}
            columnType="timestamp without time zone"
          />
        }
      />
    </SchemaContainerMock>
  ),
  play: async ({ canvasElement }) => {
    const titles = Array.from(
      within(canvasElement).getByRole("img").querySelectorAll("title"),
    ).map((t) => t.textContent ?? "");
    // A "timestamp" type still date-formats (contains the year), proving it is
    // not mis-classified as a clock time.
    await expect(titles.some((t) => t.includes("2021"))).toBe(true);
  },
};
