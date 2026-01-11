import { ActionControl as BaseActionControl } from "@datarecce/ui/components/lineage";
import { useLineageViewContextSafe } from "./LineageViewContext";

/**
 * Props for the ActionControl wrapper component.
 */
export interface ActionControlProps {
  /**
   * Callback invoked when the user clicks the Close button (after action completes)
   */
  onClose: () => void;
}

/**
 * ActionControl Component (OSS Wrapper)
 *
 * Wraps the @datarecce/ui ActionControl component with context from
 * LineageViewContext. This provides the same functionality as before
 * but delegates rendering to the shared UI library.
 *
 * The context provides:
 * - `actionState`: Current state of the batch operation
 * - `cancel`: Function to cancel the current operation
 *
 * @example
 * ```tsx
 * import { ActionControl } from './ActionControl';
 *
 * function MyLineageView() {
 *   const [showControl, setShowControl] = useState(true);
 *
 *   return (
 *     <LineageViewProvider>
 *       {showControl && (
 *         <ActionControl onClose={() => setShowControl(false)} />
 *       )}
 *     </LineageViewProvider>
 *   );
 * }
 * ```
 */
export function ActionControl({ onClose }: ActionControlProps) {
  const { cancel, actionState } = useLineageViewContextSafe();

  return (
    <BaseActionControl
      actionState={actionState}
      onCancel={cancel}
      onClose={onClose}
    />
  );
}
