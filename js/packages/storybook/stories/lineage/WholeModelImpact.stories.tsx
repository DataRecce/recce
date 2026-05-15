import {
  SchemaLegend,
  wholeModelTreatmentTokens,
} from "@datarecce/ui/components";
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
 * (DRC-3341, post 2026-05-14 redesign). Captain reviews these stories to
 * verify each whole-model treatment renders distinctly:
 *
 * - AC-1 — downstream-only whole-model impact: amber title chip ("! name")
 *   + amber left stripe + amber "ALL" badge on the lineage node.
 * - AC-2 — column-only impact vs whole-model impact, side by side, plus
 *   the both-apply case where the existing per-row `!` glyph stacks
 *   alongside the title chip.
 * - AC-4 — whole-model-changed source: brown title chip ("~ name") + brown
 *   left stripe + brown "ALL" badge, and the "source-also-downstream"
 *   case (Q11 — source wins; brown treatment dominates).
 *
 * The fixture mirrors NodeView's panel — title chip + left stripe, with a
 * (mock) tabs strip and Schema grid below it. The earlier wash + labeled
 * header bar were dropped (see spec
 * 2026-05-14-whole-model-treatment-redesign-design.md).
 * Multi-ancestor list is intentionally not surfaced in v1 (Q7 punt;
 * see DRC-3341 spec).
 */

const GRID_STYLE = {
  blockSize: "auto",
  maxHeight: "100%",
  overflow: "auto",
  fontSize: "10pt",
  borderWidth: 1,
} as const;

// ============================================================================
// Hand-built fixtures mirroring NodeView's panel-level whole-model treatment
// ============================================================================

interface PanelFixtureProps {
  /** Node display name shown in the panel header. */
  modelName: string;
  /** Brown (source) or amber (downstream-only) treatment. */
  variant: "source" | "impacted";
  /** Schema rows to render under the (mock) tab strip. */
  rows: ReturnType<typeof createRow>[];
}

/**
 * Hand-built reproduction of NodeView's panel-level whole-model
 * treatment. Rendering an actual `<NodeView>` here would require mocking
 * a chunk of the lineage context graph; the title-chip + left stripe
 * combo is small enough that a hand-built mock stays in sync without
 * that cost.
 *
 * Layout mirrors NodeView post-redesign:
 * - 6px left-edge stripe on the outer Box.
 * - Title chip wrapping the model name, with !/~ glyph disc.
 * - No panel wash, no labeled header bar above the tabs.
 */
