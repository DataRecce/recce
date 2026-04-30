import type {
  LineageGraphNode,
  LineageTabContentProps,
} from "@datarecce/ui/advanced";
import { LineageTabContent } from "@datarecce/ui/advanced";
import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

/**
 * @file LineageTabContent.stories.tsx
 * @description Stories for the Lineage tab body that renders inside the
 * Model Detail panel — direct upstream/downstream rows, focus card, and
 * a "Path <previous> > <current>" breadcrumb when the user has navigated.
 */

// =============================================================================
// FIXTURE FACTORIES
// =============================================================================

/** Build a single lineage node with sensible defaults. */
function makeNode(
  id: string,
  overrides: Partial<LineageGraphNode["data"]> = {},
): LineageGraphNode {
  return {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name: id,
      resourceType: "model",
      parents: {},
      children: {},
      ...overrides,
    },
  } as LineageGraphNode;
}

/** Build a lookup of nodes keyed by id, with optional per-id data overrides. */
function makeNodesById(
  ids: string[],
  overrides: Record<string, Partial<LineageGraphNode["data"]>> = {},
): Record<string, LineageGraphNode> {
  const out: Record<string, LineageGraphNode> = {};
  for (const id of ids) {
    out[id] = makeNode(id, overrides[id]);
  }
  return out;
}

/** Build an args bundle for a focus node with the given parent / child names. */
function buildArgs(opts: {
  focusId: string;
  parents?: string[];
  children?: string[];
  changeStatusByName?: Record<string, "added" | "removed" | "modified">;
  focusChangeStatus?: "added" | "removed" | "modified";
  historyTrail?: string[];
  impactedNodeIds?: string[];
}): Pick<
  LineageTabContentProps,
  "node" | "nodesById" | "historyTrail" | "impactedNodeIds"
> {
  const parents = opts.parents ?? [];
  const children = opts.children ?? [];
  const allIds = Array.from(new Set([...parents, ...children, opts.focusId]));
  const overrides: Record<string, Partial<LineageGraphNode["data"]>> = {};
  for (const [id, status] of Object.entries(opts.changeStatusByName ?? {})) {
    overrides[id] = { changeStatus: status };
  }
  const nodesById = makeNodesById(allIds, overrides);
  const node = makeNode(opts.focusId, {
    parents: Object.fromEntries(parents.map((p) => [p, {} as never])),
    children: Object.fromEntries(children.map((c) => [c, {} as never])),
    changeStatus: opts.focusChangeStatus,
  });
  return {
    node,
    nodesById,
    historyTrail: opts.historyTrail,
    impactedNodeIds: opts.impactedNodeIds
      ? new Set(opts.impactedNodeIds)
      : undefined,
  };
}

// =============================================================================
// META
// =============================================================================

