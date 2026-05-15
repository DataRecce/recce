import {
  PairedHistogramContinuousCell,
  PairedHistogramDiscreteCell,
} from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  type DiscreteDistribution,
  highCardOrderAmount,
  lowCardNumericHttp,
  lowCardStringLarge,
  lowCardStringSmall,
  type PairedHistogram,
  trimToTopN,
} from "./fixtures";
import { SidebarMock, SidebarRowMock } from "./surfaceMocks";

/**
 * Multi-row sidebar surface — the "all columns at a glance" view.
 *
 * Shows every column in a model as one line: a status dot, the column name
 * + type, and a tiny paired-histogram chart on the right. Cell size here is even
 * tighter than the schema-grid row (~130×28) — at this density the chart
 * is a divergence signal first, distribution shape second. Hovering or
 * clicking a row would open the baseball-card detail (out of scope here).
 */
const meta: Meta = {
  title: "Visualizations/Paired Histograms/Sidebar",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `Stack of column rows in a narrow side panel. Each row pairs a column name with its paired-histogram chart at sidebar density (~130×28). Useful for the "scan many columns, jump to the interesting ones" workflow.`,
      },
    },
  },
};

export default meta;

// ---------- Inline fixtures, only for the sidebar story ----------

/** Stable continuous: base ≈ current, bell shape, low divergence. */
const stableContinuous: PairedHistogram = (() => {
  const binEdges = Array.from({ length: 22 }, (_, i) => i);
  const baseCounts = Array.from({ length: 21 }, (_, i) => {
    const x = i - 10;
    return Math.round(800 * Math.exp(-(x * x) / 16));
  });
  const currentCounts = baseCounts.map((c, i) => {
    const noise = ((i * 1103515245 + 12345) % 7) - 3;
    return Math.max(0, c + noise * 4);
  });
  return {
    binEdges,
    baseCounts,
    currentCounts,
    baseTotal: baseCounts.reduce((s, c) => s + c, 0),
    currentTotal: currentCounts.reduce((s, c) => s + c, 0),
  };
})();

/** Added column: only current, no base — entire chart is blue. */
const addedContinuous: PairedHistogram = (() => {
  const binEdges = Array.from({ length: 22 }, (_, i) => i * 100);
  const currentCounts = Array.from({ length: 21 }, (_, i) =>
    Math.round(600 * Math.exp(-((i - 6) ** 2 / 12))),
  );
  return {
    binEdges,
    baseCounts: Array(21).fill(0),
    currentCounts,
    baseTotal: 0,
    currentTotal: currentCounts.reduce((s, c) => s + c, 0),
  };
})();

/** Removed column: only base, no current — entire chart is orange. */
const removedDiscrete: DiscreteDistribution = {
  values: ["v1", "v2", "v3", "v4", "v5"],
  baseCounts: [4200, 2800, 1100, 600, 180],
  currentCounts: [0, 0, 0, 0, 0],
  baseTotal: 4200 + 2800 + 1100 + 600 + 180,
  currentTotal: 0,
};

/** Dramatic-shift discrete (5 signup sources where mobile takes over). */
const shiftedDiscrete: DiscreteDistribution = {
  values: ["web", "mobile", "api", "email", "social"],
  baseCounts: [4800, 1200, 800, 400, 220],
  currentCounts: [2400, 4500, 760, 380, 240],
  baseTotal: 4800 + 1200 + 800 + 400 + 220,
  currentTotal: 2400 + 4500 + 760 + 380 + 240,
};

// ============================================================
// Sidebar with mixed column shapes
// ============================================================

