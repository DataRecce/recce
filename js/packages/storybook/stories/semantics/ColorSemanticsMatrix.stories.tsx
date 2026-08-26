import { RowCountSummary } from "@datarecce/ui/advanced";
import {
  ProfileDiffResultView,
  QueryDiffResultView,
} from "@datarecce/ui/components";
import {
  DiffText,
  getSemanticColorTheme,
  HistogramChart,
  LineageNode,
  StructuralChangeIndicator,
  type StructuralChangeStatus,
  TopKBarChart,
} from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReactFlowProvider } from "@xyflow/react";
import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useState,
} from "react";
import { createProfileDiffRun } from "../profile/fixtures";
import { createQueryDiffRunNonJoin } from "../query/fixtures";

interface ColorSemanticsMatrixProps {
  isDark?: boolean;
  grayscale?: boolean;
}

interface ComparisonValueProps {
  label: "Base" | "Current";
  role: "base" | "current";
  value?: string;
  isDark: boolean;
  compact?: boolean;
}

function ComparisonValue({
  label,
  role,
  value,
  isDark,
  compact = false,
}: ComparisonValueProps) {
  const colors = getSemanticColorTheme(isDark).comparison[role];

  return (
    <span
      style={{
        alignItems: "center",
        background: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: "0.375rem",
        display: "inline-flex",
        gap: "0.375rem",
        minHeight: compact ? "1.25rem" : "2rem",
        padding: compact ? "0.0625rem 0.25rem" : "0.1875rem 0.375rem",
      }}
    >
      <span
        style={{
          color: colors.foreground,
          fontSize: compact ? "0.625rem" : "0.6875rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {value === undefined ? (
        <span aria-label={`${label} value unavailable`}>—</span>
      ) : (
        <DiffText
          comparisonRole={role}
          fontSize={compact ? "0.6875rem" : "0.8125rem"}
          noCopy
          value={value}
        />
      )}
    </span>
  );
}

function ComparisonPair({
  base,
  current,
  isDark,
  compact = false,
}: {
  base?: string;
  current?: string;
  isDark: boolean;
  compact?: boolean;
}) {
  return (
    <span
      style={{
        alignItems: "center",
        display: "inline-flex",
        gap: compact ? "0.25rem" : "0.5rem",
      }}
    >
      <ComparisonValue
        compact={compact}
        isDark={isDark}
        label="Base"
        role="base"
        value={base}
      />
      <ComparisonValue
        compact={compact}
        isDark={isDark}
        label="Current"
        role="current"
        value={current}
      />
    </span>
  );
}

function ProductionDirectionCue({
  isDark,
  label,
  base,
  current,
}: {
  isDark: boolean;
  label: "Increase" | "Decrease" | "Equal";
  base: number;
  current: number;
}) {
  const direction = getSemanticColorTheme(isDark).direction;

  return (
    <span
      data-production-direction={label.toLowerCase()}
      style={{
        alignItems: "center",
        background: direction.background,
        border: `1px solid ${direction.border}`,
        borderRadius: "0.375rem",
        color: direction.foreground,
        display: "inline-flex",
        gap: "0.5rem",
        padding: "0.25rem 0.5rem",
      }}
    >
      <strong>{label}</strong>
      <RowCountSummary rowCount={{ base, curr: current }} />
    </span>
  );
}

function Section({
  title,
  children,
  isDark,
  style,
}: {
  title: string;
  children: ReactNode;
  isDark: boolean;
  style?: CSSProperties;
}) {
  const neutral = getSemanticColorTheme(isDark).structural.neutral;

  return (
    <section
      style={{
        background: neutral.background,
        border: `1px solid ${neutral.border}`,
        borderRadius: "0.75rem",
        padding: "1rem",
        ...style,
      }}
    >
      <h2
        style={{
          fontSize: "1rem",
          margin: "0 0 0.75rem",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const lineageNodes: Array<{
  status: Exclude<StructuralChangeStatus, "unchanged">;
  label: string;
  base: string;
  current: string;
}> = [
  {
    status: "added",
    label: "fct_new_orders",
    base: "N/A",
    current: "1,280",
  },
  {
    status: "removed",
    label: "stg_legacy_orders",
    base: "940",
    current: "N/A",
  },
  {
    status: "modified",
    label: "dim_customers",
    base: "4,200",
    current: "4,860",
  },
];

function LineageMatrix({ isDark }: { isDark: boolean }) {
  return (
    <ReactFlowProvider>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(3, 1fr)",
        }}
      >
        {lineageNodes.map(({ status, label, base, current }) => (
          <article key={status}>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: "0.375rem",
                marginBottom: "0.5rem",
              }}
            >
              <StructuralChangeIndicator
                emphasis="neutral"
                showLabel
                size="sm"
                status={status}
              />
            </div>
            <LineageNode
              data={{
                changeStatus: status,
                label,
                materialized: "table",
                resourceType: "model",
              }}
              hasChildren={false}
              hasParents={false}
              id={`model.${label}`}
              isDark={isDark}
              newCllExperience
              runsAggregatedTag={
                <ComparisonPair
                  base={base}
                  compact
                  current={current}
                  isDark={isDark}
                />
              }
            />
          </article>
        ))}
      </div>
    </ReactFlowProvider>
  );
}

