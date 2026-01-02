"use client";

import { forwardRef, type Ref } from "react";

/**
 * Props for the LineageView component.
 * Defines options for viewing lineage diff data.
 */
export interface LineageViewProps {
  /**
   * View options for lineage diff visualization
   */
  viewOptions?: {
    view_mode?: "changed_models" | "all";
    node_ids?: string[];
    select?: string;
    exclude?: string;
    packages?: string[];
    column_level_lineage?: {
      node_id?: string;
      column?: string;
      change_analysis?: boolean;
    };
  };
  /**
   * Whether the view allows user interaction
   * @default false
   */
  interactive?: boolean;
  /**
   * Optional weight for layout
   */
  weight?: number;
  /**
   * Optional height for the view
   */
  height?: number;
  /**
   * Optional filter function for nodes
   */
  filterNodes?: (key: string, node: unknown) => boolean;
}

/**
 * Ref interface for LineageView component.
 * Provides methods to interact with the LineageView programmatically.
 */
export interface LineageViewRef {
  /**
   * Copies the current lineage view as an image to the clipboard
   */
  copyToClipboard: () => void;
}

/**
 * LineageView Component
 *
 * A component for visualizing data lineage graphs using React Flow.
 * Shows relationships between models and their change status.
 *
 * This is a placeholder component. For custom lineage visualization, use the
 * lineage utilities exported from @datarecce/ui:
 *
 * - `buildLineageGraph()` - Build a LineageGraph from server data
 * - `toReactFlowBasic()` - Convert graph to React Flow nodes/edges
 * - `layoutWithDagre()` - Apply dagre layout (you provide dagre instance)
 * - `selectUpstream()/selectDownstream()` - Select related nodes
 *
 * @example Building a custom lineage view
 * ```tsx
 * import dagre from '@dagrejs/dagre';
 * import { ReactFlow } from '@xyflow/react';
 * import {
 *   buildLineageGraph,
 *   toReactFlowBasic,
 *   layoutWithDagre,
 *   LineageGraphProvider,
 * } from '@datarecce/ui';
 *
 * function CustomLineageView({ serverInfo }) {
 *   const lineageGraph = buildLineageGraph(
 *     serverInfo.lineage.base,
 *     serverInfo.lineage.current,
 *     serverInfo.lineage.diff
 *   );
 *
 *   const [nodes, edges] = toReactFlowBasic(lineageGraph);
 *   layoutWithDagre(dagre, nodes, edges);
 *
 *   return (
 *     <ReactFlow nodes={nodes} edges={edges} fitView />
 *   );
 * }
 * ```
 *
 * For the full-featured LineageView with column-level lineage, interactive
 * selection, and all OSS features, use the Recce application directly.
 */
export const LineageView = forwardRef<LineageViewRef, LineageViewProps>(
  function LineageView(_props: LineageViewProps, _ref: Ref<LineageViewRef>) {
    throw new Error(
      "LineageView is a placeholder. For custom lineage visualization, use " +
        "the utilities: buildLineageGraph(), toReactFlowBasic(), layoutWithDagre(). " +
        "See the JSDoc example above for implementation details.",
    );
  },
);
