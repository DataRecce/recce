import { Box, Flex, Icon } from "@/components/ui/mui";
import { Tooltip } from "@/components/ui/tooltip";
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
        bgcolor: "white",
        padding: "12px",
        border: "1px solid",
        borderColor: "grey.200",
        fontSize: "sm",
      }}
    >
      {(
        Object.entries(CHANGE_STATUS_MSGS) as [ChangeStatus, [string, string]][]
      ).map(([key, [label, tip]]) => {
        const { icon, color } = getIconForChangeStatus(key);

        return (
          <Tooltip content={tip} key={key} positioning={{ placement: "right" }}>
            <Flex sx={{ alignItems: "center", gap: "6px", mb: "2px" }}>
              <Icon color={color} as={icon} /> {label}
            </Flex>
          </Tooltip>
        );
      })}
    </Box>
  );
}
