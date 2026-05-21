import {
  InlineProfileDistributionCell,
  ProfileDistributionUnsupportedBanner,
} from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Fragment } from "react";
import {
  continuousAddedOnly,
  continuousOrderAmount,
  continuousStable,
  discreteCountryCode,
  discreteHttpStatus,
  discreteSignupSource,
  discreteTrimmedAirports,
  discreteWithGaps,
  mixedTaskResult,
  nullPayload,
  unsupportedResult,
} from "./fixtures";
import { SchemaContainerMock, SchemaRowMock } from "./SchemaRowMock";

/**
 * The Compact-mode schema-row integration cell. Wraps loading / error /
 * empty / data states in a single fixed-size slot so a column
 * transitioning loading → rendered doesn't shift adjacent rows.
 *
 * Stories here exercise the **states** rather than the chart visuals
 * themselves (those are covered by the Continuous + Discrete story
 * files). Each story below shows the GA Compact-mode row in one
 * state — light + dark.
 */
const meta: Meta<typeof InlineProfileDistributionCell> = {
  title: "Profile Distribution/Inline Cell (states)",
  component: InlineProfileDistributionCell,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `One **Compact-mode** distribution cell per schema row.
The hook returns \`{distributions, loading, error, isUnsupported}\` per
model; this cell consumes those + the per-column payload and renders
exactly one of: loading spinner, error indicator, empty slot
(per-column failure or absent payload), or the appropriate
\`PairedHistogramContinuous\` / \`PairedHistogramDiscrete\` chart.`,
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof InlineProfileDistributionCell>;

// ---------------------------------------------------------------------
// One row per state
// ---------------------------------------------------------------------

export const Loading: Story = {
  name: "State — loading",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="order_total_usd"
        columnType="DECIMAL(10,2)"
        status="changed"
        distribution={<InlineProfileDistributionCell loading />}
      />
    </SchemaContainerMock>
  ),
};

export const Error_: Story = {
  name: "State — error",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="order_total_usd"
        columnType="DECIMAL(10,2)"
        status="changed"
        distribution={
          <InlineProfileDistributionCell
            error={new Error("backend returned 500")}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

export const PerColumnFailure: Story = {
  name: "State — per-column failure (kind: null)",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="bad_column"
        columnType="JSON"
        status="ok"
        distribution={<InlineProfileDistributionCell payload={nullPayload} />}
      />
    </SchemaContainerMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Per-column failure (`{kind: null}`) renders an empty slot — no spinner, no error chrome. The other columns in the same task render normally.",
      },
    },
  },
};

export const Empty: Story = {
  name: "State — empty (no payload yet)",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="not_yet_loaded"
        columnType="VARCHAR"
        status="ok"
        distribution={<InlineProfileDistributionCell />}
      />
    </SchemaContainerMock>
  ),
};

export const ContinuousRow: Story = {
  name: "State — continuous payload",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="order_total_usd"
        columnType="DECIMAL(10,2)"
        status="changed"
        distribution={
          <InlineProfileDistributionCell payload={continuousOrderAmount} />
        }
      />
    </SchemaContainerMock>
  ),
};

export const DiscreteRow: Story = {
  name: "State — discrete payload",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="signup_source"
        columnType="VARCHAR"
        status="changed"
        distribution={
          <InlineProfileDistributionCell payload={discreteSignupSource} />
        }
      />
    </SchemaContainerMock>
  ),
};

// ---------------------------------------------------------------------
// Full task result — mixed columns
// ---------------------------------------------------------------------

