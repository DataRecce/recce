"use client";

/**
 * @file GraphColumnNodeOss.tsx
 * @description OSS wrapper for UI package LineageColumnNode component
 *
 * This component wraps the @datarecce/ui LineageColumnNode with OSS-specific
 * context integration. It extracts state from LineageViewContext and passes
 * it as props to the presentation component.
 *
 * Migration: Phase 3 of lineage component migration plan
 */

import type { NodeProps } from "@xyflow/react";
import { useStore } from "@xyflow/react";
import { type MouseEvent, memo } from "react";
import type { LineageGraphColumnNode } from "../..";
import { useLineageViewContextSafe } from "../../contexts";
import { useThemeColors } from "../../hooks";
import { LineageColumnNode, type LineageColumnNodeData } from "./columns";

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
