import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  DiscreteBubbleUpHistogram,
  ProfileCellFrame,
} from "./BubbleUpHistogram";
import { lowCardNumericHttp } from "./fixtures";

const meta: Meta<typeof DiscreteBubbleUpHistogram> = {
  title: "Visualizations/BubbleUp/Low-Card Numeric",
  component: DiscreteBubbleUpHistogram,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `Paired baseline + current histogram for low-cardinality numeric columns where the values themselves carry semantic meaning (HTTP status codes, error codes, day-of-week ints, etc.) rather than acting as continuous samples.

**Key rule (captain's brief):** values are ordered by NUMBER, NOT by frequency, and bars are equal-width — NOT proportionally spaced by numeric distance. HTTP 200/304/404/500 sit on the same grid even though 200→304 is 104 apart and 404→500 is 96 apart. Equal spacing keeps the chart readable; proportional spacing would crush small-gap pairs.`,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DiscreteBubbleUpHistogram>;

// ============================================
// Primary: equal-width per-bucket
// ============================================

export const HttpStatusEqualWidth: Story = {
  name: "HTTP status — equal-width buckets (default)",
  render: (args) => (
    <ProfileCellFrame columnName="response_status" columnType="INT">
      <DiscreteBubbleUpHistogram {...args} />
    </ProfileCellFrame>
  ),
  args: {
    data: lowCardNumericHttp,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Six HTTP status codes, ordered numerically (200, 204, 304, 404, 500, 502). Each bucket gets equal width regardless of numeric gap. Note the dramatic 404 and 500 spikes in current vs base — easy to spot in this layout.",
      },
    },
  },
};

// ============================================
// Counterfactual: proportionally-spaced for comparison
// ============================================

/**
 * Faux "proportional" version, achieved by inserting empty padding buckets
 * between the actual values. Demonstrates why the captain's equal-spacing
 * rule wins for this data shape.
 */
const httpProportional = (() => {
  const min = 200;
  const max = 502;
  const stride = 5; // each padding bucket = 5 units
  const slots = Math.ceil((max - min) / stride) + 1;
  const buckets = Array.from({ length: slots }, (_, i) => {
    const code = min + i * stride;
    const real = lowCardNumericHttp.buckets.find(
      (b) => Math.abs(parseInt(b.value) - code) < stride / 2,
    );
    return real ?? { value: "", base_count: 0, current_count: 0 };
  });
  return {
    buckets,
    base_total: lowCardNumericHttp.base_total,
    current_total: lowCardNumericHttp.current_total,
  };
})();

export const HttpStatusProportional: Story = {
  name: "HTTP status — proportional spacing (rejected)",
  render: () => (
    <ProfileCellFrame
      columnName="response_status (proportional)"
      columnType="INT"
    >
      <DiscreteBubbleUpHistogram
        data={httpProportional}
        forceShowXAxis={false}
      />
    </ProfileCellFrame>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Same data, but if we naively proportional-spaced by numeric distance, all six values would crush to the left and the cell would look mostly empty. The 200/204 pair becomes nearly indistinguishable. This is the layout the captain's rule rejects.",
      },
    },
  },
};

// ============================================
// Side by side
// ============================================

export const SideBySide: Story = {
  name: "Equal-width vs proportional",
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 11, marginBottom: 4, color: "#374151" }}>
          Equal-width (default)
        </div>
        <ProfileCellFrame columnName="response_status" columnType="INT">
          <DiscreteBubbleUpHistogram data={lowCardNumericHttp} />
        </ProfileCellFrame>
      </div>
      <div>
        <div style={{ fontSize: 11, marginBottom: 4, color: "#374151" }}>
          Proportional spacing
        </div>
        <ProfileCellFrame columnName="response_status" columnType="INT">
          <DiscreteBubbleUpHistogram
            data={httpProportional}
            forceShowXAxis={false}
          />
        </ProfileCellFrame>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Direct comparison. Equal-width gives every bucket the same legibility; proportional buries the 404/500 spikes that are the entire point of profiling response codes.",
      },
    },
  },
};
