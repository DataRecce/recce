import { SchemaLegend } from "@datarecce/ui/components";
import type { LineageNodeProps } from "@datarecce/ui/primitives";
import { LineageNode, ScreenshotDataGrid } from "@datarecce/ui/primitives";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRow, getRowClass, schemaColumns } from "../schema/fixtures";

/**
 * @file WholeModelImpact.stories.tsx
 * @description Visual coverage for the `--downstream-of-breaking` feature
 * (DRC-3341). Captain reviews these stories to verify each whole-model
 * treatment renders distinctly:
 *
 * - AC-1 — downstream-only whole-model impact (amber wash + amber badge +
 *   "downstream of <ancestor>" header).
 * - AC-2 — column-only impact vs whole-model impact, side by side, plus
 *   the both-apply case where the existing per-row `!` glyph stacks on
 *   top of the wash.
 * - AC-4 — whole-model-changed source (brown wash + brown badge +
 *   source-flavored header), and the "source-also-downstream" case
 *   (Q11 — source wins; brown treatment dominates).
 *
 * Stories render the presentational primitives directly (LineageNode +
 * a hand-built wash/header pattern that mirrors SchemaView). This avoids
 * pulling SchemaView's full context graph into Storybook.
 */

const GRID_STYLE = {
  blockSize: "auto",
  maxHeight: "100%",
  overflow: "auto",
  fontSize: "10pt",
  borderWidth: 1,
} as const;

// ============================================================================
// Hand-built fixtures mirroring SchemaView's wash + header
// ============================================================================

interface SidebarFixtureProps {
  /** Node display name for column-headers in the demo. */
  modelName: string;
  /** Brown (source) or amber (downstream-only) treatment. */
  variant: "source" | "impacted";
  /** Header text. Use the spec-exact phrasings. */
  headerText: string;
  /** Optional title attribute on the header (Q7 — shown when the
   *  generic-pluralization fallback fires). */
  headerTitle?: string;
  /** Schema rows to render under the header. Stack the existing `!`
   *  glyph on top of the wash for the "Case 3" demo (Q5 of the spec). */
  rows: ReturnType<typeof createRow>[];
}

/**
 * Hand-built reproduction of SchemaView's wash + header. Mirrors the
 * sx props in `SchemaView.tsx` so a captain comparing this story to a
 * live `recce server` reads "the same thing twice."
 */
function SidebarFixture({
  modelName,
  variant,
  headerText,
  headerTitle,
  rows,
}: SidebarFixtureProps) {
  const isSource = variant === "source";
  return (
    <Box
      className="cll-experience"
      data-testid={
        isSource ? "whole-model-source-wash" : "whole-model-impact-wash"
      }
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 360,
        width: 420,
        border: 1,
        borderColor: "divider",
        backgroundColor: isSource
          ? "var(--schema-color-changed)"
          : "var(--schema-color-impacted)",
        boxShadow: isSource
          ? "inset 4px 0 0 var(--schema-color-changed-accent)"
          : "inset 4px 0 0 var(--schema-color-impacted-accent)",
      }}
    >
      <Box
        title={headerTitle}
        data-testid={
          isSource ? "whole-model-source-header" : "whole-model-impact-header"
        }
        sx={{
          px: 1,
          py: 0.75,
          fontSize: "0.75rem",
          fontWeight: 600,
          color: isSource
            ? "var(--schema-badge-changed-fg, rgb(160 100 0))"
            : "var(--schema-badge-impacted-fg, rgb(146 64 14))",
          borderBottom: isSource
            ? "1px solid var(--schema-color-changed-accent)"
            : "1px solid var(--schema-color-impacted-accent)",
        }}
      >
        {headerText}
      </Box>

      <Box sx={{ px: 1, py: 0.5, fontSize: "0.7rem", opacity: 0.7 }}>
        Schema for <strong>{modelName}</strong>
      </Box>
      <SchemaLegend />
      <ScreenshotDataGrid
        style={GRID_STYLE}
        columns={schemaColumns}
        rows={rows}
        rowHeight={35}
        getRowClass={getRowClass}
        className="rdg-light no-track-pii-safe cll-experience"
      />
    </Box>
  );
}

