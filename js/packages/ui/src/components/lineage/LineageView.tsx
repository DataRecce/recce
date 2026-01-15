"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import type { Edge, Node } from "@xyflow/react";
import { toPng } from "html-to-image";
import {
  forwardRef,
  type Ref,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import { useLineageGraphContext } from "../../contexts/lineage";
import type {
  LineageGraph,
  LineageGraphEdge,
  LineageGraphNode,
} from "../../contexts/lineage/types";
import {
  selectDownstream,
  selectUpstream,
  toReactFlowBasic,
} from "../../contexts/lineage/utils";
import type { LineageEdgeData } from "./edges";
import { LineageCanvas } from "./LineageCanvas";
import type { LineageNodeData } from "./nodes";

/**
 * Props for the LineageView component.
 * Defines options for viewing lineage diff data.
 */
export interface LineageViewProps {
  /**
   * Optional lineage graph data. If not provided, uses LineageGraphContext.
   */
  lineageGraph?: LineageGraph;

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
   * @default true
   */
  interactive?: boolean;

  /**
   * Optional height for the view
   * @default 600
   */
  height?: number | string;

  /**
   * Optional filter function for nodes
   */
  filterNodes?: (key: string, node: LineageGraphNode) => boolean;

  /**
   * Callback when a node is selected
   */
  onNodeSelect?: (nodeId: string | null) => void;

  /**
   * Callback when a node is double-clicked
   */
  onNodeDoubleClick?: (nodeId: string) => void;

  /**
   * Optional dagre instance for layout.
   * If not provided, nodes will be positioned at (0,0).
   * Install @dagrejs/dagre and pass the imported module.
   */
  // biome-ignore lint/suspicious/noExplicitAny: dagre is external dependency
  dagre?: any;

  /**
   * Whether to show the minimap
   * @default true
   */
  showMiniMap?: boolean;

  /**
   * Whether to show the controls
   * @default true
   */
  showControls?: boolean;

  /**
   * Whether to show the background grid
   * @default true
   */
  showBackground?: boolean;
}

/**
 * Ref interface for LineageView component.
 * Provides methods to interact with the LineageView programmatically.
 */
export interface LineageViewRef {
  /**
   * Copies the current lineage view as an image to the clipboard
   */
  copyToClipboard: () => Promise<void>;
}

/**
 * LineageView Component
 *
 * A high-level component for visualizing data lineage graphs using React Flow.
 * Shows relationships between models and their change status.
 *
 * Can receive data from:
 * 1. LineageGraphContext (wrap with LineageGraphProvider)
 * 2. Direct prop (pass lineageGraph prop)
 *
 * For auto-layout, provide a dagre instance:
 *
 * @example Using with context
 * ```tsx
 * import { LineageGraphProvider, LineageView } from '@datarecce/ui';
 * import dagre from '@dagrejs/dagre';
 *
 * function App() {
 *   return (
 *     <LineageGraphProvider serverInfo={serverInfo}>
 *       <LineageView dagre={dagre} />
 *     </LineageGraphProvider>
 *   );
 * }
 * ```
 *
 * @example Using with direct data
 * ```tsx
 * import { buildLineageGraph, LineageView } from '@datarecce/ui';
 * import dagre from '@dagrejs/dagre';
 *
 * function App({ serverInfo }) {
 *   const lineageGraph = buildLineageGraph(
 *     serverInfo.lineage.base,
 *     serverInfo.lineage.current,
 *     serverInfo.lineage.diff
 *   );
 *
 *   return <LineageView lineageGraph={lineageGraph} dagre={dagre} />;
 * }
 * ```
 */
export const LineageView = forwardRef<LineageViewRef, LineageViewProps>(
  function LineageView(props: LineageViewProps, ref: Ref<LineageViewRef>) {
    const {
      lineageGraph: propLineageGraph,
      viewOptions,
      interactive = true,
      height = 600,
      filterNodes,
      onNodeSelect,
      onNodeDoubleClick,
      dagre,
      showMiniMap = true,
      showControls = true,
      showBackground = true,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);

    // Get lineage graph from context or props
    const contextValue = useLineageGraphContext();
    const lineageGraph = propLineageGraph ?? contextValue.lineageGraph;
    const isLoading = !propLineageGraph && contextValue.isLoading;
    const error = !propLineageGraph ? contextValue.error : undefined;

    // Apply filtering and convert to React Flow format
    const { nodes, edges } = useMemo((): {
      nodes: Node<LineageNodeData>[];
      edges: Edge<LineageEdgeData>[];
    } => {
      if (!lineageGraph) {
        return { nodes: [], edges: [] };
      }

      // Determine which nodes to include
      let selectedNodeIds: string[] | undefined;

      if (viewOptions?.node_ids && viewOptions.node_ids.length > 0) {
        // Explicit node selection
        selectedNodeIds = viewOptions.node_ids;
      } else if (viewOptions?.view_mode === "changed_models") {
        // Only changed models
        selectedNodeIds = lineageGraph.modifiedSet;
      }

      // Apply select/exclude patterns (simplified - expand upstream/downstream)
      if (viewOptions?.select && selectedNodeIds) {
        // Simple pattern: +upstream, +downstream
        if (viewOptions.select.includes("+")) {
          const upstream = selectUpstream(lineageGraph, selectedNodeIds);
          const downstream = selectDownstream(lineageGraph, selectedNodeIds);
          selectedNodeIds = [...new Set([...upstream, ...downstream])];
        }
      }

      // Apply package filter
      if (viewOptions?.packages && viewOptions.packages.length > 0) {
        const packageSet = new Set(viewOptions.packages);
        const allNodeIds = selectedNodeIds ?? Object.keys(lineageGraph.nodes);
        selectedNodeIds = allNodeIds.filter((id) => {
          const node = lineageGraph.nodes[id];
          return (
            node?.data.packageName && packageSet.has(node.data.packageName)
          );
        });
      }

      // Apply custom filter
      if (filterNodes) {
        const allNodeIds = selectedNodeIds ?? Object.keys(lineageGraph.nodes);
        selectedNodeIds = allNodeIds.filter((id) => {
          const node = lineageGraph.nodes[id];
          return node ? filterNodes(id, node) : false;
        });
      }

      // Convert to React Flow format (internal types)
      const [rfNodes, rfEdges] = toReactFlowBasic(
        lineageGraph,
        selectedNodeIds,
      );

      // Apply dagre layout if provided
      if (dagre && rfNodes.length > 0) {
        applyDagreLayout(dagre, rfNodes, rfEdges);
      }

      // Convert to presentation types (LineageNodeData / LineageEdgeData)
      const presentationNodes: Node<LineageNodeData>[] = rfNodes.map(
        (node) => ({
          id: node.id,
          position: node.position,
          type: "lineageNode",
          data: {
            label: node.data.name,
            nodeType: node.data.resourceType,
            changeStatus: node.data.changeStatus,
            resourceType: node.data.resourceType,
            packageName: node.data.packageName,
          },
        }),
      );

      const presentationEdges: Edge<LineageEdgeData>[] = rfEdges.map(
        (edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "lineageEdge",
          data: {
            changeStatus: edge.data?.changeStatus,
          },
        }),
      );

      return {
        nodes: presentationNodes,
        edges: presentationEdges,
      };
    }, [lineageGraph, viewOptions, filterNodes, dagre]);

    // Copy to clipboard implementation
    const copyToClipboard = useCallback(async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        const dataUrl = await toPng(containerRef.current, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
        });

        const response = await fetch(dataUrl);
        const blob = await response.blob();

        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        throw err;
      }
    }, []);

    // Expose ref methods
    useImperativeHandle(
      ref,
      () => ({
        copyToClipboard,
      }),
      [copyToClipboard],
    );

    // Loading state
    if (isLoading) {
      return (
        <Box
          sx={{
            width: "100%",
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress />
        </Box>
      );
    }

    // Error state
    if (error) {
      return (
        <Box
          sx={{
            width: "100%",
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="error">{error}</Typography>
        </Box>
      );
    }

    // No data state
    if (!lineageGraph) {
      return (
        <Box
          sx={{
            width: "100%",
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">
            No lineage data available. Provide data via LineageGraphProvider or
            lineageGraph prop.
          </Typography>
        </Box>
      );
    }

    // Empty after filtering
    if (nodes.length === 0) {
      return (
        <Box
          sx={{
            width: "100%",
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">
            No nodes match the current filter criteria.
          </Typography>
        </Box>
      );
    }

    return (
      <Box ref={containerRef} sx={{ width: "100%", height }}>
        <LineageCanvas
          nodes={nodes}
          edges={edges}
          onNodeSelect={onNodeSelect}
          onNodeDoubleClick={onNodeDoubleClick}
          showMiniMap={showMiniMap}
          showControls={showControls}
          showBackground={showBackground}
          height="100%"
          interactive={interactive}
        />
      </Box>
    );
  },
);

/**
 * Apply dagre layout to nodes and edges (internal helper)
 */
function applyDagreLayout(
  // biome-ignore lint/suspicious/noExplicitAny: dagre is external dependency
  dagre: any,
  nodes: LineageGraphNode[],
  edges: LineageGraphEdge[],
  direction = "LR",
): void {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 50, nodesep: 30 });

  for (const node of nodes) {
    const width = node.style?.width ? Number(node.style.width) : 300;
    const height = node.style?.height ? Number(node.style.height) : 60;
    dagreGraph.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  dagre.layout(dagreGraph);

  for (const node of nodes) {
    const nodeWidth = node.style?.width ? Number(node.style.width) : 300;
    const nodeHeight = node.style?.height ? Number(node.style.height) : 60;
    const nodeWithPosition = dagreGraph.node(node.id);

    if (nodeWithPosition) {
      node.position = {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      };
    }
  }
}
