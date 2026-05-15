import { PairedHistogramDiscreteCell } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { lowCardStringLarge, lowCardStringSmall, trimToTopN } from "./fixtures";
import { GalleryCardMock, GridRowMock } from "./surfaceMocks";

/**
 * Low-cardinality string columns rendered with the Paired Histograms design.
 * Two render targets: cell-density inside the schema-grid row, baseball-card
 * density inside the gallery card. Both use the same `PairedHistogramDiscreteCell`
 * component — only width/height/showLabels differ.
 *
 * Why a new component (vs. shrinking TopKBarChart): TopKBarChart is a list,
 * one row per value at ~46 px tall. Cell density requires N values in ~40 px
 * total height — a horizontal bar layout, not vertical. The TopK list view
 * still has its place (popovers, detail panels), but it does not shrink
 * to a cell.
 */
const meta: Meta<typeof PairedHistogramDiscreteCell> = {
  title: "Visualizations/Paired Histograms/Low-Card String",
  component: PairedHistogramDiscreteCell,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `Paired baseline + current categorical distribution at two render densities. Visual treatment: orange (base) + blue (current), both at 65% alpha, current drawn on top. Divergence reads as color separation.`,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PairedHistogramDiscreteCell>;

// ============================================================
// Cell density (schema-grid row)
// ============================================================

export const CellSmall: Story = {
  name: "Cell — 12 country codes",
  render: () => (
    <GridRowMock
      columnName="billing_country"
      columnType="VARCHAR"
      strip={["ok", "ok", "changed", "ok", "ok"]}
      distribution={
        <PairedHistogramDiscreteCell
          data={lowCardStringSmall}
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
          "12 country codes in a 140×36 px cell, embedded in a mock schema-grid row. No labels — at this density, the chart signals 'something here, click for details' rather than 'here are the values'. Slot width is ~11 px per pair, bars are 80% of slot.",
      },
    },
  },
};

export const CellTrimmed: Story = {
  name: "Cell — 92 → top-12 (trimmed)",
  render: () => (
    <GridRowMock
      columnName="origin_airport"
      columnType="VARCHAR"
      strip={["ok", "ok", "ok", "changed", "ok"]}
      distribution={
        <PairedHistogramDiscreteCell
          data={trimToTopN(lowCardStringLarge, 12)}
          width={140}
          height={36}
          trimmed
        />
      }
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "92-value distribution trimmed to top-12 by max(baseProp, currProp), preserving original frequency-desc order. The faint 'trimmed' marker tells the user the chart is curated, not the full distribution. Outlier values that fall outside the top-12 are surfaced in a separate 'shifted values' panel (out of scope here).",
      },
    },
  },
};

// ============================================================
// Baseball-card density (SchemaGalleryView card)
// ============================================================

export const BaseballCardSmall: Story = {
  name: "Baseball card — 12 country codes",
  render: () => (
    <GalleryCardMock
      columnName="billing_country"
      columnType="VARCHAR"
      badge="impacted"
      chart={
        <PairedHistogramDiscreteCell
          data={lowCardStringSmall}
          width={240}
          height={92}
          showLabels
          labelMaxChars={3}
        />
      }
      quads={[
        ["unique", "12"],
        ["null%", "0.4%"],
        ["mode", "US"],
        ["rows", "8.0K"],
      ]}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "12-value distribution at baseball-card density (240×92 px). Value labels render below each pair (truncated to 3 chars). The card frames the chart with column metadata and a four-quadrant stat block — the chart is the primary signal, the stats answer follow-up questions.",
      },
    },
  },
};

export const BaseballCardTrimmed: Story = {
  name: "Baseball card — 92 → top-12 (trimmed)",
  render: () => (
    <GalleryCardMock
      columnName="origin_airport"
      columnType="VARCHAR"
      badge="impacted"
      chart={
        <PairedHistogramDiscreteCell
          data={trimToTopN(lowCardStringLarge, 12)}
          width={240}
          height={92}
          showLabels
          labelMaxChars={4}
          trimmed
        />
      }
      quads={[
        ["unique", "92"],
        ["null%", "1.2%"],
        ["mode", "ai..001"],
        ["rows", "92.4K"],
      ]}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Trimmed top-12 of a 92-value distribution at baseball-card density. The 'trimmed' marker remains; labels show the airport_NNN values truncated. A 'view all 92' affordance would belong somewhere on this card (not implemented in this exploration).",
      },
    },
  },
};

// ============================================================
// Side-by-side: cell vs baseball card (the same data)
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
          Cell density (schema-grid row)
        </div>
        <GridRowMock
          columnName="billing_country"
          columnType="VARCHAR"
          strip={["ok", "ok", "changed", "ok", "ok"]}
          distribution={
            <PairedHistogramDiscreteCell
              data={lowCardStringSmall}
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
          Baseball-card density (gallery card)
        </div>
        <GalleryCardMock
          columnName="billing_country"
          columnType="VARCHAR"
          badge="impacted"
          chart={
            <PairedHistogramDiscreteCell
              data={lowCardStringSmall}
              width={240}
              height={92}
              showLabels
              labelMaxChars={3}
            />
          }
          quads={[
            ["unique", "12"],
            ["null%", "0.4%"],
            ["mode", "US"],
            ["rows", "8.0K"],
          ]}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "The same `billing_country` column at both render targets. Cell density (top) is the 'something diverged here' signal; baseball-card density (bottom) is the 'here's what diverged' answer. Same component, two presets.",
      },
    },
  },
};