// ============================================================================
// Lineage node demo helpers
// ============================================================================

function NodeFixture(props: { label: string } & Partial<LineageNodeProps>) {
  const { label, ...rest } = props;
  const baseProps: LineageNodeProps = {
    id: `model.${label}`,
    data: {
      label,
      resourceType: "model",
      changeStatus: "unchanged",
    },
    newCllExperience: true,
    hasParents: true,
    hasChildren: true,
    ...rest,
  };
  return (
    <Box
      sx={{
        width: 320,
        // Hide ReactFlow handles — they're irrelevant in static stories.
        "& .react-flow__handle": { display: "none" },
      }}
    >
      <LineageNode {...baseProps} />
    </Box>
  );
}

// ============================================================================
// Schema row fixtures
// ============================================================================

const baseRows = [
  createRow({
    name: "id",
    baseIndex: 1,
    currentIndex: 1,
    baseType: "INTEGER",
    currentType: "INTEGER",
  }),
  createRow({
    name: "customer_id",
    baseIndex: 2,
    currentIndex: 2,
    baseType: "INTEGER",
    currentType: "INTEGER",
  }),
  createRow({
    name: "ordered_at",
    baseIndex: 3,
    currentIndex: 3,
    baseType: "TIMESTAMP",
    currentType: "TIMESTAMP",
  }),
  createRow({
    name: "total",
    baseIndex: 4,
    currentIndex: 4,
    baseType: "DECIMAL(12,2)",
    currentType: "DECIMAL(12,2)",
  }),
];

// Rows for the source-of-its-own-change demo: a real SQL-level change is
// expressed as `definitionChanged: true` on the row that the user edited.
const sourceRows = [
  createRow({
    name: "id",
    baseIndex: 1,
    currentIndex: 1,
    baseType: "INTEGER",
    currentType: "INTEGER",
  }),
  createRow({
    name: "customer_id",
    baseIndex: 2,
    currentIndex: 2,
    baseType: "INTEGER",
    currentType: "INTEGER",
    definitionChanged: true,
  }),
  createRow({
    name: "ordered_at",
    baseIndex: 3,
    currentIndex: 3,
    baseType: "TIMESTAMP",
    currentType: "TIMESTAMP",
  }),
  createRow({
    name: "total",
    baseIndex: 4,
    currentIndex: 4,
    baseType: "DECIMAL(12,2)",
    currentType: "DECIMAL(12,2)",
  }),
];

// ============================================================================
// META
// ============================================================================

const meta: Meta = {
  title: "Lineage/Whole-Model Impact (DRC-3341)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `Visual coverage for the \`--downstream-of-breaking\` feature.

A captain reviews this story to confirm every whole-model state renders distinctly:

- **Brown** (\`--schema-color-changed-*\` / \`--schema-badge-changed-*\`): the *source* of a whole-model change. Renders on the node that was actually edited.
- **Amber** (\`--schema-color-impacted-*\` / \`--schema-badge-impacted-*\`): a downstream node where every column is potentially affected. Renders on every node in the source's downstream subtree.
- **Source wins (Q11)**: a node that is both a source and downstream of another source renders in brown.

The on-row \`!\` glyph (column-only impact) and the panel-wide wash (whole-model impact) compose without conflict — both are visible in the "Both apply" story.`,
      },
    },
  },
};
export default meta;

type Story = StoryObj;

// ============================================================================
// AC-1 — Downstream-only whole-model impact
// ============================================================================

