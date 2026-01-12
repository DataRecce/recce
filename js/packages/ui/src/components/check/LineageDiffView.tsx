"use client";

import Box from "@mui/material/Box";
import { ReactFlowProvider } from "@xyflow/react";
import { forwardRef, type Ref } from "react";

import { LineageView, type LineageViewRef } from "../lineage/LineageView";

/**
 * View options for lineage diff checks
 */
export interface LineageDiffViewOptions {
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
}

/**
 * Props for the LineageDiffView component
 */
export interface LineageDiffViewProps {
  /**
   * Parameters from the check, merged with view options
   */
  params?: Record<string, unknown>;

  /**
   * View options for the lineage display
   */
  viewOptions?: LineageDiffViewOptions;

  /**
   * Whether the view is interactive (allows user input)
   * @default false
   */
  interactive?: boolean;

  /**
   * Optional height for the view
   */
  height?: number | string;

  /**
   * Optional dagre instance for layout
   */
  // biome-ignore lint/suspicious/noExplicitAny: dagre is external dependency
  dagre?: any;
}

/**
 * LineageDiffView Component
 *
 * A presentation component for displaying lineage diff results within a check.
 * Wraps the LineageView component with ReactFlowProvider and handles
 * merging of check params with view options.
 *
 * @example Basic usage
 * ```tsx
 * import { LineageDiffView } from '@datarecce/ui/primitives';
 * import dagre from '@dagrejs/dagre';
 *
 * function CheckLineageResult({ check }) {
 *   return (
 *     <LineageDiffView
 *       params={check.params}
 *       viewOptions={check.view_options}
 *       dagre={dagre}
 *     />
 *   );
 * }
 * ```
 *
 * @example With ref for clipboard
 * ```tsx
 * const lineageRef = useRef<LineageViewRef>(null);
 *
 * const handleCopy = () => {
 *   lineageRef.current?.copyToClipboard();
 * };
 *
 * <LineageDiffView
 *   ref={lineageRef}
 *   params={check.params}
 *   viewOptions={check.view_options}
 * />
 * ```
 */
function LineageDiffViewComponent(
  {
    params,
    viewOptions,
    interactive = false,
    height,
    dagre,
  }: LineageDiffViewProps,
  ref: Ref<LineageViewRef>,
) {
  // Merge params with view options - params take precedence
  const mergedViewOptions = {
    ...viewOptions,
    ...params,
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: height ?? "100%",
      }}
    >
      <ReactFlowProvider>
        <LineageView
          viewOptions={mergedViewOptions}
          interactive={interactive}
          ref={ref}
          dagre={dagre}
        />
      </ReactFlowProvider>
    </Box>
  );
}

export const LineageDiffView = forwardRef<LineageViewRef, LineageDiffViewProps>(
  LineageDiffViewComponent,
);
LineageDiffView.displayName = "LineageDiffView";

// Re-export LineageViewRef for convenience
export type { LineageViewRef };