const directionRows = [
  {
    label: "Increase" as const,
    base: 800,
    current: 1000,
  },
  {
    label: "Decrease" as const,
    base: 1000,
    current: 750,
  },
  {
    label: "Equal" as const,
    base: 1000,
    current: 1000,
  },
];

const queryDiffRun = createQueryDiffRunNonJoin();
const profileDiffRun = createProfileDiffRun();

function ProductionSurfaceEvidence({ isDark }: { isDark: boolean }) {
  const neutral = getSemanticColorTheme(isDark).structural.neutral;

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <article data-production-surface="query">
          <h3 style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
            Query diff — added, removed, and changed pair
          </h3>
          <div style={{ height: "290px", minWidth: 0 }}>
            <QueryDiffResultView
              run={queryDiffRun}
              viewOptions={{
                changed_only: true,
                display_mode: "side_by_side",
                pinned_columns: ["id"],
                primary_keys: ["id"],
              }}
            />
          </div>
        </article>
        <article data-production-surface="profile">
          <h3 style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
            Profile diff — added, removed, and modified metrics
          </h3>
          <div style={{ height: "290px", minWidth: 0 }}>
            <ProfileDiffResultView
              run={profileDiffRun}
              viewOptions={{
                display_mode: "side_by_side",
                pinned_columns: ["column_name"],
              }}
            />
          </div>
        </article>
      </div>
      <div>
        <h3 style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
          Production row-count direction renderer
        </h3>
        <div
          data-production-directions="row-count"
          style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}
        >
          {directionRows.map(({ label, base, current }) => (
            <ProductionDirectionCue
              base={base}
              current={current}
              isDark={isDark}
              key={label}
              label={label}
            />
          ))}
        </div>
        <p
          style={{
            borderLeft: `3px solid ${neutral.border}`,
            fontSize: "0.75rem",
            margin: "0.75rem 0 0",
            paddingLeft: "0.5rem",
          }}
        >
          Values, arrows, signed percentages, and No Change are rendered by the
          production row-count component.
        </p>
      </div>
    </div>
  );
}

const histogramBinLabels = ["0–20", "20–40", "40–60", "60–80", "80–100"];
const histogramBaseCounts = [12, 25, 31, 18, 9];
const histogramCurrentCounts = [8, 19, 35, 26, 14];
const topKBase = {
  counts: [90, 70, 45, 25],
  valids: 230,
  values: ["completed", "pending", "refunded", "failed"],
};
const topKCurrent = {
  counts: [104, 62, 39, 31],
  valids: 236,
  values: ["completed", "pending", "refunded", "failed"],
};