export const DownstreamOnly: Story = {
  name: "AC-1: Downstream whole-model impact",
  parameters: {
    docs: {
      description: {
        story: `**AC-1.** \`fct_orders\` sits downstream of \`stg_orders\` (a model whose own SQL added a \`WHERE\` clause). Every column in \`fct_orders\` is now potentially affected.

- Lineage node: amber "ALL" badge.
- Sidebar: amber wash + "Whole-model impact — downstream of \`stg_orders\`" header.
- Schema rows: clean (no \`!\` per-row glyphs — the wash carries the story).`,
      },
    },
  },
  render: () => (
    <Stack direction="row" spacing={4} sx={{ alignItems: "flex-start" }}>
      <Stack spacing={1}>
        <Typography variant="caption">Lineage node</Typography>
        <NodeFixture label="fct_orders" isWholeModelImpacted />
      </Stack>
      <Stack spacing={1}>
        <Typography variant="caption">Sidebar</Typography>
        <SidebarFixture
          modelName="fct_orders"
          variant="impacted"
          headerText="Whole-model impact — downstream of stg_orders"
          rows={baseRows}
        />
      </Stack>
    </Stack>
  ),
};

// ============================================================================
// AC-2 — Column-only vs whole-model vs both
// ============================================================================

export const ColumnOnlyVsWholeModelVsBoth: Story = {
  name: "AC-2: Column-only vs whole-model vs both",
  parameters: {
    docs: {
      description: {
        story: `**AC-2.** Three sidebars side by side. A captain confirms the three states read as distinct:

- **Column-only impact** (left): one row gets the existing \`!\` glyph. No wash. No header.
- **Whole-model impact** (middle): wash + header. No per-row \`!\` (the wash covers it).
- **Both apply** (right): wash + header AND the per-row \`!\` glyph for the column on the column-level path. Different mechanisms (background vs row-glyph) compose without color collision (Q5).`,
      },
    },
  },
  render: () => {
    // For the "column-only" case we render the rows on a normal (no-wash)
    // SchemaView shape, mark a single row as impacted with the row-impacted
    // class via getRowClass. Easiest path: use the existing fixture's row
    // class for `definitionChanged` — that's `row-changed`, brown — which
    // is the wrong vocabulary. Instead, simulate row-level impact by
    // adding `__status: "impacted"` and a custom getRowClass.
    const columnOnlyRows = baseRows.map((r, i) =>
      i === 2 ? { ...r, isImpacted: true } : r,
    );
    const bothAppliesRows = baseRows.map((r, i) =>
      i === 2 ? { ...r, isImpacted: true } : r,
    );
    const customGetRowClass = (params: { data?: { isImpacted?: boolean } }) => {
      if (params.data?.isImpacted) return "row-impacted row-selectable";
      return "row-normal";
    };

    return (
      <Stack
        direction="row"
        spacing={3}
        sx={{ alignItems: "flex-start", flexWrap: "wrap" }}
      >
        <Stack spacing={1}>
          <Typography variant="subtitle2">Column-only impact</Typography>
          <Box
            sx={{
              width: 380,
              height: 320,
              border: 1,
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
            }}
            className="cll-experience"
          >
            <Box sx={{ px: 1, py: 0.5, fontSize: "0.7rem", opacity: 0.7 }}>
              Schema for <strong>dim_customer_state</strong>
            </Box>
            <SchemaLegend />
            <ScreenshotDataGrid
              style={GRID_STYLE}
              columns={schemaColumns}
              rows={columnOnlyRows}
              rowHeight={35}
              getRowClass={customGetRowClass}
              className="rdg-light no-track-pii-safe cll-experience"
            />
          </Box>
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">Whole-model impact only</Typography>
          <SidebarFixture
            modelName="fct_orders"
            variant="impacted"
            headerText="Whole-model impact — downstream of stg_orders"
            rows={baseRows}
          />
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">
            Both apply (wash + per-row !)
          </Typography>
          <Box sx={{ position: "relative" }}>
            <SidebarFixture
              modelName="dim_customer_state"
              variant="impacted"
              headerText="Whole-model impact — downstream of stg_orders"
              rows={bothAppliesRows}
            />
          </Box>
        </Stack>
      </Stack>
    );
  },
};

