"use client";

/**
 * @file GraphColumnNode.tsx
 * @description OSS wrapper for UI package LineageColumnNode component
 *
 * This component wraps the @datarecce/ui LineageColumnNode with OSS-specific
 * context integration. It extracts state from LineageViewContext and passes
 * it as props to the presentation component.
 *
 * Migration: Phase 3 of lineage component migration plan
 */

import {
  getIconForChangeStatus,
  LineageColumnNode,
  type LineageColumnNodeData,
} from "@datarecce/ui/components/lineage";
import { useThemeColors } from "@datarecce/ui/hooks";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import type { NodeProps } from "@xyflow/react";
import { useStore } from "@xyflow/react";
import { type MouseEvent, memo } from "react";

import { useLineageViewContextSafe } from "./LineageViewContext";
import type { LineageGraphColumnNode } from "./lineage";

// =============================================================================
// LEGACY EXPORTS (for backward compatibility)
// =============================================================================

/**
 * ChangeStatus - Legacy component for showing change status indicator
 * @deprecated Use LineageColumnNode with showChangeAnalysis prop instead
 */
export const ChangeStatus = ({
  changeStatus,
}: {
  changeStatus?: "added" | "removed" | "modified";
}) => {
  if (!changeStatus) {
    return null;
  }

  const { color: colorChangeStatus, icon: IconChangeStatus } =
    getIconForChangeStatus(changeStatus);

  if (!IconChangeStatus) {
    return null;
  }

  return (
    <Box
      component={IconChangeStatus}
      sx={{
        fontSize: 14,
        display: "inline-flex",
        color: colorChangeStatus,
      }}
    />
  );
};

/**
 * TransformationType - Legacy component for showing transformation type chip
 * @deprecated Use LineageColumnNode component instead
 */
export const TransformationType = ({
  transformationType,
  legend: _legend,
}: {
  transformationType?: string;
  legend?: boolean;
}) => {
  let letter = "U";
  let color: "default" | "error" | "warning" | "info" | "success" = "error";

  if (transformationType === "passthrough") {
    letter = "P";
    color = "default";
  } else if (transformationType === "renamed") {
    letter = "R";
    color = "warning";
  } else if (transformationType === "derived") {
    letter = "D";
    color = "warning";
  } else if (transformationType === "source") {
    letter = "S";
    color = "info";
  } else {
    letter = "U";
    color = "error";
  }

  if (!transformationType) {
    return null;
  }

  return (
    <Chip
      label={letter}
      size="small"
      color={color}
      sx={{
        fontSize: "8pt",
        height: 18,
        minWidth: 18,
        "& .MuiChip-label": {
          px: 0.5,
        },
      }}
    />
  );
};

// =============================================================================
// TYPES
// =============================================================================

export type GraphColumnNodeProps = NodeProps<LineageGraphColumnNode>;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * GraphColumnNode - OSS wrapper for UI package LineageColumnNode
 *
 * This component integrates LineageViewContext with the pure presentation
 * LineageColumnNode from @datarecce/ui.
 */
function GraphColumnNodeComponent(nodeProps: GraphColumnNodeProps) {
  const { id: columnNodeId, data } = nodeProps;
  const { id: nodeId } = data.node;
  const { column, type, transformationType, changeStatus } = data;

  // Get zoom level for content visibility
  const showContent = useStore((s) => s.transform[2] > 0.3);

  // Get theme colors
  const { isDark } = useThemeColors();

  // Get context values
  const {
    viewOptions,
    showContextMenu,
    isNodeHighlighted,
    isNodeShowingChangeAnalysis,
  } = useLineageViewContextSafe();

  // Computed state
  const selectedNode = viewOptions.column_level_lineage?.node_id;
  const selectedColumn = viewOptions.column_level_lineage?.column;
  const isFocused = column === selectedColumn && nodeId === selectedNode;
  const isHighlighted = isNodeHighlighted(columnNodeId);
  const isShowingChangeAnalysis = isNodeShowingChangeAnalysis(nodeId);

  // Build LineageColumnNodeData
  const columnData: LineageColumnNodeData = {
    column,
    type,
    nodeId,
    transformationType:
      transformationType as LineageColumnNodeData["transformationType"],
    changeStatus: changeStatus as LineageColumnNodeData["changeStatus"],
    isHighlighted,
    isFocused,
  };

  // Callbacks
  const handleContextMenu = (event: MouseEvent, _columnId: string) => {
    showContextMenu(event, nodeProps as unknown as LineageGraphColumnNode);
  };

  return (
    <LineageColumnNode
      id={columnNodeId}
      data={columnData}
      showContent={showContent}
      showChangeAnalysis={isShowingChangeAnalysis}
      isDark={isDark}
      onContextMenu={handleContextMenu}
    />
  );
}

export const GraphColumnNode = memo(GraphColumnNodeComponent);
GraphColumnNode.displayName = "GraphColumnNode";
