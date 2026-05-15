import { PairedHistogramContinuousCell } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { highCardOrderAmount } from "./fixtures";
import { GalleryCardMock, GridRowMock } from "./surfaceMocks";

/**
 * High-cardinality continuous columns rendered with the Paired Histograms design.
 * Uses `PairedHistogramContinuousCell` — a sibling of `PairedHistogramDiscreteCell` for
 * continuous data: same overlap-with-alpha visual, but bars touch (no slot
 * padding) and labels are endpoint min/max instead of per-slot.
 *
 * `HistogramChart` from `@datarecce/ui` is NOT used here because it
 * unconditionally renders title + legend (~50 px overhead) and cannot
 * shrink to cell density. HistogramChart still belongs in popover and
 * detail surfaces — it just isn't a cell-level component.
 */
const meta: Meta<typeof PairedHistogramContinuousCell> = {
  title: "Visualizations/Paired Histograms/High-Card Quantitative",
  component: PairedHistogramContinuousCell,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `Paired base + current continuous distribution at two render densities. 21 uniform $500 bins — backend ships uniform geometry, the renderer paints equal-width slots.`,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PairedHistogramContinuousCell>;

const formatDollars = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
};

// ============================================================
// Cell density
// ============================================================

export const CellOrderAmount: Story = {
  name: "Cell — order amount",
  render: () => (
    <GridRowMock
      columnName="order_total_usd"
      columnType="DECIMAL(10,2)"
      strip={["ok", "changed", "ok", "ok", "ok"]}
      distribution={
        <PairedHistogramContinuousCell
          data={highCardOrderAmount}
          width={140}
          height={36}
        />
      }
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "21-bin paired histogram in a 140×36 cell. The current-vs-base shift to higher amounts reads as blue extending right of where orange dominates — exactly what a 'something diverged here' cell needs to convey, without a single label.",
      },
    },
  },
};

// ============================================================
// Baseball-card density
// ============================================================

export const BaseballCardOrderAmount: Story = {
  name: "Baseball card — order amount",
  render: () => (
    <GalleryCardMock
      columnName="order_total_usd"
      columnType="DECIMAL(10,2)"
      badge="impacted"
      chart={
        <PairedHistogramContinuousCell
          data={highCardOrderAmount}
          width={240}
          height={92}
          showEndpoints
          showMidpoint
          formatValue={formatDollars}
        />
      }
      quads={[
        ["min", "$0"],
        ["max", "$10.5K"],
        ["avg", "$487 → $612"],
        ["null%", "0.1%"],
      ]}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Same 21 bins at baseball-card density (240×92) with min / midpoint / max labels. The four-quadrant stat block carries the explicit numbers: avg moved $487 → $612 ≈ +25%, which the visual confirms via the rightward weight shift.",
      },
    },
  },
};

// ============================================================
// Side-by-side comparison
// ============================================================

export const SizeComparison: Story = {
  name: "Cell vs baseball card",
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        alignItems: "flex-start",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#374151",
            marginBottom: 6,
          }}
        >
          Cell density
        </div>
        <GridRowMock
          columnName="order_total_usd"
          columnType="DECIMAL(10,2)"
          strip={["ok", "changed", "ok", "ok", "ok"]}
          distribution={
            <PairedHistogramContinuousCell
              data={highCardOrderAmount}
              width={140}
              height={36}
            />
          }
        />
      </div>
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#374151",
            marginBottom: 6,
          }}
        >
          Baseball-card density
        </div>
        <GalleryCardMock
          columnName="order_total_usd"
          columnType="DECIMAL(10,2)"
          badge="impacted"
          chart={
            <PairedHistogramContinuousCell
              data={highCardOrderAmount}
              width={240}
              height={92}
              showEndpoints
              showMidpoint
              formatValue={formatDollars}
            />
          }
          quads={[
            ["min", "$0"],
            ["max", "$10.5K"],
            ["avg", "$487 → $612"],
            ["null%", "0.1%"],
          ]}
        />
      </div>
    </div>
  ),
};
