"use client";

/**
 * @file GraphEdge.tsx
 * @description Graph edge component with dependency injection for highlighting
 *
 * This component renders a bezier edge in a React Flow graph with support for:
 * - Change status styling (added, removed edges)
 * - Highlighting via dependency injection
 * - Style customization
 *
 * The component uses dependency injection for context-dependent behavior,
 * allowing the OSS wrapper to inject its own highlighting logic.
 */

import { BaseEdge, type EdgeProps, getBezierPath } from "@xyflow/react";
import { memo } from "react";
import type { LineageGraphEdge } from "../../../contexts/lineage/types";
import { type ChangeStatus, getIconForChangeStatus } from "../styles";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data structure for graph edge - re-exported from LineageGraphEdge for convenience
 */
export type GraphEdgeData = LineageGraphEdge["data"];

/**
 * Edge type for React Flow - uses LineageGraphEdge from contexts
 */
export type GraphEdgeType = LineageGraphEdge;

/**
 * Props for the GraphEdge component with dependency injection
 */
export interface GraphEdgeProps extends EdgeProps<LineageGraphEdge> {
  /**
   * Dependency injection: function to determine if an edge is highlighted.
   * When not provided, the edge is always highlighted (fully visible).
   *
   * @param source - Source node ID
   * @param target - Target node ID
   * @returns Whether the edge should be highlighted
   *
   * @example
   * ```tsx
   * // Inject highlighting from context
   * const { isEdgeHighlighted } = useLineageViewContext();
   * <GraphEdge {...props} isEdgeHighlighted={isEdgeHighlighted} />
   * ```
   */
  isEdgeHighlighted?: (source: string, target: string) => boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Graph edge component for lineage visualization
 *
 * Renders a bezier edge with:
 * - Color based on change status (green for added, red for removed)
 * - Dashed line for changed edges
 * - Dimmed appearance for non-highlighted edges
 *
 * @param props - Edge props including source/target coordinates and data
 * @returns Rendered SVG edge element
 *
 * @example
 * ```tsx
 * // Basic usage (always highlighted)
 * <GraphEdge {...edgeProps} />
 *
 * // With dependency injection for highlighting
 * <GraphEdge
 *   {...edgeProps}
 *   isEdgeHighlighted={(source, target) => highlightedEdges.has(`${source}-${target}`)}
 * />
 * ```
 */
function GraphEdgeComponent(props: GraphEdgeProps) {
  const {
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style: styleOverride = {},
    markerEnd,
    data,
    isEdgeHighlighted,
  } = props;

  const style: React.CSSProperties = {
    ...styleOverride,
  };

  // Apply change status styling
  if (data?.changeStatus) {
    // Cast to ChangeStatus from styles module (added, removed, modified, unchanged)
    const statusStyle = getIconForChangeStatus(
      data.changeStatus as ChangeStatus,
    );
    style.stroke = statusStyle.hexColor;
    style.strokeDasharray = "5";
  }

  // Apply highlighting filter via dependency injection
  // Default to highlighted (true) if no function provided
  const isHighlighted = isEdgeHighlighted
    ? isEdgeHighlighted(source, target)
    : true;

  if (!isHighlighted) {
    style.filter = "opacity(0.2) grayscale(50%)";
  }

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, ...styleOverride }}
      />
    </>
  );
}

/**
 * Memoized GraphEdge component for performance optimization
 */
export const GraphEdge = memo(GraphEdgeComponent);
GraphEdge.displayName = "GraphEdge";
