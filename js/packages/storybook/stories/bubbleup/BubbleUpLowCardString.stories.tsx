import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  DiscreteBubbleUpHistogram,
  ProfileCellFrame,
} from "./BubbleUpHistogram";
import { lowCardStringLarge, lowCardStringSmall } from "./fixtures";

const meta: Meta<typeof DiscreteBubbleUpHistogram> = {
  title: "Visualizations/BubbleUp/Low-Card String",
  component: DiscreteBubbleUpHistogram,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `Paired baseline + current histogram for low-cardinality string columns.

**Cardinality rules (from captain's brief):**
- Buckets ordered by descending baseline frequency.
- ≤40 distinct values → render with X-axis labels.
- 40 < N ≤ 75 → drop the X axis (labels would collide), keep all bars.
- N > 75 → trim to top-N baseline + outliers (current/base proportion delta), append "trimmed" indicator.

Caller is responsible for the ordering. Component does not re-sort.`,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DiscreteBubbleUpHistogram>;

// ============================================
// Cardinality variants
// ============================================

export const SmallWithXAxis: Story = {
  name: "12 values — X axis shown",
  render: (args) => (
    <ProfileCellFrame columnName="billing_country" columnType="VARCHAR">
      <DiscreteBubbleUpHistogram {...args} />
    </ProfileCellFrame>
  ),
  args: {
    data: lowCardStringSmall,
  },
  parameters: {
    docs: {
      description: {
        story:
          "12 country codes — well under the 40-value threshold. X-axis labels render with auto-stride to avoid collision.",
      },
    },
  },
};

export const LargeTrimmedNoAxis: Story = {
  name: "92 values — trimmed, no X axis",
  render: (args) => (
    <ProfileCellFrame columnName="origin_airport" columnType="VARCHAR">
      <DiscreteBubbleUpHistogram {...args} />
    </ProfileCellFrame>
  ),
  args: {
    data: lowCardStringLarge,
  },
  parameters: {
    docs: {
      description: {
        story:
          "92 airport codes. Component trims to top-30 baseline + 10 outliers (proportion-delta), drops X axis, appends 'trimmed' marker. Outliers at indexes 47 (6× spike), 70 (95% drop), 85 (12× spike) survive trimming.",
      },
    },
  },
};

export const LargeNoTrimComparison: Story = {
  name: "92 values — no-trim comparison",
  render: (args) => (
    <ProfileCellFrame columnName="origin_airport (full)" columnType="VARCHAR">
      <DiscreteBubbleUpHistogram {...args} />
    </ProfileCellFrame>
  ),
  args: {
    data: lowCardStringLarge,
    forceNoTrim: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Same 92-value data with trimming disabled. Bars compress to ~2.4px each — illustrates why trimming exists. Outliers at the tail are nearly invisible.",
      },
    },
  },
};

export const SideBySide: Story = {
  name: "Trimmed vs no-trim, side by side",
  render: () => (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 11, marginBottom: 4, color: "#374151" }}>
          Trimmed (default)
        </div>
        <ProfileCellFrame columnName="origin_airport" columnType="VARCHAR">
          <DiscreteBubbleUpHistogram data={lowCardStringLarge} />
        </ProfileCellFrame>
      </div>
      <div>
        <div style={{ fontSize: 11, marginBottom: 4, color: "#374151" }}>
          All 92 values
        </div>
        <ProfileCellFrame columnName="origin_airport" columnType="VARCHAR">
          <DiscreteBubbleUpHistogram
            data={lowCardStringLarge}
            forceNoTrim={true}
          />
        </ProfileCellFrame>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Direct visual comparison: trimmed (top-30 base + 10 outliers) vs all 92 values. The 'trimmed' marker tells the user the chart is curated, not a full distribution.",
      },
    },
  },
};
