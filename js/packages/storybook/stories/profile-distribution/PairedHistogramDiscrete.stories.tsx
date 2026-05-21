import { PairedHistogramDiscrete } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  discreteCountryCode,
  discreteHttpStatus,
  discreteSignupSource,
  discreteTrimmedAirports,
  discreteWithGaps,
} from "./fixtures";
import { SchemaContainerMock, SchemaRowMock } from "./SchemaRowMock";

/**
 * Top-K paired histogram for categorical columns with **gap-on-absent**
 * semantics: when a value's count is 0 on one side, that bar simply
 * doesn't render, leaving a visible empty half-slot. The renderer's job
 * is to make "category present here / absent there" instantly readable
 * in 28 px of vertical space.
 *
 * GA replacement for the prototype `PairedHistogramDiscreteCell`,
 * rewritten for the PR 2 top-K payload (`values`, `base_counts`,
 * `current_counts`, `trimmed`).
 */
const meta: Meta<typeof PairedHistogramDiscrete> = {
  title: "Profile Distribution/Discrete",
  component: PairedHistogramDiscrete,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `Paired bars per category value. Base (orange) on the
left, current (blue) on the right. **Gap-on-absent**: when a value's
count is 0 on one side, the bar isn't drawn — the visible empty space
reads as "this category isn't present on that side." When the backend
had to drop a long tail past K, a tiny "trimmed" marker appears in the
upper-right corner.`,
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PairedHistogramDiscrete>;

// ---------------------------------------------------------------------
// Cell density
// ---------------------------------------------------------------------

export const CellHttpStatus: Story = {
  name: "Cell — HTTP status codes",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="response_status"
        columnType="INT"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            data={{
              values: discreteHttpStatus.values,
              baseCounts: discreteHttpStatus.base_counts,
              currentCounts: discreteHttpStatus.current_counts,
              baseTotal: discreteHttpStatus.base_total,
              currentTotal: discreteHttpStatus.current_total,
            }}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

export const CellSignupSource: Story = {
  name: "Cell — signup source (dramatic shift)",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="signup_source"
        columnType="VARCHAR"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            data={{
              values: discreteSignupSource.values,
              baseCounts: discreteSignupSource.base_counts,
              currentCounts: discreteSignupSource.current_counts,
              baseTotal: discreteSignupSource.base_total,
              currentTotal: discreteSignupSource.current_total,
            }}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

export const CellCountryCode: Story = {
  name: "Cell — country code (stable)",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="billing_country"
        columnType="VARCHAR"
        status="ok"
        distribution={
          <PairedHistogramDiscrete
            data={{
              values: discreteCountryCode.values,
              baseCounts: discreteCountryCode.base_counts,
              currentCounts: discreteCountryCode.current_counts,
              baseTotal: discreteCountryCode.base_total,
              currentTotal: discreteCountryCode.current_total,
            }}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

export const CellWithGaps: Story = {
  name: "Cell — gap-on-absent",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="cohort"
        columnType="VARCHAR"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            data={{
              values: discreteWithGaps.values,
              baseCounts: discreteWithGaps.base_counts,
              currentCounts: discreteWithGaps.current_counts,
              baseTotal: discreteWithGaps.base_total,
              currentTotal: discreteWithGaps.current_total,
            }}
          />
        }
      />
    </SchemaContainerMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Two legacy values are present only in base (gaps on the right halves of those slots); one cohort value is present only in current (gap on the left half). The pairing of empty + filled half-slots reads as 'category present on one side, absent on the other' without any text labels.",
      },
    },
  },
};

export const CellTrimmed: Story = {
  name: "Cell — trimmed top-K marker",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="origin_airport"
        columnType="VARCHAR"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            data={{
              values: discreteTrimmedAirports.values,
              baseCounts: discreteTrimmedAirports.base_counts,
              currentCounts: discreteTrimmedAirports.current_counts,
              baseTotal: discreteTrimmedAirports.base_total,
              currentTotal: discreteTrimmedAirports.current_total,
              trimmed: discreteTrimmedAirports.trimmed,
            }}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

// ---------------------------------------------------------------------
// Baseball-card density (with value labels)
// ---------------------------------------------------------------------

export const BaseballCardWithLabels: Story = {
  name: "Baseball card — with value labels",
  render: () => (
    <PairedHistogramDiscrete
      data={{
        values: discreteHttpStatus.values,
        baseCounts: discreteHttpStatus.base_counts,
        currentCounts: discreteHttpStatus.current_counts,
        baseTotal: discreteHttpStatus.base_total,
        currentTotal: discreteHttpStatus.current_total,
      }}
      width={220}
      height={100}
      showLabels
      labelMaxChars={4}
    />
  ),
};

// ---------------------------------------------------------------------
// Theme variants
// ---------------------------------------------------------------------

export const DarkTheme: Story = {
  name: "Cell — dark theme",
  render: () => (
    <SchemaContainerMock isDark title="orders.fct_order">
      <SchemaRowMock
        columnName="signup_source"
        columnType="VARCHAR"
        status="changed"
        isDark
        distribution={
          <PairedHistogramDiscrete
            theme="dark"
            data={{
              values: discreteSignupSource.values,
              baseCounts: discreteSignupSource.base_counts,
              currentCounts: discreteSignupSource.current_counts,
              baseTotal: discreteSignupSource.base_total,
              currentTotal: discreteSignupSource.current_total,
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
  name: "Empty payload (no values)",
  render: () => (
    <PairedHistogramDiscrete
      data={{
        values: [],
        baseCounts: [],
        currentCounts: [],
        baseTotal: 0,
        currentTotal: 0,
      }}
    />
  ),
};

export const ZeroTotals: Story = {
  name: "All zero counts",
  render: () => (
    <PairedHistogramDiscrete
      data={{
        values: ["a", "b", "c"],
        baseCounts: [0, 0, 0],
        currentCounts: [0, 0, 0],
        baseTotal: 0,
        currentTotal: 0,
      }}
    />
  ),
};
