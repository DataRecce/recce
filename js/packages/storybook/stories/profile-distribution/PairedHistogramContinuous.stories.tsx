import { PairedHistogramContinuous } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  continuousAddedOnly,
  continuousOrderAmount,
  continuousStable,
} from "./fixtures";
import { SchemaContainerMock, SchemaRowMock } from "./SchemaRowMock";

/**
 * Constant-area paired histogram for continuous columns. Heights track
 * density; widths track the bin's quantile span. The **area** of each
 * bar reads as the row-proportion in that bin — the visual property
 * that makes the chart honest under PR 2's quantile-bin payload.
 *
 * GA replacement for the prototype `PairedHistogramContinuousCell`,
 * rewritten for the new payload schema (`bin_edges`, `base_density`,
 * `current_density`). Grid-mode rendering is **out of scope at GA**.
 */
const meta: Meta<typeof PairedHistogramContinuous> = {
  title: "Profile Distribution/Continuous",
  component: PairedHistogramContinuous,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `Constant-area paired bars (one slot per quantile bin).
Bar **area** = density × span = proportion of rows in that bin. The
agreement zone (min of the two densities) uses a 50/50 checkerboard so
it reads as "both distributions cover this bin equally"; the differential
is then drawn on top in the dominant side's color (blue = current taller,
orange = base taller).`,
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PairedHistogramContinuous>;

// ---------------------------------------------------------------------
// Cell-density (the GA target)
// ---------------------------------------------------------------------

export const CellOrderAmount: Story = {
  name: "Cell — order amount",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="order_total_usd"
        columnType="DECIMAL(10,2)"
        status="changed"
        distribution={
          <PairedHistogramContinuous
            data={{
              binEdges: continuousOrderAmount.bin_edges,
              baseDensity: continuousOrderAmount.base_density,
              currentDensity: continuousOrderAmount.current_density,
              baseTotal: continuousOrderAmount.base_total,
              currentTotal: continuousOrderAmount.current_total,
            }}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

export const CellStable: Story = {
  name: "Cell — stable (low divergence)",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="created_at"
        columnType="TIMESTAMP"
        status="ok"
        distribution={
          <PairedHistogramContinuous
            data={{
              binEdges: continuousStable.bin_edges,
              baseDensity: continuousStable.base_density,
              currentDensity: continuousStable.current_density,
              baseTotal: continuousStable.base_total,
              currentTotal: continuousStable.current_total,
            }}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

export const CellAddedColumn: Story = {
  name: "Cell — added column (no base)",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="ltv_predicted"
        columnType="DECIMAL"
        status="added"
        distribution={
          <PairedHistogramContinuous
            data={{
              binEdges: continuousAddedOnly.bin_edges,
              baseDensity: continuousAddedOnly.base_density,
              currentDensity: continuousAddedOnly.current_density,
              baseTotal: continuousAddedOnly.base_total,
              currentTotal: continuousAddedOnly.current_total,
            }}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

// ---------------------------------------------------------------------
// Baseball-card density (popover surface — defined here for symmetry)
// ---------------------------------------------------------------------

export const BaseballCardOrderAmount: Story = {
  name: "Baseball card — endpoint + midpoint labels",
  render: () => (
    <PairedHistogramContinuous
      data={{
        binEdges: continuousOrderAmount.bin_edges,
        baseDensity: continuousOrderAmount.base_density,
        currentDensity: continuousOrderAmount.current_density,
        baseTotal: continuousOrderAmount.base_total,
        currentTotal: continuousOrderAmount.current_total,
      }}
      width={240}
      height={92}
      showEndpoints
      showMidpoint
    />
  ),
};

// ---------------------------------------------------------------------
// Theme variants (chromatic / visual regression)
// ---------------------------------------------------------------------

export const DarkTheme: Story = {
  name: "Cell — dark theme",
  render: () => (
    <SchemaContainerMock isDark title="orders.fct_order">
      <SchemaRowMock
        columnName="order_total_usd"
        columnType="DECIMAL(10,2)"
        status="changed"
        isDark
        distribution={
          <PairedHistogramContinuous
            theme="dark"
            data={{
              binEdges: continuousOrderAmount.bin_edges,
              baseDensity: continuousOrderAmount.base_density,
              currentDensity: continuousOrderAmount.current_density,
              baseTotal: continuousOrderAmount.base_total,
              currentTotal: continuousOrderAmount.current_total,
            }}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

// ---------------------------------------------------------------------
// Edge / degenerate inputs
// ---------------------------------------------------------------------

export const EmptyPayload: Story = {
  name: "Empty payload (no bins)",
  render: () => (
    <PairedHistogramContinuous
      data={{
        binEdges: [],
        baseDensity: [],
        currentDensity: [],
        baseTotal: 0,
        currentTotal: 0,
      }}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "An empty payload (PR 2 may emit this transiently before the column probe completes). The SVG frame is preserved so adjacent rows don't reflow.",
      },
    },
  },
};

export const DegenerateRange: Story = {
  name: "Degenerate range (all edges collapsed)",
  render: () => (
    <PairedHistogramContinuous
      data={{
        binEdges: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        baseDensity: Array(11).fill(0.1),
        currentDensity: Array(11).fill(0.15),
        baseTotal: 10,
        currentTotal: 12,
      }}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Constant column (every value identical) — the renderer falls back to uniform-width slots so something is still visible.",
      },
    },
  },
};
