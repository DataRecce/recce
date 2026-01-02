"use client";

import { ControlButton, Controls, useReactFlow } from "@xyflow/react";
import type { ReactNode } from "react";

/**
 * Props for the LineageControls component.
 */
export interface LineageControlsProps {
  /**
   * Whether to show the zoom-in button
   * @default true
   */
  showZoomIn?: boolean;

  /**
   * Whether to show the zoom-out button
   * @default true
   */
  showZoomOut?: boolean;

  /**
   * Whether to show the fit-view button
   * @default true
   */
  showFitView?: boolean;

  /**
   * Whether to show the interactive/lock button
   * @default false
   */
  showInteractive?: boolean;

  /**
   * Additional control buttons to render
   */
  children?: ReactNode;

  /**
   * Callback when zoom-in is clicked
   */
  onZoomIn?: () => void;

  /**
   * Callback when zoom-out is clicked
   */
  onZoomOut?: () => void;

  /**
   * Callback when fit-view is clicked
   */
  onFitView?: () => void;

  /**
   * Position of the controls
   * @default "bottom-left"
   */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";

  /**
   * CSS class name for additional styling
   */
  className?: string;
}

/**
 * LineageControls Component
 *
 * A wrapper around React Flow's Controls component that provides
 * zoom and navigation controls for the lineage graph.
 *
 * @example Basic usage
 * ```tsx
 * import { LineageControls } from '@datarecce/ui/primitives';
 *
 * function MyLineageGraph() {
 *   return (
 *     <ReactFlowProvider>
 *       <ReactFlow nodes={nodes} edges={edges}>
 *         <LineageControls />
 *       </ReactFlow>
 *     </ReactFlowProvider>
 *   );
 * }
 * ```
 *
 * @example With custom buttons
 * ```tsx
 * import { LineageControls } from '@datarecce/ui/primitives';
 * import { ControlButton } from '@xyflow/react';
 *
 * function MyLineageGraph() {
 *   return (
 *     <ReactFlow nodes={nodes} edges={edges}>
 *       <LineageControls onFitView={() => console.log('Fit view clicked')}>
 *         <ControlButton onClick={() => console.log('Custom action')}>
 *           Custom
 *         </ControlButton>
 *       </LineageControls>
 *     </ReactFlow>
 *   );
 * }
 * ```
 */
export function LineageControls({
  showZoomIn = true,
  showZoomOut = true,
  showFitView = true,
  showInteractive = false,
  children,
  onZoomIn,
  onZoomOut,
  onFitView,
  position = "bottom-left",
  className,
}: LineageControlsProps) {
  const reactFlow = useReactFlow();

  const handleZoomIn = () => {
    if (onZoomIn) {
      onZoomIn();
    } else {
      reactFlow.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (onZoomOut) {
      onZoomOut();
    } else {
      reactFlow.zoomOut();
    }
  };

  const handleFitView = () => {
    if (onFitView) {
      onFitView();
    } else {
      reactFlow.fitView();
    }
  };

  return (
    <Controls
      showZoom={showZoomIn && showZoomOut}
      showFitView={showFitView}
      showInteractive={showInteractive}
      position={position}
      className={className}
      onZoomIn={handleZoomIn}
      onZoomOut={handleZoomOut}
      onFitView={handleFitView}
    >
      {children}
    </Controls>
  );
}

// Re-export ControlButton for convenience
export { ControlButton };
