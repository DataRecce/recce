import { PairedHistogramDiscreteCell } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { lowCardNumericHttp } from "./fixtures";
import { GalleryCardMock, GridRowMock } from "./surfaceMocks";

/**
 * Low-cardinality numeric columns where the value is a label (HTTP status,
 * error code, weekday int). Same component as the string variant — the
 * renderer treats values as labels regardless of their underlying type.
 *
 * The earlier prototype debated 'equal-width vs proportional spacing'.
 * That debate disappears here: PairedHistogramDiscreteCell only does equal-width
 * categorical slots. Numeric proximity (200 vs 204 vs 304) is the backend's
 * problem to encode in display order; the renderer just paints the slots.
 */
const meta: Meta<typeof PairedHistogramDiscreteCell> = {
  title: "Visualizations/Paired Histograms/Low-Card Numeric",
  component: PairedHistogramDiscreteCell,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `Paired baseline + current distribution for low-cardinality numeric labels (HTTP status codes here). 6 categorical slots, equal-width, current overlapped on top of base.`,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PairedHistogramDiscreteCell>;

// ============================================================
// Cell density
// ============================================================

export const CellHttpStatus: Story = {
  name: "Cell — 6 HTTP status codes",
  render: () => (
    <GridRowMock
      columnName="response_status"
      columnType="INT"
      strip={["ok", "changed", "ok", "ok", "ok"]}
      distribution={
        <PairedHistogramDiscreteCell
          data={lowCardNumericHttp}
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
          "6 status codes in a 140×36 cell. The 404 spike (220 → 1850) and 500 spike (35 → 410) read as taller blue bars where base is short — even at this density, the divergence is visible without labels.",
      },
    },
  },
};

// ============================================================
// Baseball-card density
// ============================================================

export const BaseballCardHttpStatus: Story = {
  name: "Baseball card — 6 HTTP status codes",
  render: () => (
    <GalleryCardMock
      columnName="response_status"
      columnType="INT"
      badge="impacted"
      chart={
        <PairedHistogramDiscreteCell
          data={lowCardNumericHttp}
          width={240}
          height={92}
          showLabels
          labelMaxChars={3}
        />
      }
      quads={[
        ["unique", "6"],
        ["null%", "0%"],
        ["mode", "200"],
        ["rows", "26.5K"],
      ]}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Same data at baseball-card density. Labels render below each slot (status codes fit in 3 chars). The 404/500 divergence is now obvious — the user can read 'something is failing more than before' without leaving the card.",
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
          columnName="response_status"
          columnType="INT"
          strip={["ok", "changed", "ok", "ok", "ok"]}
          distribution={
            <PairedHistogramDiscreteCell
              data={lowCardNumericHttp}
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
          columnName="response_status"
          columnType="INT"
          badge="impacted"
          chart={
            <PairedHistogramDiscreteCell
              data={lowCardNumericHttp}
              width={240}
              height={92}
              showLabels
              labelMaxChars={3}
            />
          }
          quads={[
            ["unique", "6"],
            ["null%", "0%"],
            ["mode", "200"],
            ["rows", "26.5K"],
          ]}
        />
      </div>
    </div>
  ),
};