export const MixedCompactView: Story = {
  name: "Mixed task — all states in one Compact view",
  render: () => {
    const rows = [
      {
        col: "order_total_usd",
        type: "DECIMAL(10,2)",
        status: "changed" as const,
        payload: mixedTaskResult.columns?.order_total_usd,
      },
      {
        col: "created_at",
        type: "TIMESTAMP",
        status: "ok" as const,
        payload: mixedTaskResult.columns?.created_at,
      },
      {
        col: "ltv_predicted",
        type: "DECIMAL",
        status: "added" as const,
        payload: mixedTaskResult.columns?.ltv_predicted,
      },
      {
        col: "response_status",
        type: "INT",
        status: "changed" as const,
        payload: mixedTaskResult.columns?.response_status,
      },
      {
        col: "billing_country",
        type: "VARCHAR",
        status: "ok" as const,
        payload: mixedTaskResult.columns?.billing_country,
      },
      {
        col: "signup_source",
        type: "VARCHAR",
        status: "changed" as const,
        payload: mixedTaskResult.columns?.signup_source,
      },
      {
        col: "cohort",
        type: "VARCHAR",
        status: "changed" as const,
        payload: mixedTaskResult.columns?.cohort,
      },
      {
        col: "origin_airport",
        type: "VARCHAR",
        status: "changed" as const,
        payload: mixedTaskResult.columns?.origin_airport,
      },
      {
        col: "bad_column",
        type: "JSON",
        status: "ok" as const,
        payload: mixedTaskResult.columns?.bad_column,
      },
      {
        col: "still_loading",
        type: "INT",
        status: "ok" as const,
        payload: undefined,
        loading: true,
      },
    ];
    return (
      <SchemaContainerMock
        title="orders.fct_order"
        subtitle={`${rows.length} columns · paired distributions · Compact mode`}
      >
        {rows.map((r) => (
          <Fragment key={r.col}>
            <SchemaRowMock
              columnName={r.col}
              columnType={r.type}
              status={r.status}
              distribution={
                <InlineProfileDistributionCell
                  payload={r.payload}
                  loading={r.loading}
                />
              }
            />
          </Fragment>
        ))}
      </SchemaContainerMock>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "All states side by side: continuous, discrete, gap-on-absent, trimmed, per-column failure, and one row still loading. This is the GA Compact-mode rendering target.",
      },
    },
  },
};

export const MixedCompactDarkView: Story = {
  name: "Mixed task — Compact view (dark)",
  render: () => {
    const rows = [
      {
        col: "order_total_usd",
        type: "DECIMAL(10,2)",
        status: "changed" as const,
        payload: continuousOrderAmount,
      },
      {
        col: "created_at",
        type: "TIMESTAMP",
        status: "ok" as const,
        payload: continuousStable,
      },
      {
        col: "ltv_predicted",
        type: "DECIMAL",
        status: "added" as const,
        payload: continuousAddedOnly,
      },
      {
        col: "response_status",
        type: "INT",
        status: "changed" as const,
        payload: discreteHttpStatus,
      },
      {
        col: "billing_country",
        type: "VARCHAR",
        status: "ok" as const,
        payload: discreteCountryCode,
      },
      {
        col: "cohort",
        type: "VARCHAR",
        status: "changed" as const,
        payload: discreteWithGaps,
      },
      {
        col: "origin_airport",
        type: "VARCHAR",
        status: "changed" as const,
        payload: discreteTrimmedAirports,
      },
    ];
    return (
      <SchemaContainerMock
        isDark
        title="orders.fct_order"
        subtitle={`${rows.length} columns · dark theme`}
      >
        {rows.map((r) => (
          <Fragment key={r.col}>
            <SchemaRowMock
              columnName={r.col}
              columnType={r.type}
              status={r.status}
              isDark
              distribution={
                <InlineProfileDistributionCell
                  payload={r.payload}
                  theme="dark"
                />
              }
            />
          </Fragment>
        ))}
      </SchemaContainerMock>
    );
  },
};

// ---------------------------------------------------------------------
// Unsupported banner
// ---------------------------------------------------------------------

export const UnsupportedBanner: Story = {
  name: "Unsupported — adapter banner",
  render: () => (
    <div style={{ width: 540 }}>
      <ProfileDistributionUnsupportedBanner
        reason={unsupportedResult.reason}
        adapterType="postgres"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "When the run result envelope is `{status: 'unsupported', reason: ...}`, render this once above the schema view. Per-column cells are not rendered in this case.",
      },
    },
  },
};
