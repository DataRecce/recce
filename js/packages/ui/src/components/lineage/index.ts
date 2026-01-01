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
 * NOTE: This is a placeholder export for @datarecce/ui. The full implementation
 * requires the complete Recce application context including:
 * - LineageGraphContext for lineage data
 * - RecceActionContext for actions
 * - RecceInstanceContext for instance configuration
 * - ApiConfigContext for API access
 *
 * For full functionality, use within a RecceProvider that supplies these contexts.
 *
 * @example
 * ```tsx
 * import { LineageView } from '@datarecce/ui';
 *
 * function MyComponent() {
 *   return (
 *     <RecceProvider>
 *       <LineageView
 *         interactive={true}
 *         viewOptions={{ view_mode: 'changed_models' }}
 *       />
 *     </RecceProvider>
 *   );
 * }
 * ```
 */
export const LineageView = forwardRef<LineageViewRef, LineageViewProps>(
  function LineageView(_props: LineageViewProps, _ref: Ref<LineageViewRef>) {
    // This is a type-only export for @datarecce/ui package.
    // The actual implementation requires the full Recce context.
    // Consumers should use this within a properly configured RecceProvider.
    throw new Error(
      "LineageView requires the full Recce application context. " +
        "Please ensure you are using this component within a RecceProvider " +
        "that supplies the necessary context (LineageGraphContext, RecceActionContext, etc.).",
    );
  },
);
