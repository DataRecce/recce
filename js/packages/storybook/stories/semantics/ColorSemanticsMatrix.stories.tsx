import { RowCountSummary } from "@datarecce/ui/advanced";
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

function DirectionCue({
  isDark,
  label,
  cue,
}: {
  isDark: boolean;
  label: string;
  cue: string;
}) {
  const direction = getSemanticColorTheme(isDark).direction;

  return (
    <span
      aria-label={`${label}: ${cue}`}
      style={{
        background: direction.background,
        border: `1px solid ${direction.border}`,
        borderRadius: "0.375rem",
        color: direction.foreground,
        display: "inline-flex",
        gap: "0.25rem",
        padding: "0.25rem 0.5rem",
      }}
    >
      <strong>{label}</strong>
      {label === "Equal" ? (
        <>
          <RowCountSummary rowCount={{ base: 1000, curr: 1000 }} />
          <span>{cue}</span>
        </>
      ) : (
        <span>{cue}</span>
      )}
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

const structuralRows: Array<{
  surface: string;
  example: string;
  status: Exclude<StructuralChangeStatus, "unchanged">;
  base?: string;
  current?: string;
}> = [
  {
    surface: "Query",
    example: "Added row",
    status: "added",
    current: "order_1042",
  },
  {
    surface: "Query",
    example: "Removed row",
    status: "removed",
    base: "order_0991",
  },
  {
    surface: "Profile",
    example: "Changed paired value",
    status: "modified",
    base: "48.2",
    current: "52.7",
  },
];

const directionRows = [
  {
    example: "Increase",
    base: "800",
    current: "1,000",
    cue: "↑ +25.0%",
  },
  {
    example: "Decrease",
    base: "1,000",
    current: "750",
    cue: "↓ −25.0%",
  },
  {
    example: "Equal",
    base: "1,000",
    current: "1,000",
    cue: "= 0%",
  },
];

function SurfaceRows({ isDark }: { isDark: boolean }) {
  return (
    <table
      style={{
        borderCollapse: "separate",
        borderSpacing: 0,
        fontSize: "0.8125rem",
        width: "100%",
      }}
    >
      <thead>
        <tr>
          {[
            "Surface",
            "Compound meaning",
            "Structural / direction cue",
            "Compared values",
          ].map((heading) => (
            <th
              key={heading}
              scope="col"
              style={{
                borderBottom: "1px solid var(--mui-palette-divider)",
                padding: "0.5rem",
                textAlign: "left",
              }}
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {structuralRows.map((row) => (
          <tr key={row.example}>
            <th
              scope="row"
              style={{
                borderBottom: "1px solid var(--mui-palette-divider)",
                padding: "0.5rem",
                textAlign: "left",
              }}
            >
              {row.surface}
            </th>
            <td
              style={{
                borderBottom: "1px solid var(--mui-palette-divider)",
                padding: "0.5rem",
              }}
            >
              {row.example}
            </td>
            <td
              style={{
                borderBottom: "1px solid var(--mui-palette-divider)",
                padding: "0.5rem",
              }}
            >
              <StructuralChangeIndicator
                emphasis="neutral"
                showLabel
                size="sm"
                status={row.status}
              />
            </td>
            <td
              style={{
                borderBottom: "1px solid var(--mui-palette-divider)",
                padding: "0.5rem",
              }}
            >
              <ComparisonPair
                base={row.base}
                current={row.current}
                isDark={isDark}
              />
            </td>
          </tr>
        ))}
        {directionRows.map((row) => (
          <tr key={row.example}>
            <th
              scope="row"
              style={{
                borderBottom: "1px solid var(--mui-palette-divider)",
                padding: "0.5rem",
                textAlign: "left",
              }}
            >
              Profile
            </th>
            <td
              style={{
                borderBottom: "1px solid var(--mui-palette-divider)",
                padding: "0.5rem",
              }}
            >
              {row.example}
            </td>
            <td
              style={{
                borderBottom: "1px solid var(--mui-palette-divider)",
                padding: "0.5rem",
              }}
            >
              <DirectionCue cue={row.cue} isDark={isDark} label={row.example} />
            </td>
            <td
              style={{
                borderBottom: "1px solid var(--mui-palette-divider)",
                padding: "0.5rem",
              }}
            >
              <ComparisonPair
                base={row.base}
                current={row.current}
                isDark={isDark}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Charts({ isDark }: { isDark: boolean }) {
  const theme = isDark ? "dark" : "light";

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "1fr 1fr",
      }}
    >
      <div
        aria-label="Histogram comparing explicitly labelled Base and Current series"
        style={{ minWidth: 0 }}
      >
        <HistogramChart
          baseData={{ label: "Base", counts: [12, 25, 31, 18, 9] }}
          binEdges={[0, 20, 40, 60, 80, 100]}
          currentData={{ label: "Current", counts: [8, 19, 35, 26, 14] }}
          height={230}
          samples={102}
          theme={theme}
          title="Histogram — Base / Current"
        />
      </div>
      <div
        aria-label="Top-K chart comparing explicitly labelled Base and Current series"
        style={{ minWidth: 0 }}
      >
        <TopKBarChart
          baseData={{
            counts: [90, 70, 45, 25],
            valids: 230,
            values: ["completed", "pending", "refunded", "failed"],
          }}
          currentData={{
            counts: [104, 62, 39, 31],
            valids: 236,
            values: ["completed", "pending", "refunded", "failed"],
          }}
          maxItems={4}
          showComparison
          theme={theme}
          title="Top-K — Base / Current"
        />
      </div>
    </div>
  );
}

function Legend({ isDark }: { isDark: boolean }) {
  const directionExamples = [
    { label: "Increase", cue: "↑ +25.0%" },
    { label: "Decrease", cue: "↓ −25.0%" },
    { label: "Equal", cue: "= 0%" },
  ];

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
          {directionExamples.map(({ label, cue }) => (
            <DirectionCue cue={cue} isDark={isDark} key={label} label={label} />
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
          title="Query and profile rows — structure × comparison × direction"
        >
          <SurfaceRows isDark={isDark} />
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
