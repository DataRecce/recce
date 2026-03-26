/**
 * Zoom and display constants for the lineage view.
 *
 * LEGIBLE_MIN_ZOOM: Floor for fitView() calls — ensures node labels remain
 * readable on initial load. At 300px node width, 0.35x renders ~105px on screen.
 *
 * EXPLORE_MIN_ZOOM: Floor for manual zoom — power users can zoom out further
 * to see the full graph overview.
 *
 * FIT_VIEW_PADDING: Breathing room around fitted nodes so they don't touch
 * the viewport edge.
 *
 * DIM_FILTER: CSS filter applied to non-highlighted nodes/edges. Uses 0.4
 * opacity (not 0.2) so graph structure remains visible at any zoom level.
 */

/** Minimum zoom for fitView — labels remain readable */
export const LEGIBLE_MIN_ZOOM = 0.35;

/** Minimum zoom for manual exploration */
export const EXPLORE_MIN_ZOOM = 0.1;

/** Padding for fitView calls */
export const FIT_VIEW_PADDING = 0.15;

/** CSS filter for dimmed (non-highlighted) nodes and edges */
export const DIM_FILTER = "opacity(0.4) grayscale(40%)";
