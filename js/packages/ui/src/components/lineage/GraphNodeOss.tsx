"use client";

/**
 * @file GraphNodeOss.tsx
 * @description OSS wrapper for UI package LineageNode component
 *
 * This component wraps the @datarecce/ui LineageNode with OSS-specific
 * context integration. It extracts state from LineageViewContext and
 * LineageGraphContext and passes it as props to the presentation component.
 *
 * Migration: Phase 4 of lineage component migration plan
 *
 * OSS-specific functionality injected:
 * - Run type icons from registry (schema_diff, row_count_diff)
 * - ActionTag with OSS run result parsing
 * - NodeRunsAggregated with schema change detection
 */

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiTooltip from "@mui/material/Tooltip";
import { type NodeProps, useStore } from "@xyflow/react";
import { memo } from "react";
import type { LineageGraphNode } from "../..";
import { COLUMN_HEIGHT, isSchemaChanged } from "../..";
import { isRowCountDiffRun, type RowCountDiff } from "../../api";
import {
  useLineageGraphContext,
  useLineageViewContextSafe,
} from "../../contexts";
import { useThemeColors } from "../../hooks";
import { deltaPercentageString } from "../../utils";
import { findByRunType } from "../run";
import {
  ActionTag,
  type ChangeCategory,
  LineageNode,
  type NodeChangeStatus,
  type SelectMode,
} from "./nodes";
import { getIconForChangeStatus } from "./styles";

// =============================================================================
// TYPES
// =============================================================================

export type GraphNodeProps = NodeProps<LineageGraphNode>;

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * Row count diff tag component with OSS icon injection
 */
function RowCountDiffTag({ rowCount }: { rowCount: RowCountDiff }) {
  const base = rowCount.base;
  const current = rowCount.curr;
  const baseLabel = rowCount.base === null ? "N/A" : `${rowCount.base} Rows`;
  const currentLabel = rowCount.curr === null ? "N/A" : `${rowCount.curr} Rows`;

  let tagLabel: string;
  let chipColor: "default" | "success" | "error";

  if (base === null && current === null) {
    tagLabel = "Failed to load";
    chipColor = "default";
  } else if (base === null || current === null) {
    tagLabel = `${baseLabel} -> ${currentLabel}`;
    chipColor = base === null ? "success" : "error";
  } else if (base === current) {
    tagLabel = "=";
    chipColor = "default";
  } else {
    tagLabel = `${deltaPercentageString(base, current)} Rows`;
    chipColor = base < current ? "success" : "error";
  }

  const RowCountIcon = findByRunType("row_count_diff").icon;

  return (
    <Chip
      size="small"
      color={chipColor}
      icon={RowCountIcon ? <RowCountIcon /> : undefined}
      label={tagLabel}
      sx={{ height: 20, fontSize: "0.7rem" }}
    />
  );
}

/**
 * Node runs aggregated display component with OSS-specific icons
 * Shows schema diff indicator and row count diff for models
 */
function NodeRunsAggregatedDisplay({
  id,
  inverted,
}: {
  id: string;
  inverted: boolean;
}) {
  const { lineageGraph, runsAggregated } = useLineageGraphContext();
  const { text, isDark } = useThemeColors();
  const runs = runsAggregated?.[id];
  const node = lineageGraph?.nodes[id];

  if (!runs && !node) {
    return null;
  }

  let schemaChanged: boolean | undefined;
  if (node?.data.data.base && node.data.data.current) {
    const baseColumns = node.data.data.base.columns;
    const currColumns = node.data.data.current.columns;
    schemaChanged = isSchemaChanged(baseColumns, currColumns);
  }

  let rowCountChanged: boolean | undefined;
  if (runs?.row_count_diff) {
    const rowCountDiff = runs.row_count_diff;
    const result = rowCountDiff.result as RowCountDiff;
    rowCountChanged = result.curr !== result.base;
  }

  const colorChanged = inverted
    ? text.inverted
    : getIconForChangeStatus("modified").color;
  const colorUnchanged = inverted
    ? text.secondary
    : isDark
      ? "grey.700"
      : "grey.100";

  const SchemaDiffIcon = findByRunType("schema_diff").icon;

  return (
    <Box sx={{ display: "flex", flex: 1, alignItems: "center" }}>
      {schemaChanged !== undefined && (
        <MuiTooltip
          title={`Schema (${schemaChanged ? "changed" : "no change"})`}
          enterDelay={500}
        >
          <Box sx={{ height: 16 }}>
            {SchemaDiffIcon && (
              <Box
                component={SchemaDiffIcon}
                sx={{ color: schemaChanged ? colorChanged : colorUnchanged }}
              />
            )}
          </Box>
        </MuiTooltip>
      )}
      <Box sx={{ flexGrow: 1 }} />
      {runs?.row_count_diff && rowCountChanged !== undefined && (
        <MuiTooltip
          title={`Row count (${rowCountChanged ? "changed" : "="})`}
          enterDelay={500}
        >
          <Box>
            <RowCountDiffTag
              rowCount={runs.row_count_diff.result as RowCountDiff}
            />
          </Box>
        </MuiTooltip>
      )}
    </Box>
  );
}

/**
 * Action tag display component - bridges OSS run data to UI ActionTag
 * Parses OSS-specific run results and renders using UI package ActionTag
 */
