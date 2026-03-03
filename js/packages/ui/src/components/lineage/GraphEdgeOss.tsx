"use client";

/**
 * @file GraphEdgeOss.tsx
 * @description wrapper for GraphEdge that injects LineageViewContext dependencies
 *
 * This thin wrapper imports the core GraphEdge component from @datarecce/ui
 * and injects dependencies:
 * - isEdgeHighlighted from LineageViewContext
 */

import type { EdgeProps } from "@xyflow/react";
import type { LineageGraphEdge } from "../..";
import { useLineageViewContextSafe } from "../../contexts";
import { GraphEdge as GraphEdgeBase } from "./edges";

import "../../styles";

type GraphEdgeProps = EdgeProps<LineageGraphEdge>;

/**
 * OSS GraphEdge component that wraps the UI package's GraphEdge
 * with context-based dependency injection.
 *
 * Injects:
 * - isEdgeHighlighted: from LineageViewContext for context-aware highlighting
 */
export default function GraphEdgeOss(props: GraphEdgeProps) {
  const { isEdgeHighlighted } = useLineageViewContextSafe();

  return <GraphEdgeBase {...props} isEdgeHighlighted={isEdgeHighlighted} />;
}
