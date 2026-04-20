import type {
  LineageCanvasProps,
  LineageGraphEdge,
  LineageGraphNodes,
} from "@datarecce/ui/advanced";
import {
  buildLineageGraph,
  LineageCanvas,
  selectDownstream,
  toReactFlow,
} from "@datarecce/ui/advanced";
import type { MergedLineageResponse } from "@datarecce/ui/api";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import lineageData from "./jaffle-shop-expand-lineage.json";

/**
 * @file LineageDiffComplete.stories.tsx
 * @description Lineage diff view using real dbt artifacts from jaffle-shop-expand.
 *
 * Fixture source: https://github.com/DataRecce/jaffle-shop-expand/pull/1
 *
 * The PR fixes a bug in `stg_orders` where `ordered_at` was truncated to
 * day granularity via `date_trunc('day')`, silently breaking all downstream
 * hourly analysis models. The fixture captures the Recce diff between
 * base (main) and current (the fix branch) of this ~1,149-node project.
 *
 * The fixture is delta-compressed: base is stored fully, current is
 * reconstructed by merging base with the delta (only the 1 changed node).
 *
 * To regenerate the fixture:
 *   1. cd into jaffle-shop-expand with prepared target/ and target-base/
 *   2. recce server --target-base-path target-base
 *   3. curl -s http://localhost:8000/api/info | python3 -c \
 *        "import json,sys; d=json.load(sys.stdin)['lineage']; ..." \
 *        > stories/lineage/jaffle-shop-expand-lineage.json
 *      (See the extraction one-liner in the PR description for the full command)
 */

const meta: Meta<typeof LineageCanvas> = {
  title: "Lineage/Complete Lineage Diff",
  component: LineageCanvas,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `Lineage diff view using real dbt artifacts from [jaffle-shop-expand](https://github.com/DataRecce/jaffle-shop-expand).

Based on [PR #1](https://github.com/DataRecce/jaffle-shop-expand/pull/1): a one-line fix to \`stg_orders\` that impacts 500+ downstream nodes. The fixture is extracted directly from the Recce server API, so the graph uses the same \`buildLineageGraph()\` and \`selectDownstream()\` code paths as the real product.`,
      },
    },
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof LineageCanvas>;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Reconstruct current from base + delta, then build the LineageGraph.
 *
 * The fixture is delta-compressed to stay under the default
 * check-added-large-files limit: base is stored fully, and current_delta
 * contains only the nodes/parent_map entries that differ (1 node for this PR).
 */
function buildRealLineageGraph() {
  const { base, current_delta: delta, diff } = lineageData;

  // Reconstruct current by overlaying delta onto base
  const baseNodes = base.nodes as Record<
    string,
    { name: string; resource_type?: string; package_name?: string }
  >;
  const deltaNodes = delta.nodes as Record<
    string,
    { name: string; resource_type?: string; package_name?: string }
  >;
  const currentNodes = { ...baseNodes, ...deltaNodes };
  const currentParentMap = { ...base.parent_map, ...delta.parent_map };

  // Convert old format to MergedLineageResponse
  const mergedNodes: MergedLineageResponse["nodes"] = {};
  const allNodeIds = new Set([
    ...Object.keys(baseNodes),
    ...Object.keys(currentNodes),
  ]);
  for (const id of allNodeIds) {
    const node = currentNodes[id] ?? baseNodes[id];
    const diffEntry = (
      diff as Record<string, { change_status: string; change: unknown }>
    )[id];
    mergedNodes[id] = {
      name: node.name,
      resource_type: node.resource_type ?? "model",
      package_name: node.package_name ?? "",
      change_status: diffEntry?.change_status as
        | "added"
        | "removed"
        | "modified"
        | undefined,
      change:
        diffEntry?.change as MergedLineageResponse["nodes"][string]["change"],
    };
  }

  const mergedEdges: MergedLineageResponse["edges"] = [];
  for (const [childId, parentIds] of Object.entries(currentParentMap)) {
    for (const parentId of parentIds as string[]) {
      mergedEdges.push({ source: parentId, target: childId });
    }
  }

  return buildLineageGraph({
    nodes: mergedNodes,
    edges: mergedEdges,
    metadata: {
      base: {
        manifest_metadata:
          base.manifest_metadata as MergedLineageResponse["metadata"]["base"]["manifest_metadata"],
      },
      current: {
        manifest_metadata:
          delta.manifest_metadata as MergedLineageResponse["metadata"]["current"]["manifest_metadata"],
      },
    },
  });
}