// ============================================================================
// AC-4 — Source-only and source-also-downstream
// ============================================================================

export const SourceAndSourceWins: Story = {
  name: "AC-4: Source-only and source-also-downstream",
  parameters: {
    docs: {
      description: {
        story: `**AC-4.** Two source cases side by side:

- **Source only** (left): \`stg_orders\` had its own \`WHERE\` clause edit. No upstream whole-model change. Brown badge + brown wash + "Whole-model change in this model" header.
- **Source also downstream of another source** (right) — Q11 "source wins": \`fct_orders\` has its own \`GROUP BY\` edit AND sits downstream of \`stg_orders\` (also breaking). The source treatment dominates: brown badge + brown wash + source-flavored header. The "also downstream of \`stg_orders\`" line is an optional secondary annotation per the spec.`,
      },
    },
  },
  render: () => (
    <Stack
      direction="row"
      spacing={3}
      sx={{ alignItems: "flex-start", flexWrap: "wrap" }}
    >
      <Stack spacing={1}>
        <Typography variant="subtitle2">Source only</Typography>
        <NodeFixture
          label="stg_orders"
          isBreakingSource
          data={{
            label: "stg_orders",
            resourceType: "model",
            changeStatus: "modified",
          }}
        />
        <SidebarFixture
          modelName="stg_orders"
          variant="source"
          headerText="Whole-model change in this model"
          rows={sourceRows}
        />
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle2">
          Source also downstream (Q11)
        </Typography>
        <NodeFixture
          label="fct_orders"
          isBreakingSource
          // isWholeModelImpacted is false here even though fct_orders is
          // downstream of stg_orders — GraphNodeOss zeroes it out when
          // isBreakingSource is true (source wins).
          data={{
            label: "fct_orders",
            resourceType: "model",
            changeStatus: "modified",
          }}
        />
        <SidebarFixture
          modelName="fct_orders"
          variant="source"
          headerText="Whole-model change in this model"
          rows={sourceRows}
        />
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", maxWidth: 420 }}
        >
          (Optional secondary annotation per Q11: "also downstream of
          stg_orders". Not implemented in v1; the source treatment alone covers
          the AC.)
        </Typography>
      </Stack>
    </Stack>
  ),
};

// ============================================================================
// Multi-ancestor formatting (Q7) — bonus coverage
// ============================================================================

export const MultiAncestorHeader: Story = {
  name: "Q7: Multi-ancestor header formatting",
  parameters: {
    docs: {
      description: {
        story: `**Q7 — multiple closest ancestors.** The sidebar header lists every co-equal upstream whole-model-changed ancestor up to a length cap.

- 1 ancestor → "Whole-model impact — downstream of \`a\`"
- 2–3 ancestors that fit → "Whole-model impact — downstream of \`a\`, \`b\`, \`c\`"
- >3 ancestors OR joined > 60 chars → falls back to "Whole-model impact — downstream of multiple changes"; full list available via the header's \`title\` tooltip.`,
      },
    },
  },
  render: () => (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Single ancestor</Typography>
        <SidebarFixture
          modelName="fct_orders"
          variant="impacted"
          headerText="Whole-model impact — downstream of stg_orders"
          rows={baseRows}
        />
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle2">Two ancestors (fits)</Typography>
        <SidebarFixture
          modelName="fct_revenue"
          variant="impacted"
          headerText="Whole-model impact — downstream of stg_orders, stg_payments"
          rows={baseRows}
        />
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle2">
          Generic fallback (&gt;3 ancestors or overflow)
        </Typography>
        <SidebarFixture
          modelName="wide_revenue_summary"
          variant="impacted"
          headerText="Whole-model impact — downstream of multiple changes"
          headerTitle="Closest upstream whole-model changes: stg_a, stg_b, stg_c, stg_d, stg_e"
          rows={baseRows}
        />
      </Stack>
    </Stack>
  ),
};