function Charts({ isDark }: { isDark: boolean }) {
  const theme = isDark ? "dark" : "light";
  const neutral = getSemanticColorTheme(isDark).structural.neutral;
  const evidenceStyle: CSSProperties = {
    border: `1px solid ${neutral.border}`,
    borderRadius: "0.375rem",
    color: neutral.foreground,
    fontSize: "0.6875rem",
    margin: "0.5rem 1rem 0",
    padding: "0.5rem",
  };

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "1fr 1fr",
      }}
    >
      <div data-production-chart="histogram" style={{ minWidth: 0 }}>
        <HistogramChart
          baseData={{ label: "Base", counts: histogramBaseCounts }}
          binEdges={[0, 20, 40, 60, 80, 100]}
          currentData={{ label: "Current", counts: histogramCurrentCounts }}
          height={230}
          samples={102}
          theme={theme}
          title="Histogram — Base / Current"
        />
        <div data-series-evidence="histogram" style={evidenceStyle}>
          <strong>Persistent series values by bin</strong>
          <div
            style={{
              display: "grid",
              gap: "0.25rem",
              gridTemplateColumns: "repeat(5, 1fr)",
              marginTop: "0.375rem",
            }}
          >
            {histogramBinLabels.map((bin, index) => (
              <span key={bin}>
                {bin} Base {histogramBaseCounts[index]} Current{" "}
                {histogramCurrentCounts[index]}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div data-production-chart="top-k" style={{ minWidth: 0 }}>
        <TopKBarChart
          baseData={topKBase}
          currentData={topKCurrent}
          maxItems={4}
          showComparison
          theme={theme}
          title="Top-K — Base / Current"
        />
        <div data-series-evidence="top-k" style={evidenceStyle}>
          <strong>Persistent position key:</strong> Upper bar Current; Lower bar
          Base. Counts and percentages remain printed on every bar.
        </div>
      </div>
    </div>
  );
}

function Legend({ isDark }: { isDark: boolean }) {
  return (
    <div
      aria-label="Semantic color legend"
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "repeat(3, 1fr)",
      }}
    >
      <div>
        <h3 style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
          Comparison
        </h3>
        <ComparisonPair base="120" current="128" isDark={isDark} />
      </div>
      <div>
        <h3 style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
          Structure
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {(["added", "removed", "modified"] as const).map((status) => (
            <StructuralChangeIndicator
              emphasis="neutral"
              key={status}
              showLabel
              size="sm"
              status={status}
            />
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontSize: "0.875rem", margin: "0 0 0.5rem" }}>
          Direction
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {directionRows.map(({ label, base, current }) => (
            <ProductionDirectionCue
              base={base}
              current={current}
              isDark={isDark}
              key={label}
              label={label}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorSemanticsMatrix({
  isDark = false,
  grayscale = false,
}: ColorSemanticsMatrixProps) {
  const [themeSettled, setThemeSettled] = useState(false);
  const neutral = getSemanticColorTheme(isDark).structural.neutral;

  useLayoutEffect(() => {
    const storybookRoot = document.getElementById("storybook-root");
    document.documentElement.classList.toggle("dark", isDark);
    storybookRoot?.style.setProperty("visibility", "hidden");
    storybookRoot?.style.setProperty("width", "1440px");

    const colorProbe = document.createElement("span");
    colorProbe.style.color = neutral.foreground;
    storybookRoot?.append(colorProbe);
    const settledIndicatorColor = getComputedStyle(colorProbe).color;
    colorProbe.remove();

    let settleFrame = 0;
    const waitForSemanticTheme = () => {
      document.documentElement.classList.toggle("dark", isDark);
      const indicator = storybookRoot?.querySelector(
        '[data-emphasis="neutral"]',
      );
      if (
        indicator &&
        getComputedStyle(indicator).color === settledIndicatorColor
      ) {
        setThemeSettled(true);
        storybookRoot?.style.removeProperty("visibility");
        return;
      }
      settleFrame = requestAnimationFrame(waitForSemanticTheme);
    };
    settleFrame = requestAnimationFrame(waitForSemanticTheme);

    return () => {
      cancelAnimationFrame(settleFrame);
      storybookRoot?.style.removeProperty("visibility");
      storybookRoot?.style.removeProperty("width");
    };
  }, [isDark, neutral.foreground]);

  return (
    <main
      aria-busy={!themeSettled}
      style={{
        background: neutral.background,
        boxSizing: "border-box",
        color: neutral.foreground,
        filter: grayscale ? "grayscale(1)" : undefined,
        fontFamily: "var(--mui-fontFamily)",
        padding: "2rem",
        width: "1440px",
      }}
    >
      <header style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.375rem" }}>
          Compound color semantics
        </h1>
        <p
          style={{
            color: neutral.foreground,
            margin: 0,
            opacity: 0.75,
          }}
        >
          Color reinforces meaning; labels, symbols, borders, arrows, and signed
          text carry it independently.
        </p>
      </header>

      <div style={{ display: "grid", gap: "1rem" }}>
        <Section
          isDark={isDark}
          title="Lineage nodes — structural status × Base / Current"
        >
          <LineageMatrix isDark={isDark} />
        </Section>

        <Section
          isDark={isDark}
          title="Production query/profile grids and row-count direction"
        >
          <ProductionSurfaceEvidence isDark={isDark} />
        </Section>

        <Section
          isDark={isDark}
          title="Distribution charts — Base / Current series"
        >
          <Charts isDark={isDark} />
        </Section>

        <Section isDark={isDark} title="Legend — orthogonal semantic axes">
          <Legend isDark={isDark} />
        </Section>
      </div>
    </main>
  );
}

const meta: Meta<typeof ColorSemanticsMatrix> = {
  title: "Semantics/ColorSemanticsMatrix",
  component: ColorSemanticsMatrix,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof ColorSemanticsMatrix>;

export const Light: Story = {
  args: { isDark: false },
};

export const Dark: Story = {
  args: { isDark: true },
  globals: { theme: "dark" },
  parameters: { backgrounds: { default: "dark" } },
};

export const Grayscale: Story = {
  args: { grayscale: true, isDark: false },
};
