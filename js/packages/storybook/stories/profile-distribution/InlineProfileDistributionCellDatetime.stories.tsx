import { InlineProfileDistributionCell } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { continuousEventTime, continuousStable } from "./fixtures";
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

const tooltips = (canvasElement: HTMLElement) =>
  Array.from(
    within(canvasElement).getByRole("img").querySelectorAll("title"),
  ).map((t) => t.textContent ?? "");

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
            payload={continuousEventTime}
            columnType="time"
          />
        }
      />
    </SchemaContainerMock>
  ),
  play: async ({ canvasElement }) => {
    const titles = tooltips(canvasElement);
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
            payload={continuousStable}
            columnType="timestamp without time zone"
          />
        }
      />
    </SchemaContainerMock>
  ),
  play: async ({ canvasElement }) => {
    const titles = tooltips(canvasElement);
    // A "timestamp" type still date-formats (contains a year), proving it is
    // not mis-classified as a clock time.
    await expect(titles.some((t) => /\b20\d{2}\b/.test(t))).toBe(true);
  },
};
