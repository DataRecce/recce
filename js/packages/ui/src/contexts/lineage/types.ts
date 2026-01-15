import type { Edge, Node } from "@xyflow/react";
import type React from "react";
import type { CllInput, ColumnLineageData } from "../../api/cll";
import type {
  CatalogMetadata,
  GitInfo,
  ManifestMetadata,
  NodeData,
  PullRequestInfo,
  SQLMeshInfo,
  StateMetadata,
} from "../../api/info";
import type { LineageDiffViewOptions } from "../../api/lineagecheck";
import type { RunsAggregated } from "../../api/runs";
import type { Run } from "../../api/types";

/**
 * Environment information derived from server info
 */
export interface EnvInfo {
  stateMetadata?: StateMetadata;
  adapterType?: string;
  git?: GitInfo;
  pullRequest?: PullRequestInfo;
  dbt?: {
    base: ManifestMetadata | undefined | null;
    current: ManifestMetadata | undefined | null;
  };
  sqlmesh?: SQLMeshInfo | null;
}

/**
 * Which environment the node/edge comes from
 */
type LineageFrom = "both" | "base" | "current";

/**
 * Lineage graph node type for React Flow
 */
export type LineageGraphNode = Node<
  {
    id: string;
    name: string;
    from: LineageFrom;
    data: {
      base?: NodeData;
      current?: NodeData;
    };
    changeStatus?: "added" | "removed" | "modified";
    change?: {
      category: "breaking" | "non_breaking" | "partial_breaking" | "unknown";
      columns: Record<string, "added" | "removed" | "modified"> | null;
    };
    resourceType?: string;
    packageName?: string;
    parents: Record<string, LineageGraphEdge>;
    children: Record<string, LineageGraphEdge>;
  },
  "lineageGraphNode"
>;

/**
 * Column-level lineage node type
 */
export type LineageGraphColumnNode = Node<
  {
    node: LineageGraphNode["data"];
    column: string;
    type: string;
    transformationType?: string;
    changeStatus?: "added" | "removed" | "modified";
  },
  "lineageGraphColumnNode"
>;

/**
 * Lineage graph edge type for React Flow
 */
export type LineageGraphEdge = Edge<
  {
    from: LineageFrom;
    changeStatus?: "added" | "removed";
  },
  "lineageGraphEdge"
>;

/**
 * Union type for all lineage graph node types
 */
export type LineageGraphNodes = LineageGraphNode | LineageGraphColumnNode;

/**
 * The main lineage graph data structure
 */
export interface LineageGraph {
  nodes: Record<string, LineageGraphNode>;
  edges: Record<string, LineageGraphEdge>;
  modifiedSet: string[];
  manifestMetadata: {
    base?: ManifestMetadata;
    current?: ManifestMetadata;
  };
  catalogMetadata: {
    base?: CatalogMetadata;
    current?: CatalogMetadata;
  };
}

/**
 * Type guard for LineageGraphNode
 */
export function isLineageGraphNode(
  node: LineageGraphNodes,
): node is LineageGraphNode {
  return node.type === "lineageGraphNode";
}

/**
 * Type guard for LineageGraphColumnNode
 */
export function isLineageGraphColumnNode(
  node: LineageGraphNodes,
): node is LineageGraphColumnNode {
  return node.type === "lineageGraphColumnNode";
}

/**
 * Context value exposed by LineageGraphContext
 */
export interface LineageGraphContextType {
  /** The processed lineage graph */
  lineageGraph?: LineageGraph;
  /** Environment metadata */
  envInfo?: EnvInfo;
  /** Whether in review mode (read-only checks) */
  reviewMode?: boolean;
  /** Whether in cloud mode (recce cloud) */
  cloudMode?: boolean;
  /** Whether in file mode (loading from file) */
  fileMode?: boolean;
  /** The state file name if in file mode */
  fileName?: string;
  /** Whether this is the demo site */
  isDemoSite: boolean;
  /** Whether running in GitHub Codespace */
  isCodespace?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Error message if loading failed */
  error?: string;
  /** Supported task types from server */
  supportTasks?: Record<string, boolean>;
  /** Refetch the lineage graph data */
  retchLineageGraph?: () => void;
  /** Check if an action is available */
  isActionAvailable: (actionName: string) => boolean;
  /** Pre-aggregated run results by model */
  runsAggregated?: RunsAggregated;
  /** Refetch the aggregated runs */
  refetchRunsAggregated?: () => void;
}

