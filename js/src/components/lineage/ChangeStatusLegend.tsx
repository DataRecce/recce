import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { getIconForChangeStatus } from "./styles";

type ChangeStatus = "added" | "removed" | "modified";

export function ChangeStatusLegend() {
  const CHANGE_STATUS_MSGS: Record<ChangeStatus, [string, string]> = {
    added: ["Added", "Added resource"],
    removed: ["Removed", "Removed resource"],
    modified: ["Modified", "Modified resource"],
  };

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        padding: "12px",
        border: "1px solid",
        borderColor: "divider",
        fontSize: "0.875rem",
      }}
    >
      {(
        Object.entries(CHANGE_STATUS_MSGS) as [ChangeStatus, [string, string]][]
      ).map(([key, [label, tip]]) => {
        const { icon, color } = getIconForChangeStatus(key);

        return (
          <Tooltip title={tip} key={key} placement="right">
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                mb: "2px",
              }}
            >
              {icon && <Box component={icon} sx={{ color }} />} {label}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
