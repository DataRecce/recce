import type { Edge, Node } from "@xyflow/react";
import type {
  CatalogMetadata,
  GitInfo,
  ManifestMetadata,
  NodeData,
  PullRequestInfo,
  SQLMeshInfo,
  StateMetadata,
} from "../../api/info";
import type { RunsAggregated } from "../../api/runs";

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
