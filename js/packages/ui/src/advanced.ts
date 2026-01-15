// @datarecce/ui/advanced - Lower-level components for custom composition
// These exports may change between minor versions

"use client";

/**
 * Version marker for the advanced surface.
 */
export const ADVANCED_API_VERSION = "0.2.0";

// =============================================================================
// LINEAGE UTILITIES
// =============================================================================

/**
 * Lineage graph types for advanced consumers.
 *
 * @remarks
 * Exports: EnvInfo, LineageGraph, LineageGraphColumnNode, LineageGraphEdge,
 * LineageGraphNode, LineageGraphNodes.
 */
export type {
  EnvInfo,
  LineageGraph,
  LineageGraphColumnNode,
  LineageGraphEdge,
  LineageGraphNode,
  LineageGraphNodes,
} from "./contexts/lineage/types";
/**
 * Lineage graph type guards.
 *
 * @remarks
 * Exports: isLineageGraphColumnNode, isLineageGraphNode.
 */
export {
  isLineageGraphColumnNode,
  isLineageGraphNode,
} from "./contexts/lineage/types";
/**
 * Graph building and layout utilities.
 *
 * @remarks
 * Exports: buildLineageGraph, COLUMN_HEIGHT, getNeighborSet, intersect,
 * layoutWithDagre, NodeColumnSetMap, selectDownstream, selectUpstream,
 * toReactFlowBasic, union.
 */
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

/**
 * Low-level lineage canvas component for custom graph rendering.
 *
 * @remarks
 * Exports: LineageCanvas, LineageCanvasProps.
 */
export {
  LineageCanvas,
  type LineageCanvasProps,
} from "./components/lineage/LineageCanvas";

// =============================================================================
// CONTEXT HOOKS
// =============================================================================

/**
 * Recce action context hooks and types.
 *
 * @remarks
 * Exports: RecceActionContextType, useRecceActionContext.
 */
export {
  type RecceActionContextType,
  useRecceActionContext,
} from "./contexts/action";
/**
 * Idle timeout context hooks and types.
 *
 * @remarks
 * Exports: IdleTimeoutContextType, useIdleTimeout.
 */
export {
  type IdleTimeoutContextType,
  useIdleTimeout,
} from "./contexts/idle";
/**
 * Recce instance context hooks and types.
 *
 * @remarks
 * Exports: InstanceInfoType, useRecceInstanceContext, useRecceInstanceInfo.
 */
export {
  type InstanceInfoType,
  useRecceInstanceContext,
  useRecceInstanceInfo,
} from "./contexts/instance";
/**
 * Lineage context hooks for direct access.
 *
 * @remarks
 * Exports: useLineageGraphContext, useRunsAggregated.
 */
export {
  useLineageGraphContext,
  useRunsAggregated,
} from "./contexts/lineage";

// =============================================================================
// THEME UTILITIES
// =============================================================================

/**
 * Theme color hook for advanced consumers.
 *
 * @remarks
 * Exports: useThemeColors.
 */
export { useThemeColors } from "./hooks/useThemeColors";

/**
 * Theme color palette exports.
 *
 * @remarks
 * Exports: ColorShade, colors, SemanticColorVariant.
 */
export {
  type ColorShade,
  colors,
  type SemanticColorVariant,
} from "./theme/colors";