function PanelFixture({ modelName, variant, rows }: PanelFixtureProps) {
  const isSource = variant === "source";
  const tokens = wholeModelTreatmentTokens(isSource ? "source" : "downstream");
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 480,
        width: 460,
        border: 1,
        borderColor: "divider",
        boxShadow: `inset 6px 0 0 ${tokens.washAccent}`,
      }}
    >
      {/* Panel header row — title chip wraps the model name */}
      <Stack direction="row" sx={{ alignItems: "center", px: 2, py: 1.5 }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", gap: 1, minWidth: 0, flex: 1 }}
        >
          <Box
            data-testid={
              isSource
                ? "whole-model-source-title-chip"
                : "whole-model-impact-title-chip"
            }
            aria-label={isSource ? "whole-model change" : "whole-model impact"}
            title={modelName}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1,
              py: 0.25,
              borderRadius: "6px",
              backgroundColor: tokens.washBg,
              border: `1px solid ${tokens.washAccent}`,
              color: tokens.fg,
              minWidth: 0,
              maxWidth: "100%",
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                backgroundColor: tokens.washAccent,
                color: "#fff",
                fontSize: "0.7rem",
                fontWeight: 800,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {isSource ? "~" : "!"}
            </Box>
            <Typography
              variant="subtitle1"
              component="span"
              sx={{
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "inherit",
              }}
            >
              {modelName}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
      </Stack>

      {/* Mock action buttons row — placeholder so the chip sits in the
          right vertical position relative to the rest of the panel. */}
      <Box sx={{ pl: 2, py: 1, fontSize: "0.7rem", color: "text.secondary" }}>
        Diff (action buttons placeholder)
      </Box>

      {/* Mock tabs strip — non-functional, just for visual context. */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          px: 2,
          py: 1,
          fontSize: "0.7rem",
          color: "text.secondary",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <span>Lineage</span>
        <strong>Columns</strong>
        <span>Code</span>
      </Box>

      {/* Schema grid */}
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

The title chip + left stripe live on the NodeView panel; the chip stays anchored to the model name, and the stripe runs the full height so the treatment is identifiable on any tab. The on-row \`!\` glyph (column-only impact) and the title chip (whole-model impact) compose without conflict — both are visible in the "Both apply" story.`,
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
        story: `**AC-1.** \`fct_orders\` sits downstream of a model whose own SQL added a \`WHERE\` clause. Every column in \`fct_orders\` is now potentially affected.

- Lineage node: amber "ALL" badge.
- Sidebar panel: amber title chip wrapping the model name ("! fct_orders") + amber left-edge stripe.
- Schema rows: clean (no \`!\` per-row glyphs — the title chip carries the story).`,
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
        <Typography variant="caption">Sidebar panel</Typography>
        <PanelFixture
          modelName="fct_orders"
          variant="impacted"
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
        story: `**AC-2.** Three sidebar panels side by side. A captain confirms the three states read as distinct:

- **Column-only impact** (left): one row gets the existing \`!\` glyph. No title chip. No stripe.
- **Whole-model impact** (middle): title chip + left stripe. No per-row \`!\` (the chip carries it).
- **Both apply** (right): title chip + left stripe AND the per-row \`!\` glyph for the column on the column-level path. Different mechanisms (title chip vs row-glyph) compose without conflict (Q5).`,
      },
    },
  },
  render: () => {
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
              width: 460,
              height: 400,
              border: 1,
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
            }}
            className="cll-experience"
          >
            <Box
              sx={{
                px: 2,
                py: 1.5,
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              dim_customer_state
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
          <PanelFixture
            modelName="fct_orders"
            variant="impacted"
            rows={baseRows}
          />
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">
            Both apply (title chip + per-row !)
          </Typography>
          <PanelFixture
            modelName="dim_customer_state"
            variant="impacted"
            rows={bothAppliesRows}
          />
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

- **Source only** (left): \`stg_orders\` had its own \`WHERE\` clause edit. No upstream whole-model change. Brown title chip wrapping the model name ("~ stg_orders") + brown left stripe + brown "ALL" badge on the lineage node.
- **Source also downstream of another source** (right) — Q11 "source wins": \`fct_orders\` has its own \`GROUP BY\` edit AND sits downstream of \`stg_orders\` (also breaking). The source treatment dominates: brown title chip wrapping the model name ("~ fct_orders") + brown left stripe + brown "ALL" badge on the lineage node.`,
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
        <PanelFixture
          modelName="stg_orders"
          variant="source"
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
          // downstream of stg_orders — GraphNodeOss / NodeViewOss zero it
          // out when isBreakingSource is true (source wins).
          data={{
            label: "fct_orders",
            resourceType: "model",
            changeStatus: "modified",
          }}
        />
        <PanelFixture
          modelName="fct_orders"
          variant="source"
          rows={sourceRows}
        />
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", maxWidth: 460 }}
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
// Additive-change badge — captain follow-up after AC-1..AC-4
// ============================================================================

export const AdditiveBadge: Story = {
  name: "Additive: green ADD badge on the graph",
  parameters: {
    docs: {
      description: {
        story: `Captain follow-up after AC-1..AC-4: a model whose only change is additive (\`non_breaking\` — adds a column, leaves existing rows and column values untouched) deserves a graph-level signal that it's *safe*. Green "ADD" badge on the lineage node, no sidebar wash (the per-row green \`+\` glyph in the schema view already calls out the added column).

Precedence: source (brown) > downstream (amber) > additive (green). If a model is additive AND under any whole-model treatment, the stronger badge wins.`,
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
        <Typography variant="subtitle2">Additive only</Typography>
        <NodeFixture
          label="stg_customers"
          data={{
            label: "stg_customers",
            resourceType: "model",
            changeStatus: "modified",
          }}
          showChangeAnalysis
          changeCategory="non_breaking"
        />
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", maxWidth: 320 }}
        >
          Green ADD badge: this model added a column. No upstream whole-model
          change.
        </Typography>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle2">For comparison: source</Typography>
        <NodeFixture
          label="stg_orders"
          isBreakingSource
          data={{
            label: "stg_orders",
            resourceType: "model",
            changeStatus: "modified",
          }}
        />
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", maxWidth: 320 }}
        >
          Brown ALL badge: this model's own change is whole-model.
        </Typography>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle2">For comparison: downstream</Typography>
        <NodeFixture
          label="fct_orders"
          isWholeModelImpacted
          data={{
            label: "fct_orders",
            resourceType: "model",
            changeStatus: "unchanged",
          }}
        />
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", maxWidth: 320 }}
        >
          Amber ALL badge: downstream of a whole-model change.
        </Typography>
      </Stack>
    </Stack>
  ),
};

// ============================================================================
// Long model name — verifies title-chip ellipsis behavior
// ============================================================================

export const LongModelName: Story = {
  name: "Edge: long model name truncates inside the chip",
  parameters: {
    docs: {
      description: {
        story: `Edge case for the title-chip surface. A very long model name must truncate with ellipsis inside the chip and expose the full name via the chip's tooltip (\`title\` attribute). Both the impact and source variants are shown; the chip width is bounded by the panel header layout.`,
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
        <Typography variant="subtitle2">
          Long name — downstream impact
        </Typography>
        <PanelFixture
          modelName="fct_extremely_long_model_name_with_many_segments_to_force_truncation"
          variant="impacted"
          rows={baseRows}
        />
      </Stack>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Long name — source</Typography>
        <PanelFixture
          modelName="stg_extremely_long_model_name_with_many_segments_to_force_truncation"
          variant="source"
          rows={sourceRows}
        />
      </Stack>
    </Stack>
  ),
};