export const ColumnsSidebar: StoryObj = {
  name: "10 columns — mixed shapes",
  render: () => (
    <SidebarMock title="orders.fct_order" subtitle="10 columns · 6 changed">
      <SidebarRowMock
        columnName="user_id"
        columnType="INT"
        status="ok"
        chart={
          <PairedHistogramContinuousCell
            data={stableContinuous}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="billing_country"
        columnType="VARCHAR"
        status="changed"
        chart={
          <PairedHistogramDiscreteCell
            data={lowCardStringSmall}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="signup_source"
        columnType="VARCHAR"
        status="changed"
        chart={
          <PairedHistogramDiscreteCell
            data={shiftedDiscrete}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="order_total_usd"
        columnType="DECIMAL(10,2)"
        status="changed"
        chart={
          <PairedHistogramContinuousCell
            data={highCardOrderAmount}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="response_status"
        columnType="INT"
        status="changed"
        chart={
          <PairedHistogramDiscreteCell
            data={lowCardNumericHttp}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="origin_airport"
        columnType="VARCHAR"
        status="changed"
        chart={
          <PairedHistogramDiscreteCell
            data={trimToTopN(lowCardStringLarge, 12)}
            width={130}
            height={28}
            trimmed
          />
        }
      />
      <SidebarRowMock
        columnName="created_at"
        columnType="TIMESTAMP"
        status="ok"
        chart={
          <PairedHistogramContinuousCell
            data={stableContinuous}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="ltv_predicted"
        columnType="DECIMAL"
        status="added"
        chart={
          <PairedHistogramContinuousCell
            data={addedContinuous}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="legacy_score"
        columnType="INT"
        status="removed"
        chart={
          <PairedHistogramDiscreteCell
            data={removedDiscrete}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="email_verified"
        columnType="BOOLEAN"
        status="ok"
        chart={
          <PairedHistogramDiscreteCell
            data={{
              values: ["true", "false"],
              baseCounts: [7400, 2600],
              currentCounts: [7600, 2400],
              baseTotal: 10000,
              currentTotal: 10000,
            }}
            width={130}
            height={28}
          />
        }
      />
    </SidebarMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Ten columns at sidebar density. Status dots (gray=ok, orange=changed, green=added, red=removed) carry the at-a-glance signal; the chart confirms *what* changed for the rows where divergence matters. Notice how the all-blue `ltv_predicted` row reads as 'new column, no baseline to compare' without needing words, and the all-orange `legacy_score` reads as 'gone, what's there is what was'.",
      },
    },
  },
};

// ============================================================
// All-changed variant (focused triage view)
// ============================================================

export const ChangedOnlySidebar: StoryObj = {
  name: "Changed only — triage view",
  render: () => (
    <SidebarMock
      title="orders.fct_order — changed columns"
      subtitle="6 changes · sorted by divergence"
    >
      <SidebarRowMock
        columnName="signup_source"
        columnType="VARCHAR"
        status="changed"
        chart={
          <PairedHistogramDiscreteCell
            data={shiftedDiscrete}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="response_status"
        columnType="INT"
        status="changed"
        chart={
          <PairedHistogramDiscreteCell
            data={lowCardNumericHttp}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="order_total_usd"
        columnType="DECIMAL(10,2)"
        status="changed"
        chart={
          <PairedHistogramContinuousCell
            data={highCardOrderAmount}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="origin_airport"
        columnType="VARCHAR"
        status="changed"
        chart={
          <PairedHistogramDiscreteCell
            data={trimToTopN(lowCardStringLarge, 12)}
            width={130}
            height={28}
            trimmed
          />
        }
      />
      <SidebarRowMock
        columnName="billing_country"
        columnType="VARCHAR"
        status="changed"
        chart={
          <PairedHistogramDiscreteCell
            data={lowCardStringSmall}
            width={130}
            height={28}
          />
        }
      />
      <SidebarRowMock
        columnName="ltv_predicted"
        columnType="DECIMAL"
        status="added"
        chart={
          <PairedHistogramContinuousCell
            data={addedContinuous}
            width={130}
            height={28}
          />
        }
      />
    </SidebarMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Filtered to just the changed columns, ordered by divergence (descending). At this density a user could realistically scan 30–50 columns of a wide table; sorting by divergence puts the columns that need review at the top of the view.",
      },
    },
  },
};
