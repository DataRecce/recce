"use client";

/**
 * @file GraphNode.tsx
 * @description OSS wrapper for UI package LineageNode component
 *
 * This component wraps the @datarecce/ui LineageNode with OSS-specific
 * context integration. It extracts state from LineageViewContext and
 * LineageGraphContext and passes it as props to the presentation component.
 *
 * Migration: Phase 3 of lineage component migration plan
 */

import { isRowCountDiffRun, type RowCountDiff } from "@datarecce/ui/api";
import {
  type ChangeCategory,
  getIconForChangeStatus,
  LineageNode,
  type NodeChangeStatus,
  type SelectMode,
} from "@datarecce/ui/components/lineage";
import { useThemeColors } from "@datarecce/ui/hooks";
import { deltaPercentageString } from "@datarecce/ui/utils";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import { type NodeProps, useStore } from "@xyflow/react";
import { memo } from "react";
import { PiInfo, PiWarning } from "react-icons/pi";

import { useLineageGraphContext } from "@/lib/hooks/LineageGraphAdapter";
import { findByRunType } from "../run/registry";
import { isSchemaChanged } from "../schema/schemaDiff";
import { useLineageViewContextSafe } from "./LineageViewContext";
import { COLUMN_HEIGHT, type LineageGraphNode } from "./lineage";

// =============================================================================
// TYPES
// =============================================================================

export type GraphNodeProps = NodeProps<LineageGraphNode>;

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * Row count diff tag component
 */
function RowCountDiffTag({ rowCount }: { rowCount: RowCountDiff }) {
  const base = rowCount.base;
  const current = rowCount.curr;
  const baseLabel = rowCount.base === null ? "N/A" : `${rowCount.base} Rows`;
  const currentLabel = rowCount.curr === null ? "N/A" : `${rowCount.curr} Rows`;

  let tagLabel: string;
  let chipColor: "default" | "success" | "error" = "default";

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
 * Node runs aggregated display component
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
 * Action tag display component
 * Shows action status (pending, running, error, success) and results
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

  if (status === "pending") {
    return <CircularProgress size={16} />;
  }

  if (status === "skipped") {
    return (
      <Chip
        size="small"
        label={
          <Stack
            direction="row"
            sx={{
              fontSize: "10pt",
              color: "grey.500",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <Box>Skipped</Box>
            {skipReason && (
              <MuiTooltip title={skipReason}>
                <Box component="span" sx={{ display: "flex" }}>
                  <PiInfo />
                </Box>
              </MuiTooltip>
            )}
          </Stack>
        }
        sx={{ bgcolor: "grey.100" }}
      />
    );
  }

  if (!run) {
    return <CircularProgress size={16} />;
  }

  const { error, run_id, progress } = run;

  if (status === "running") {
    if (progress?.percentage === undefined) {
      return <CircularProgress size={16} />;
    }
    return (
      <CircularProgress
        variant="determinate"
        value={progress.percentage * 100}
        size={16}
      />
    );
  }

  if (error) {
    return (
      <Stack
        direction="row"
        sx={{ fontSize: "10pt", color: "gray", alignItems: "center" }}
      >
        <Box>Error</Box>
        <MuiTooltip title={error}>
          <Box component="span" sx={{ display: "flex" }}>
            <PiWarning />
          </Box>
        </MuiTooltip>
      </Stack>
    );
  }

  // Value diff result
  if (run.type === "value_diff" && run.result) {
    const r = run.result as { data: { data: unknown[][] } };
    let mismatched = 0;

    for (const c of r.data.data) {
      if ((c[2] as number) < 1) {
        mismatched++;
      }
    }

    return (
      <Chip
        size="small"
        sx={{
          bgcolor: mismatched > 0 ? "error.light" : "success.light",
        }}
        label={
          <Stack
            direction="row"
            sx={{
              fontSize: "10pt",
              color: mismatched > 0 ? "error.main" : "success.main",
              alignItems: "center",
              gap: "3px",
            }}
          >
            {mismatched > 0
              ? `${mismatched} columns mismatched`
              : "All columns match"}
          </Stack>
        }
      />
    );
  }

  // Row count diff result
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

  return <>{run_id}</>;
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

  const handleContextMenu = (event: React.MouseEvent, nodeId: string) => {
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
        changeStatus === "modified" ? handleShowImpactRadius : undefined
      }
    />
  );
}

export const GraphNode = memo(GraphNodeComponent);
GraphNode.displayName = "GraphNode";
