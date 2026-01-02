"use client";

import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from "@xyflow/react";
import { memo } from "react";

export type EdgeChangeStatus = "added" | "removed" | "modified" | "unchanged";

export interface LineageEdgeData extends Record<string, unknown> {
  /** Change status for diff visualization */
  changeStatus?: EdgeChangeStatus;
  /** Whether this edge is highlighted */
  isHighlighted?: boolean;
  /** Label to display on edge */
  label?: string;
}

export type LineageEdgeType = Edge<LineageEdgeData>;

export type LineageEdgeProps = EdgeProps<LineageEdgeType>;

const statusColors: Record<EdgeChangeStatus, string> = {
  added: "#22c55e",
  removed: "#ef4444",
  modified: "#f59e0b",
  unchanged: "#94a3b8",
};

function LineageEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: LineageEdgeProps) {
  const changeStatus: EdgeChangeStatus = data?.changeStatus ?? "unchanged";
  const isHighlighted = data?.isHighlighted ?? false;
  const label = data?.label;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = statusColors[changeStatus];
  const strokeWidth = isHighlighted || selected ? 2.5 : 1.5;
  const strokeOpacity = isHighlighted || selected ? 1 : 0.6;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          opacity: strokeOpacity,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              fontWeight: 500,
              background: "white",
              padding: "2px 4px",
              borderRadius: 4,
              pointerEvents: "all",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const LineageEdge = memo(LineageEdgeComponent);
LineageEdge.displayName = "LineageEdge";
