/**
 * @file GraphEdge.tsx
 * @description OSS wrapper for GraphEdge that injects LineageViewContext dependencies
 *
 * This thin wrapper imports the core GraphEdge component from @datarecce/ui
 * and injects OSS-specific dependencies:
 * - isEdgeHighlighted from LineageViewContext
 */

import type { LineageGraphEdge } from "@datarecce/ui";
import { GraphEdge as GraphEdgeBase } from "@datarecce/ui/components/lineage";
import { useLineageViewContextSafe } from "@datarecce/ui/contexts";
import type { EdgeProps } from "@xyflow/react";

import "@datarecce/ui/styles";

type GraphEdgeProps = EdgeProps<LineageGraphEdge>;

/**
 * OSS GraphEdge component that wraps the UI package's GraphEdge
 * with context-based dependency injection.
 *
 * Injects:
 * - isEdgeHighlighted: from LineageViewContext for context-aware highlighting
 */
export default function GraphEdge(props: GraphEdgeProps) {
  const { isEdgeHighlighted } = useLineageViewContextSafe();

  return <GraphEdgeBase {...props} isEdgeHighlighted={isEdgeHighlighted} />;
}
