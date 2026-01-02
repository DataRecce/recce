// @datarecce/ui/advanced - Lower-level components for custom composition
// These exports may change between minor versions

"use client";

export const ADVANCED_API_VERSION = "0.2.0";

// =============================================================================
// LINEAGE UTILITIES
// =============================================================================

// Lineage graph types
export type {
  EnvInfo,
  LineageGraph,
  LineageGraphColumnNode,
  LineageGraphEdge,
  LineageGraphNode,
  LineageGraphNodes,
} from "./contexts/lineage/types";
export {
  isLineageGraphColumnNode,
  isLineageGraphNode,
} from "./contexts/lineage/types";
// Graph building and layout utilities
export {
  buildLineageGraph,
  COLUMN_HEIGHT,
  getNeighborSet,
  intersect,
  layoutWithDagre,
  type NodeColumnSetMap,
  selectDownstream,
  selectUpstream,
  toReactFlowBasic,
  union,
} from "./contexts/lineage/utils";

// =============================================================================
// LINEAGE CANVAS
// =============================================================================

// Low-level canvas component (for custom graph rendering)
export {
  LineageCanvas,
  type LineageCanvasProps,
} from "./components/lineage/LineageCanvas";

// =============================================================================
// CONTEXT HOOKS
// =============================================================================

export {
  type RecceActionContextType,
  useRecceActionContext,
} from "./contexts/action";
export {
  type IdleTimeoutContextType,
  useIdleTimeout,
} from "./contexts/idle";
export {
  type InstanceInfoType,
  useRecceInstanceContext,
  useRecceInstanceInfo,
} from "./contexts/instance";
// Direct context access (for advanced use cases)
export {
  useLineageGraphContext,
  useRunsAggregated,
} from "./contexts/lineage";

// =============================================================================
// THEME UTILITIES
// =============================================================================

// Theme color access
export { useThemeColors } from "./hooks/useThemeColors";

// Theme color palette
export {
  type ColorShade,
  colors,
  type SemanticColorVariant,
} from "./theme/colors";
