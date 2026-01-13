import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import type { LineageDiffViewOptions } from "../../../api";

/**
 * Loading state component for LineageView.
 * Displays a centered spinner while lineage data is loading.
 */
export function LineageViewLoading() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress size={48} />
    </Box>
  );
}

/**
 * Props for LineageViewError component.
 */
export interface LineageViewErrorProps {
  /** The error message to display */
  error: string;
  /** Callback to retry loading the lineage data */
  onRetry?: () => void;
}

/**
 * Error state component for LineageView.
 * Displays error message with a retry button.
 */
export function LineageViewError({ error, onRetry }: LineageViewErrorProps) {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack alignItems="center" spacing={1}>
        <Box>
          Failed to load lineage data. This could be because the server has been
          terminated or there is a network error.
        </Box>
        <Box>[Reason: {error}]</Box>
        <Button
          color="iochmara"
          variant="contained"
          onClick={() => {
            if (onRetry) {
              onRetry();
            }
          }}
        >
          Retry
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * Props for LineageViewNoChanges component.
 */
export interface LineageViewNoChangesProps {
  /** Current view options */
  viewOptions: LineageDiffViewOptions;
  /** Callback to change view options */
  onViewOptionsChanged: (options: LineageDiffViewOptions) => void;
}

/**
 * Empty state component when no changes are detected in changed_models view mode.
 * Provides a button to switch to "all" view mode.
 */
export function LineageViewNoChanges({
  viewOptions,
  onViewOptionsChanged,
}: LineageViewNoChangesProps) {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack alignItems="center" spacing={1}>
        <>No change detected</>
        <Button
          color="iochmara"
          variant="contained"
          onClick={async () => {
            await onViewOptionsChanged({
              ...viewOptions,
              view_mode: "all",
            });
          }}
        >
          Show all nodes
        </Button>
      </Stack>
    </Box>
  );
}
