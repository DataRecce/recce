import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import { useLineageViewContextSafe } from "./LineageViewContext";

export interface ActionControlProps {
  onClose: () => void;
}

export function ActionControl({ onClose }: ActionControlProps) {
  const { cancel, actionState } = useLineageViewContextSafe();

  const getProgressMessage = () => {
    if (actionState.mode === "per_node") {
      return `${actionState.completed} / ${actionState.total}`;
    } else {
      if (actionState.currentRun?.progress?.percentage) {
        return `${actionState.currentRun.progress.percentage * 100}%`;
      } else {
        if (actionState.status === "completed") {
          return "100%";
        } else {
          return "0%";
        }
      }
    }
  };

  return (
    <Box sx={{ bgcolor: "white", borderRadius: 1, boxShadow: 6 }}>
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

        {actionState.status === "running" ||
        actionState.status === "canceling" ? (
          <Button
            size="small"
            variant="outlined"
            onClick={cancel}
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