function ActionTagDisplay({
  nodeId,
  nodeName,
}: {
  nodeId: string;
  nodeName: string;
}) {
  const { getNodeAction } = useLineageViewContextSafe();
  const action = getNodeAction(nodeId);

  if (!action) {
    return null;
  }

  const { status, skipReason, run } = action;

  // Map OSS action status to UI ActionTag props
  if (status === "pending") {
    return <ActionTag status="pending" />;
  }

  if (status === "skipped") {
    return <ActionTag status="skipped" skipReason={skipReason} />;
  }

  if (!run) {
    return <ActionTag status="pending" />;
  }

  const { error, run_id, progress } = run;

  if (status === "running") {
    return (
      <ActionTag
        status="running"
        progress={{ percentage: progress?.percentage }}
      />
    );
  }

  if (error) {
    return <ActionTag status="error" errorMessage={error} />;
  }

  // Value diff result - parse OSS format to UI format
  if (run.type === "value_diff" && run.result) {
    const r = run.result as { data: { data: unknown[][] } };
    let mismatched = 0;
    const totalColumns = r.data.data.length;

    for (const c of r.data.data) {
      if ((c[2] as number) < 1) {
        mismatched++;
      }
    }

    return (
      <ActionTag
        status="success"
        valueDiffResult={{ mismatchedColumns: mismatched, totalColumns }}
      />
    );
  }

  // Row count diff result - use OSS RowCountDiffTag with icon
  if (isRowCountDiffRun(run) && run.result) {
    const result = run.result;
    const nodeResult = result[nodeName];
    if (nodeResult) {
      return <RowCountDiffTag rowCount={nodeResult} />;
    }
  }

  // Row count result
  if (run.type === "row_count" && run.result) {
    const result = run.result as Record<string, { curr: number | null }>;
    const nodeResult = result[nodeName];
    if (nodeResult?.curr !== undefined && nodeResult.curr !== null) {
      return (
        <Chip
          size="small"
          label={`${nodeResult.curr.toLocaleString()} Rows`}
          sx={{ height: 20, fontSize: "0.7rem" }}
        />
      );
    }
  }

  return <ActionTag status="success" runId={run_id} />;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * GraphNode - OSS wrapper for UI package LineageNode
 *
 * This component integrates LineageViewContext and LineageGraphContext
 * with the pure presentation LineageNode from @datarecce/ui.
 */
function GraphNodeComponent(nodeProps: GraphNodeProps) {
  const { data } = nodeProps;
  const { id, resourceType, changeStatus, name } = data;

  // Get zoom level for content visibility
  const showContent = useStore((s) => s.transform[2] > 0.3);

  // Get theme colors
  const { isDark } = useThemeColors();

  // Get context values
  const {
    interactive,
    selectNode,
    selectMode,
    focusedNode,
    getNodeAction,
    getNodeColumnSet,
    isNodeHighlighted,
    isNodeSelected,
    isNodeShowingChangeAnalysis,
    showContextMenu,
    viewOptions,
    cll,
    showColumnLevelLineage,
  } = useLineageViewContextSafe();
  const { isActionAvailable } = useLineageGraphContext();

  // Computed state
  const changeCategory = cll?.current.nodes[id]
    ?.change_category as ChangeCategory;
  const isHighlighted = isNodeHighlighted(id);
  const isSelected = isNodeSelected(id);
  const isFocusedByImpactRadius =
    viewOptions.column_level_lineage?.node_id === id &&
    viewOptions.column_level_lineage.column === undefined;
  const isFocused = focusedNode?.id === id || isFocusedByImpactRadius;
  const isShowingChangeAnalysis = isNodeShowingChangeAnalysis(id);
  const columnSet = getNodeColumnSet(data.id);
  const action =
    selectMode === "action_result" ? getNodeAction(data.id) : undefined;

  // Map to UI package types
  const nodeChangeStatus: NodeChangeStatus | undefined = changeStatus as
    | NodeChangeStatus
    | undefined;
  const nodeSelectMode: SelectMode = selectMode as SelectMode;

  // Create action tag if in action_result mode
  const actionTag =
    selectMode === "action_result" && action ? (
      <ActionTagDisplay nodeId={id} nodeName={name} />
    ) : undefined;

  // Create runs aggregated tag if model and not in action_result mode
  const runsAggregatedTag =
    selectMode !== "action_result" && data.resourceType === "model" ? (
      <NodeRunsAggregatedDisplay
        id={data.id}
        inverted={selectMode === "selecting" && isSelected}
      />
    ) : undefined;

  // Callbacks
  const handleSelect = (nodeId: string) => {
    selectNode(nodeId);
  };

  const handleContextMenu = (event: React.MouseEvent, _nodeId: string) => {
    showContextMenu(event, nodeProps as unknown as LineageGraphNode);
  };

  const handleShowImpactRadius = (nodeId: string) => {
    void showColumnLevelLineage({
      node_id: nodeId,
      change_analysis: true,
      no_upstream: true,
    });
  };

  return (
    <LineageNode
      id={id}
      data={{
        label: name,
        changeStatus: nodeChangeStatus,
        resourceType,
      }}
      // Interactive props
      interactive={interactive}
      selectMode={nodeSelectMode}
      isNodeSelected={isSelected}
      isFocused={isFocused}
      isHighlighted={isHighlighted}
      showContent={showContent}
      // Action display props
      actionTag={actionTag}
      showChangeAnalysis={isShowingChangeAnalysis}
      changeCategory={changeCategory}
      runsAggregatedTag={runsAggregatedTag}
      // Layout props
      hasParents={Object.keys(data.parents).length > 0}
      hasChildren={Object.keys(data.children).length > 0}
      columnCount={columnSet.size}
      columnHeight={COLUMN_HEIGHT}
      // Theme props
      isDark={isDark}
      // Callbacks
      onSelect={handleSelect}
      onContextMenu={handleContextMenu}
      onShowImpactRadius={
        changeStatus === "modified" && isActionAvailable("change_analysis")
          ? handleShowImpactRadius
          : undefined
      }
    />
  );
}

export const GraphNode = memo(GraphNodeComponent);
GraphNode.displayName = "GraphNode";
