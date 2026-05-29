import { PairedHistogramContinuous } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  continuousAddedOnly,
  continuousOrderAmount,
  continuousStable,
  toContinuousProps,
} from "./fixtures";
import { SchemaContainerMock, SchemaRowMock } from "./SchemaRowMock";

/**
 * Constant-area paired histogram for continuous columns. Heights track
 * density; widths track the bin's quantile span. The **area** of each
 * bar reads as the row-proportion in that bin — the visual property
 * that makes the chart honest under PR 2's quantile-bin payload.
 *
 * GA replacement for the prototype `PairedHistogramContinuousCell`,
 * rewritten for the new payload schema (`base_bin_edges`,
 * `current_bin_edges`, `base_density`, `current_density`). Base and current
 * carry **independent** quantile edges; the cell overlays both onto a shared
 * value axis and bars the merged edge grid. Grid-mode rendering is **out of
 * scope at GA**.
 *
 * Theme follows the storybook toolbar (light / dark) via `useIsDark()`.
 */
const meta: Meta<typeof PairedHistogramContinuous> = {
  title: "Visualizations/Profile Distribution/Continuous",
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
        status="changed"
        distribution={
          <PairedHistogramContinuous
            data={toContinuousProps(continuousOrderAmount)}
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
        status="ok"
        distribution={
          <PairedHistogramContinuous
            data={toContinuousProps(continuousStable)}
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
        status="added"
        distribution={
          <PairedHistogramContinuous
            data={toContinuousProps(continuousAddedOnly)}
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
        baseBinEdges: [],
        currentBinEdges: [],
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
        baseBinEdges: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        currentBinEdges: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
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