function adaptForCanvas(
  rawNodes: LineageGraphNodes[],
  rawEdges: LineageGraphEdge[],
): { nodes: LineageCanvasProps["nodes"]; edges: LineageCanvasProps["edges"] } {
  const nodes = rawNodes.map((node: LineageGraphNodes) => {
    if (node.type === "lineageGraphNode") {
      const graphData = node.data as {
        name: string;
        resourceType?: string;
        changeStatus?: string;
        packageName?: string;
      };
      return {
        ...node,
        type: "lineageNode" as const,
        data: {
          label: graphData.name,
          resourceType: graphData.resourceType,
          changeStatus: graphData.changeStatus,
          packageName: graphData.packageName,
        },
      };
    }
    return node;
  });

  const edges = rawEdges.map((edge: LineageGraphEdge) => ({
    ...edge,
    type: edge.type === "lineageGraphEdge" ? "lineageEdge" : edge.type,
  }));

  return {
    nodes: nodes as LineageCanvasProps["nodes"],
    edges: edges as LineageCanvasProps["edges"],
  };
}

// =============================================================================
// STORIES
// =============================================================================

/**
 * Wrapper that builds the impacted subgraph: modified nodes + all downstream.
 */
function ImpactedLineageDiffDemo() {
  const { nodes, edges, impactedCount, modifiedNames } = useMemo(() => {
    const graph = buildRealLineageGraph();

    // selectDownstream includes the seed nodes, but we merge explicitly for clarity
    const downstreamSet = selectDownstream(graph, graph.modifiedSet);
    const impactedIds = [...new Set([...graph.modifiedSet, ...downstreamSet])];

    const [rawNodes, rawEdges] = toReactFlow(graph, {
      selectedNodes: impactedIds,
    });
    const adapted = adaptForCanvas(rawNodes, rawEdges);

    return {
      ...adapted,
      impactedCount: impactedIds.length,
      modifiedNames: graph.modifiedSet.map(
        (id) => graph.nodes[id]?.data.name ?? id,
      ),
    };
  }, []);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Typography variant="subtitle2">jaffle-shop-expand</Typography>
        <Chip
          label={`${impactedCount} impacted nodes`}
          size="small"
          variant="outlined"
        />
        {modifiedNames.map((name) => (
          <Chip
            key={name}
            label={name}
            size="small"
            color="warning"
            variant="outlined"
          />
        ))}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <LineageCanvas
          nodes={nodes}
          edges={edges}
          showMiniMap
          showControls
          showBackground
          height={800}
          interactive
        />
      </Box>
    </Box>
  );
}

export const ImpactedDiff: Story = {
  name: "Impacted Lineage Diff",
  parameters: {
    docs: {
      description: {
        story: `
Based on [DataRecce/jaffle-shop-expand#1](https://github.com/DataRecce/jaffle-shop-expand/pull/1).

**The bug:** \`stg_orders\` used \`date_trunc('day', ordered_at)\` which truncated timestamps to midnight, silently breaking all downstream hourly analysis (e.g. \`int_order_throughput_by_hour\`, \`int_peak_hour_analysis\` — \`extract(hour)\` always returned 0).

**The fix:** Pass through \`ordered_at\` as-is — staging models should preserve source granularity.

**What you see:** The modified node (\`stg_orders\`) plus all its downstream dependents (~563 nodes), filtered via \`selectDownstream()\`. This matches the "changed models" view in the real Recce UI.
        `,
      },
    },
    layout: "fullscreen",
  },
  render: () => <ImpactedLineageDiffDemo />,
};
