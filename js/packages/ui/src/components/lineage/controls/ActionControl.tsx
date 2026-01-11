"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import type { ActionState } from "../../../contexts/lineage/types";

/**
 * Props for the ActionControl component.
 */
export interface ActionControlProps {
  /**
   * The current action state containing progress, status, and mode information
   */
  actionState: ActionState;

  /**
   * Callback invoked when the user clicks the Cancel button
   */
  onCancel: () => void;

  /**
   * Callback invoked when the user clicks the Close button (after action completes)
   */
  onClose: () => void;
}

/**
 * ActionControl Component
 *
 * Displays progress information and control buttons for batch operations
 * on lineage graph nodes. Shows different UI based on action status:
 * - Running/Canceling: Shows progress with Cancel button
 * - Completed/Canceled: Shows progress with Close button
 *
 * This is a props-based component that doesn't use context directly.
 * For context-aware usage, wrap this component with context consumers.
 *
 * @example Basic usage
 * ```tsx
 * import { ActionControl } from '@datarecce/ui/components/lineage';
 *
 * function MyComponent() {
 *   const [actionState, setActionState] = useState<ActionState>({
 *     mode: 'per_node',
 *     status: 'running',
 *     completed: 5,
 *     total: 10,
 *     actions: {},
 *   });
 *
 *   return (
 *     <ActionControl
 *       actionState={actionState}
 *       onCancel={() => setActionState(prev => ({ ...prev, status: 'canceling' }))}
 *       onClose={() => console.log('closed')}
 *     />
 *   );
 * }
 * ```
 *
 * @example With context wrapper (OSS pattern)
 * ```tsx
 * import { ActionControl as BaseActionControl } from '@datarecce/ui/components/lineage';
 * import { useLineageViewContext } from './LineageViewContext';
 *
 * function ActionControl({ onClose }: { onClose: () => void }) {
 *   const { cancel, actionState } = useLineageViewContext();
 *   return <BaseActionControl actionState={actionState} onCancel={cancel} onClose={onClose} />;
 * }
 * ```
 */
export function ActionControl({
  actionState,
  onCancel,
  onClose,
}: ActionControlProps) {
  /**
   * Calculate the progress message based on action mode and status
   */
  const getProgressMessage = () => {
    if (actionState.mode === "per_node") {
      return `${actionState.completed} / ${actionState.total}`;
    }
    // multi_nodes mode
    if (actionState.currentRun?.progress?.percentage) {
      return `${actionState.currentRun.progress.percentage * 100}%`;
    }
    if (actionState.status === "completed") {
      return "100%";
    }
    return "0%";
  };

  const isActionInProgress =
    actionState.status === "running" || actionState.status === "canceling";

  return (
    <Box sx={{ bgcolor: "background.paper", borderRadius: 1, boxShadow: 6 }}>
      <Stack
        direction="row"
        divider={<Divider orientation="vertical" flexItem />}
        spacing={2}
        sx={{ p: "5px 15px", mt: 2 }}
      >
        <Box sx={{ fontSize: "10pt" }}>
          Progress: {getProgressMessage()}{" "}
          {actionState.status === "canceled" ? " (canceled)" : ""}
        </Box>

        {isActionInProgress ? (
          <Button
            size="small"
            variant="outlined"
            onClick={onCancel}
            disabled={actionState.status === "canceling"}
          >
            {actionState.status === "canceling" ? "Canceling" : "Cancel"}
          </Button>
        ) : (
          <Stack direction="row">
            <Button size="small" variant="outlined" onClick={onClose}>
              Close
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
