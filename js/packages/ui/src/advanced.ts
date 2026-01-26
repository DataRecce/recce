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
// NOTE: Lineage types canonical in @datarecce/ui/types
// NOTE: Lineage utilities canonical in @datarecce/ui/contexts

/**
 * Lineage graph types for advanced consumers.
 * @deprecated Import from @datarecce/ui/types instead
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
 * @deprecated Import from @datarecce/ui/contexts instead
 */
export {
  isLineageGraphColumnNode,
  isLineageGraphNode,
} from "./contexts/lineage/types";
/**
 * Graph building and layout utilities.
 * @deprecated Import from @datarecce/ui/contexts instead
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
// NOTE: Context hooks canonical in @datarecce/ui/contexts
// NOTE: Context types canonical in @datarecce/ui/types

/**
 * Recce action context hooks and types.
 * @deprecated Import from @datarecce/ui/contexts instead
 */
export {
  type RecceActionContextType,
  useRecceActionContext,
} from "./contexts/action";
/**
 * Idle timeout context hooks and types.
 * @deprecated Import from @datarecce/ui/contexts instead
 */
export {
  type IdleTimeoutContextType,
  useIdleTimeout,
} from "./contexts/idle";
/**
 * Recce instance context hooks and types.
 * @deprecated Import from @datarecce/ui/contexts instead
 */
export {
  type InstanceInfoType,
  useRecceInstanceContext,
  useRecceInstanceInfo,
} from "./contexts/instance";
/**
 * Lineage context hooks for direct access.
 * @deprecated Import from @datarecce/ui/contexts instead
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
 * @deprecated Import from @datarecce/ui/theme instead
 * @deprecated Types (ColorShade, SemanticColorVariant) canonical in @datarecce/ui/types
 */
export {
  type ColorShade,
  colors,
  type SemanticColorVariant,
} from "./theme/colors";