const meta: Meta<typeof LineageTabContent> = {
  title: "Lineage/LineageTabContent",
  component: LineageTabContent,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Body of the Lineage tab inside the Model Detail panel. Renders the focused node's direct upstream and downstream as flat lists with optional filter and pagination, a focus card with a center-on-canvas button, and a back-path breadcrumb that surfaces only the most recent previous step.",
      },
    },
  },
  decorators: [
    (Story) => (
      <Box sx={{ width: 380, height: 520, border: 1, borderColor: "divider" }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    onNavigate: fn(),
    onCenterFocus: fn(),
    // onBack and onJumpToHistory are intentionally NOT set here — the back
    // button only makes sense paired with a non-empty historyTrail, so each
    // story that wants a back button wires those callbacks explicitly.
  },
  argTypes: {
    historyTrail: {
      description:
        "Stack of previously focused node ids, oldest first. Drives the breadcrumb (only the most recent entry is surfaced).",
      control: "object",
    },
    onNavigate: {
      description:
        "Called with the node id when an upstream/downstream row is clicked.",
    },
    onBack: {
      description:
        "Called when the back arrow is clicked. The back arrow only renders when this callback is provided.",
    },
    onCenterFocus: {
      description: "Called when the in-card center-on-canvas icon is clicked.",
    },
    onJumpToHistory: {
      description:
        "Called with the history index when the breadcrumb's previous-step is clicked.",
    },
    impactedNodeIds: {
      description:
        "Frozen set of node ids in the current Impact Analysis result. When non-empty and the focused node is in the set, neighbor rows that participate in the impact chain are decorated with an amber rail/tint/arrow + directional tooltip.",
      control: "object",
    },
  },
};

export default meta;
type Story = StoryObj<typeof LineageTabContent>;

// =============================================================================
// Primary Use Cases
// =============================================================================

/** Typical mid-graph node with a couple of parents and children, no history. */
export const Default: Story = {
  args: {
    ...buildArgs({
      focusId: "stg_customers",
      parents: ["raw_customers"],
      children: ["customers", "dim_customers"],
    }),
  },
};

/** Focus node with mixed change statuses across its neighbors. */
export const WithChangeStatuses: Story = {
  args: {
    ...buildArgs({
      focusId: "stg_orders",
      parents: ["raw_orders"],
      children: ["orders", "fct_order_items", "dim_orders"],
      focusChangeStatus: "modified",
      changeStatusByName: {
        raw_orders: "modified",
        orders: "modified",
        fct_order_items: "added",
        dim_orders: "removed",
      },
    }),
  },
};

// =============================================================================
// Breadcrumb Behavior
// =============================================================================

/**
 * Back button and a "Path <previous> > <current>" breadcrumb appear in the
 * toolbar when historyTrail is non-empty. Only the most recent previous step
 * is rendered regardless of trail depth — older entries stay reachable via
 * the back arrow.
 */
export const WithHistory: Story = {
  args: {
    ...buildArgs({
      focusId: "stg_customers",
      parents: ["raw_customers"],
      children: ["customers"],
      historyTrail: ["customers"],
    }),
    onBack: fn(),
    onJumpToHistory: fn(),
  },
};

// =============================================================================
// Filter & Pagination
// =============================================================================

/**
 * Many direct downstreams — filter input appears (above 8 direct rows) and
 * pagination caps the initial visible count at 8.
 */
export const ManyDownstream: Story = {
  args: {
    ...buildArgs({
      focusId: "stg_orders",
      parents: ["raw_orders"],
      children: [
        "orders",
        "fct_orders",
        "fct_order_items",
        "dim_orders",
        "mart_orders_daily",
        "mart_orders_monthly",
        "mart_orders_weekly",
        "mart_revenue_daily",
        "mart_revenue_monthly",
        "exposures_orders_dashboard",
        "exposures_revenue_dashboard",
        "exposures_finance_report",
      ],
    }),
  },
};

// =============================================================================
// Edge Cases
// =============================================================================

/** Source node — no upstream, has downstream. */
export const SourceNode: Story = {
  args: {
    ...buildArgs({
      focusId: "raw_customers",
      children: ["stg_customers", "dim_customers"],
    }),
  },
};

/** Leaf node — has upstream, no downstream. */
export const LeafNode: Story = {
  args: {
    ...buildArgs({
      focusId: "mart_revenue_dashboard",
      parents: ["fct_revenue", "dim_customers"],
    }),
  },
};

/** Isolated node — neither upstream nor downstream. */
export const Isolated: Story = {
  args: {
    ...buildArgs({ focusId: "scratch_model" }),
  },
};

// =============================================================================
// Impact Analysis Marks
// =============================================================================

/**
 * Impact Analysis is active and reaches the focused node. One upstream parent
 * (`stg_payments`) is in the impact set and is marked with an amber rail/tint
 * and a trailing arrow icon (tooltip: "Impacts this model"). All three
 * downstream children inherit the focus's change, so each is marked
 * (tooltip: "Impacted by this model"). Section headers carry an amber count
 * pill on each side.
 */
export const ImpactAnalysisActive: Story = {
  args: {
    ...buildArgs({
      focusId: "customers",
      parents: ["stg_customers", "stg_orders", "stg_payments"],
      children: [
        "customer_order_pattern",
        "customer_segments",
        "mart_customers_daily",
      ],
      focusChangeStatus: "modified",
      changeStatusByName: {
        stg_payments: "modified",
        customer_segments: "modified",
      },
      impactedNodeIds: [
        "customers",
        "stg_payments",
        "customer_order_pattern",
        "customer_segments",
        "mart_customers_daily",
      ],
    }),
  },
};

/**
 * Stress test for "12 of 15 impacted" density. The pale tint stays calm
 * across many marked rows, so the unimpacted minority (audit / archive /
 * temp_debug) reads as the standout group.
 */
export const ImpactAnalysisDense: Story = {
  args: {
    ...buildArgs({
      focusId: "customers",
      parents: ["stg_payments"],
      children: [
        "mart_customers_daily",
        "mart_customers_weekly",
        "mart_customers_yearly",
        "mart_retention",
        "mart_ltv",
        "mart_churn",
        "mart_activation",
        "mart_cohorts",
        "customer_segments",
        "customer_segments4",
        "customer_order_pattern",
        "rfm_scores",
        "audit_customers",
        "archive_customers",
        "temp_debug_customers",
      ],
      focusChangeStatus: "modified",
      changeStatusByName: {
        stg_payments: "modified",
        mart_ltv: "added",
        customer_segments: "modified",
      },
      impactedNodeIds: [
        "customers",
        "stg_payments",
        "mart_customers_daily",
        "mart_customers_weekly",
        "mart_customers_yearly",
        "mart_retention",
        "mart_ltv",
        "mart_churn",
        "mart_activation",
        "mart_cohorts",
        "customer_segments",
        "customer_segments4",
        "customer_order_pattern",
        "rfm_scores",
      ],
    }),
  },
};

/**
 * Impact Analysis is on but the focused node itself is NOT in the impact
 * set. Per design rules, no row should be marked — upstream chains can't
 * reach an unimpacted focus, and nothing downstream propagates from one.
 */
export const ImpactAnalysisFocusOutsideSet: Story = {
  args: {
    ...buildArgs({
      focusId: "customers",
      parents: ["stg_customers", "stg_orders"],
      children: ["customer_segments"],
      impactedNodeIds: ["unrelated_model_a", "unrelated_model_b"],
    }),
  },
};