// ============================================================================
// LineageViewContext Types
// ============================================================================

/**
 * Action mode for node operations - single or multiple nodes
 */
export type ActionMode = "per_node" | "multi_nodes";

/**
 * Select mode for multi-node selection
 */
export type SelectMode = "selecting" | "action_result" | undefined;

/**
 * Action state for individual node operations
 */
export interface NodeAction {
  /** Whether this is a per-node or multi-node action */
  mode: ActionMode;
  /** Current status of this node's action */
  status?: "pending" | "running" | "success" | "failure" | "skipped";
  /** Reason why this node was skipped (if applicable) */
  skipReason?: string;
  /** The run associated with this action */
  run?: Run;
}

/**
 * Overall action state for batch operations
 */
export interface ActionState {
  /** Whether this is a per-node or multi-node action */
  mode: ActionMode;
  /** Overall status of the action batch */
  status: "pending" | "running" | "canceling" | "canceled" | "completed";
  /** Current run being executed */
  currentRun?: Partial<Run>;
  /** Number of completed actions */
  completed: number;
  /** Total number of actions */
  total: number;
  /** Per-node action state */
  actions: Record<string, NodeAction>;
}

/**
 * Context value exposed by LineageViewContext.
 * Provides state and methods for interacting with the lineage view.
 */
export interface LineageViewContextType {
  /** Whether the view is interactive (vs read-only) */
  interactive: boolean;
  /** All nodes in the current view */
  nodes: LineageGraphNodes[];
  /** Currently focused node (hovered/highlighted) */
  focusedNode?: LineageGraphNode;
  /** Currently selected nodes for batch operations */
  selectedNodes: LineageGraphNode[];
  /** Column-level lineage data if showing CLL */
  cll: ColumnLineageData | undefined;

  // Context menu
  /** Show the context menu for a node */
  showContextMenu: (event: React.MouseEvent, node: LineageGraphNodes) => void;

  // View options
  /** Current view options (filters, display settings) */
  viewOptions: LineageDiffViewOptions;
  /** Update view options */
  onViewOptionsChanged: (options: LineageDiffViewOptions) => void;

  // Multi-node selection
  /** Current selection mode */
  selectMode: SelectMode;
  /** Select/deselect a single node */
  selectNode: (nodeId: string) => void;
  /** Select all parent nodes up to a degree */
  selectParentNodes: (nodeId: string, degree?: number) => void;
  /** Select all child nodes up to a degree */
  selectChildNodes: (nodeId: string, degree?: number) => void;
  /** Clear selection */
  deselect: () => void;

  // Node state queries
  /** Check if a node is highlighted */
  isNodeHighlighted: (nodeId: string) => boolean;
  /** Check if a node is selected */
  isNodeSelected: (nodeId: string) => boolean;
  /** Check if an edge is highlighted */
  isEdgeHighlighted: (source: string, target: string) => boolean;
  /** Get the action state for a node */
  getNodeAction: (nodeId: string) => NodeAction;
  /** Get the columns visible for a node in CLL mode */
  getNodeColumnSet: (nodeId: string) => Set<string>;
  /** Check if a node is showing change analysis */
  isNodeShowingChangeAnalysis: (nodeId: string) => boolean;

  // Actions
  /** Run row count on selected nodes */
  runRowCount: () => Promise<void>;
  /** Run row count diff on selected nodes */
  runRowCountDiff: () => Promise<void>;
  /** Run value diff on selected nodes */
  runValueDiff: () => Promise<void>;
  /** Add a lineage diff check */
  addLineageDiffCheck: (viewMode?: string) => void;
  /** Add a schema diff check */
  addSchemaDiffCheck: () => void;
  /** Cancel the current action */
  cancel: () => void;
  /** Current action state */
  actionState: ActionState;

  // Column-level lineage
  /** Center the view on a specific node */
  centerNode: (nodeId: string) => void;
  /** Show column-level lineage for a node/column */
  showColumnLevelLineage: (cll?: CllInput) => Promise<void>;
  /** Reset column-level lineage view */
  resetColumnLevelLineage: (previous?: boolean) => Promise<void>;
}
