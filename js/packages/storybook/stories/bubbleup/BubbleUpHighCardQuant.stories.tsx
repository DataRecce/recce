import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ContinuousBubbleUpHistogram,
  ProfileCellFrame,
} from "./BubbleUpHistogram";
import { highCardOrderAmount } from "./fixtures";

const meta: Meta<typeof ContinuousBubbleUpHistogram> = {
  title: "Visualizations/BubbleUp/High-Card Quantitative",
  component: ContinuousBubbleUpHistogram,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `Paired baseline + current continuous histogram for high-cardinality numeric columns (order amounts, page-load latency, cohort sizes, etc.).

**Layout choice (captain's brief):** baseline and current bars OVERLAP — they share the same x-extent. Current is drawn translucent ON TOP of base so divergence is visible without doubling the cell width. The "side-by-side" layout exists in this file only to demonstrate why overlap won.

Bars are positioned by bin midpoint and sized by bin width — bins are NOT equal-width (a bin from 0–50 and a bin from 9000–9500 carry different visual weights, matching their data extent).`,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContinuousBubbleUpHistogram>;

// ============================================
// Primary: overlapped (default)
// ============================================

export const OverlappedDefault: Story = {
  name: "Order amount — overlapped (default)",
  render: (args) => (
    <ProfileCellFrame columnName="order_total_usd" columnType="DECIMAL(10,2)">
      <ContinuousBubbleUpHistogram {...args} />
    </ProfileCellFrame>
  ),
  args: {
    data: highCardOrderAmount,
    layout: "overlapped",
  },
  parameters: {
    docs: {
      description: {
        story:
          "27 variable-width bins spanning $0–$10,100. Current shifts ~$200 higher than base; the orange (base) and blue (current) overlap, making the divergence obvious without expanding the cell.",
      },
    },
  },
};

// ============================================
// Counterfactual: side-by-side (rejected)
// ============================================

export const SideBySideLayout: Story = {
  name: "Order amount — side-by-side (rejected)",
  render: (args) => (
    <ProfileCellFrame
      columnName="order_total_usd (side-by-side)"
      columnType="DECIMAL(10,2)"
    >
      <ContinuousBubbleUpHistogram {...args} />
    </ProfileCellFrame>
  ),
  args: {
    data: highCardOrderAmount,
    layout: "side-by-side",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Same data, side-by-side layout: every bin gets split into a base half and a current half. At cell density (~220px) each pair of half-bars is ~3px, the orange/blue alternation reads as noise, and the small distribution shift is harder to spot than in overlap.",
      },
    },
  },
};

// ============================================
// Side-by-side comparison
// ============================================

export const OverlappedVsSideBySide: Story = {
  name: "Overlapped vs Side-by-Side",
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 11, marginBottom: 4, color: "#374151" }}>
          Overlapped (default)
        </div>
        <ProfileCellFrame columnName="order_total_usd" columnType="DECIMAL">
          <ContinuousBubbleUpHistogram
            data={highCardOrderAmount}
            layout="overlapped"
          />
        </ProfileCellFrame>
      </div>
      <div>
        <div style={{ fontSize: 11, marginBottom: 4, color: "#374151" }}>
          Side-by-side
        </div>
        <ProfileCellFrame columnName="order_total_usd" columnType="DECIMAL">
          <ContinuousBubbleUpHistogram
            data={highCardOrderAmount}
            layout="side-by-side"
          />
        </ProfileCellFrame>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Overlap reads as 'where they differ, current is on top in blue'. Side-by-side reads as 'two interleaved series', which costs an extra mental step at cell density.",
      },
    },
  },
};

// ============================================
// Edge case: no x-axis (super dense layouts)
// ============================================

export const NoAxis: Story = {
  name: "Order amount — no axis",
  render: (args) => (
    <ProfileCellFrame columnName="order_total_usd" columnType="DECIMAL(10,2)">
      <ContinuousBubbleUpHistogram {...args} />
    </ProfileCellFrame>
  ),
  args: {
    data: highCardOrderAmount,
    showXAxis: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When the cell shrinks (e.g. embedded in a tight grid), the X axis can be suppressed. Hover/click would surface bin ranges in the real implementation.",
      },
    },
  },
};
