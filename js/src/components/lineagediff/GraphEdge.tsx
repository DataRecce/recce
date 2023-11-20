import { BaseEdge, EdgeProps, getBezierPath } from "reactflow";
import { LineageGraphEdge } from "./lineagediff";
import { getIconForChangeStatus } from "./styles";

import "./lineagediff.css";

interface GraphEdgeProps extends EdgeProps<LineageGraphEdge> {}

export default function GraphEdge(props: GraphEdgeProps) {
  const {
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

  if (data?.changeStatus) {
    style.stroke = getIconForChangeStatus(data?.changeStatus).color;
    style.strokeDasharray = "5";
  }

  if (data?.isHighlighted === false) {
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
