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
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { type NodeProps, useStore } from "@xyflow/react";
import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import type { LineageGraphNode } from "../..";
import { COLUMN_HEIGHT } from "../..";
import {
  isRowCountDiffRun,
  type NodeRunsAggregated,
  type RowCountDiff,
  type ValidationSummary,
} from "../../api";
import {
  useLineageGraphContext,
  useLineageViewContextSafe,
} from "../../contexts";
import { useThemeColors } from "../../hooks";
import { getSemanticColorTheme } from "../../theme";
import { deltaPercentageString, getRowCountChangeDirection } from "../../utils";
import { findByRunType } from "../run";
import { resolveChangeCategory } from "./changeCategory";
import { CONTENT_VISIBILITY_MIN_ZOOM } from "./config/zoomConstants";
import {
  ActionTag,
  LineageNode,
  type NodeChangeStatus,
  type SelectMode,
} from "./nodes";
import { getIconForChangeStatus } from "./styles";
import { pickWholeModelFlags } from "./wholeModelTreatment";

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
function RowCountDiffTag({
  rowCount,
  isDark,
}: {
  rowCount: RowCountDiff;
  isDark: boolean;
}) {
  const base = rowCount.base;
  const current = rowCount.curr;
  const directionColors = getSemanticColorTheme(isDark).direction;
  const direction = getRowCountChangeDirection(base, current);
  const baseLabel = rowCount.base === null ? "N/A" : `${rowCount.base} Rows`;
  const currentLabel = rowCount.curr === null ? "N/A" : `${rowCount.curr} Rows`;

  let tagLabel: string;
  let directionStyle: typeof directionColors | undefined;

  if (base === null && current === null) {
    tagLabel = "Failed to load";
  } else if (base === null) {
    tagLabel = `Added · ${currentLabel}`;
  } else if (current === null) {
    tagLabel = `Removed · ${baseLabel}`;
  } else if (direction === "unchanged") {
    tagLabel = "=";
    directionStyle = directionColors;
  } else if (direction === "increase") {
    tagLabel = `↑ ${deltaPercentageString(base, current)} Rows`;
    directionStyle = directionColors;
  } else {
    tagLabel = `↓ ${deltaPercentageString(base, current)} Rows`;
    directionStyle = directionColors;
  }

  const RowCountIcon = findByRunType("row_count_diff").icon;

  return (
    <Chip
      size="small"
      icon={RowCountIcon ? <RowCountIcon /> : undefined}
      label={tagLabel}
      data-row-count-direction={direction}
      sx={{
        height: 20,
        fontSize: "0.7rem",
        maxWidth: "100%",
        ...(directionStyle && {
          bgcolor: directionStyle.background,
          border: `1px solid ${directionStyle.border}`,
          color: directionStyle.foreground,
        }),
      }}
    />
  );
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function validationSummaryLabel(summary: ValidationSummary) {
  const resultLabel = countLabel(summary.result_count, "result");
  if (!summary.types.value_diff) {
    return resultLabel;
  }
  return `${resultLabel} · ${countLabel(summary.types.value_diff.difference_count, "diff")}`;
}

function ValidationSummaryDetails({ summary }: { summary: ValidationSummary }) {
  const { value_diff, profile_diff, top_k_diff, histogram_diff } =
    summary.types;

  return (
    <Stack component="dl" spacing={0.75} sx={{ m: 0 }}>
      {value_diff && (
        <Box>
          <Typography component="dt" variant="caption" sx={{ fontWeight: 600 }}>
            Value diff
          </Typography>
          <Typography component="dd" variant="caption" sx={{ m: 0 }}>
            {countLabel(1, "result")} ·{" "}
            {countLabel(value_diff.difference_count, "diff")}
          </Typography>
        </Box>
      )}
      {profile_diff && (
        <Box>
          <Typography component="dt" variant="caption" sx={{ fontWeight: 600 }}>
            Profile diff
          </Typography>
          <Typography component="dd" variant="caption" sx={{ m: 0 }}>
            {countLabel(profile_diff.result_count, "result")}
          </Typography>
        </Box>
      )}
      {top_k_diff && (
        <Box>
          <Typography component="dt" variant="caption" sx={{ fontWeight: 600 }}>
            Top-k diff
          </Typography>
          <Typography component="dd" variant="caption" sx={{ m: 0 }}>
            {countLabel(top_k_diff.column_count, "column")}
          </Typography>
        </Box>
      )}
      {histogram_diff && (
        <Box>
          <Typography component="dt" variant="caption" sx={{ fontWeight: 600 }}>
            Histogram diff
          </Typography>
          <Typography component="dd" variant="caption" sx={{ m: 0 }}>
            {countLabel(histogram_diff.column_count, "column")}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

function ValidationSummaryChip({
  nodeId,
  nodeName,
  summary,
  onOpenAnalysis,
}: {
  nodeId: string;
  nodeName: string;
  summary: ValidationSummary;
  onOpenAnalysis: (nodeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const popoverId = useId();
  const label = validationSummaryLabel(summary);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== undefined) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }, []);
  const showPopover = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);
  const closePopover = useCallback(() => {
    cancelClose();
    setOpen(false);
  }, [cancelClose]);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 100);
  }, [cancelClose]);
  const scheduleCloseUnlessFocused = useCallback(() => {
    if (document.activeElement === buttonRef.current) return;
    scheduleClose();
  }, [scheduleClose]);

  useEffect(() => cancelClose, [cancelClose]);

  const handleEscape = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closePopover();
    buttonRef.current?.focus();
  };

  return (
    <>
      <Box
        ref={buttonRef}
        component="button"
        type="button"
        aria-controls={open ? popoverId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Open validation analysis for ${nodeName}: ${label}`}
        onBlur={closePopover}
        onClick={(event) => {
          event.stopPropagation();
          showPopover();
          onOpenAnalysis(nodeId);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        onFocus={showPopover}
        onKeyDown={handleEscape}
        onMouseEnter={showPopover}
        onMouseLeave={scheduleCloseUnlessFocused}
        onPointerDown={(event) => event.stopPropagation()}
        sx={{
          alignItems: "center",
          appearance: "none",
          background: "transparent",
          border: 0,
          color: "inherit",
          cursor: "pointer",
          display: "flex",
          flex: "0 1 auto",
          margin: 0,
          maxWidth: 150,
          minHeight: 24,
          minWidth: 0,
          padding: "2px 0",
        }}
      >
        <Chip
          data-testid="validation-summary-chip"
          label={label}
          size="small"
          variant="outlined"
          sx={{
            height: 20,
            fontSize: "0.7rem",
            maxWidth: "100%",
            pointerEvents: "none",
          }}
        />
      </Box>
      {open && (
        <Popper
          open
          anchorEl={buttonRef.current}
          placement="bottom-start"
          sx={{ zIndex: 1500 }}
        >
          <Paper
            id={popoverId}
            role="dialog"
            aria-label={`${nodeName} validation details`}
            onKeyDown={handleEscape}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleCloseUnlessFocused}
            sx={{ minWidth: 160, p: 1.25 }}
          >
            <ValidationSummaryDetails summary={summary} />
          </Paper>
        </Popper>
      )}
    </>
  );
}

/**
 * Node runs aggregated display component with OSS-specific icons
 * Shows schema diff indicator and row count diff for models
 */
function NodeRunsAggregatedDisplay({
  inverted,
  nodeId,
  nodeName,
  runs,
  schemaChanged,
  onOpenAnalysis,
}: {
  inverted: boolean;
  nodeId: string;
  nodeName: string;
  runs: NodeRunsAggregated | undefined;
  schemaChanged: boolean | undefined;
  onOpenAnalysis: (nodeId: string) => void;
}) {
  const { text, isDark } = useThemeColors();

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
    <Box
      data-testid="node-runs-aggregated-display"
      sx={{
        alignItems: "center",
        display: "flex",
        flex: 1,
        gap: 0.5,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
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
      {runs?.validation_summary && (
        <ValidationSummaryChip
          nodeId={nodeId}
          nodeName={nodeName}
          summary={runs.validation_summary}
          onOpenAnalysis={onOpenAnalysis}
        />
      )}
      {runs?.row_count_diff && rowCountChanged !== undefined && (
        <MuiTooltip
          title={`Row count (${rowCountChanged ? "changed" : "="})`}
          enterDelay={500}
        >
          <Box sx={{ maxWidth: 120, minWidth: 0, overflow: "hidden" }}>
            <RowCountDiffTag
              rowCount={runs.row_count_diff.result as RowCountDiff}
              isDark={isDark}
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
  const { isDark } = useThemeColors();
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
      return <RowCountDiffTag rowCount={nodeResult} isDark={isDark} />;
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
  const showContent = useStore(
    (s) => s.transform[2] > CONTENT_VISIBILITY_MIN_ZOOM,
  );

  // Get theme colors
  const { isDark } = useThemeColors();

  // Get context values
  const lineageViewCtx = useLineageViewContextSafe();
  const { runsAggregated } = useLineageGraphContext();
  const {
    interactive,
    openNodeDetails,
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
    impactedNodeIds,
    newCllExperience,
  } = lineageViewCtx;
  const isImpacted = newCllExperience ? impactedNodeIds.has(id) : false;
  const { isWholeModelChanged, isWholeModelImpacted } = pickWholeModelFlags(
    id,
    lineageViewCtx,
  );

  // Computed state
  const changeCategory = resolveChangeCategory(
    cll?.current.nodes[id]?.change_category,
    newCllExperience ? undefined : data.change?.category,
  );
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
  const nodeRuns = runsAggregated?.[id];
  const schemaChanged =
    data.change?.columns == null
      ? undefined
      : Object.keys(data.change.columns).length > 0;
  const hasVisibleRunsAggregatedData =
    schemaChanged !== undefined ||
    nodeRuns?.row_count_diff !== undefined ||
    nodeRuns?.validation_summary !== undefined;
  const runsAggregatedTag =
    selectMode !== "action_result" &&
    data.resourceType === "model" &&
    hasVisibleRunsAggregatedData ? (
      <NodeRunsAggregatedDisplay
        inverted={selectMode === "selecting" && isSelected}
        nodeId={id}
        nodeName={name}
        onOpenAnalysis={(nodeId) => openNodeDetails(nodeId, "analysis")}
        runs={nodeRuns}
        schemaChanged={schemaChanged}
      />
    ) : undefined;

  // Callbacks
  const handleSelect = (nodeId: string) => {
    selectNode(nodeId);
  };

  const handleContextMenu = (event: React.MouseEvent, _nodeId: string) => {
    showContextMenu(event, nodeProps as unknown as LineageGraphNode);
  };

  return (
    <LineageNode
      id={id}
      data={{
        label: name,
        changeStatus: nodeChangeStatus,
        resourceType,
        materialized: data.materialized,
      }}
      // New CLL experience props
      newCllExperience={newCllExperience}
      isImpacted={isImpacted}
      isWholeModelChanged={isWholeModelChanged}
      isWholeModelImpacted={isWholeModelImpacted}
      // Interactive props
      interactive={interactive}
      selectMode={nodeSelectMode}
      isNodeSelected={isSelected}
      isFocused={isFocused}
      isHighlighted={isHighlighted}
      showContent={showContent}
      // Action display props
      actionTag={actionTag}
      showChangeAnalysis={
        isShowingChangeAnalysis ||
        (!newCllExperience && changeCategory !== undefined)
      }
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
    />
  );
}

export const GraphNode = memo(GraphNodeComponent);
GraphNode.displayName = "GraphNode";
