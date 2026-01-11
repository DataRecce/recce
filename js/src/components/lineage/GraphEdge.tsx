import type { LineageGraphEdge } from "@datarecce/ui";
import { getIconForChangeStatus } from "@datarecce/ui/components/lineage";
import { BaseEdge, type EdgeProps, getBezierPath } from "@xyflow/react";
import { useLineageViewContextSafe } from "./LineageViewContext";

import "./styles.css";

type GraphEdgeProps = EdgeProps<LineageGraphEdge>;

export default function GraphEdge(props: GraphEdgeProps) {
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
  } = props;

  const style = {
    ...styleOverride,
  };

  const { isEdgeHighlighted } = useLineageViewContextSafe();

  if (data?.changeStatus) {
    style.stroke = getIconForChangeStatus(data.changeStatus).hexColor;
    style.strokeDasharray = "5";
  }

  const isHighlighted = isEdgeHighlighted(source, target);

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
