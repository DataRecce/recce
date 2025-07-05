import { Box, Flex, Icon } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { getIconForChangeStatus } from "./styles";

export function ChangeStatusLegend() {
  const CHANGE_STATUS_MSGS: Record<string, [string, string]> = {
    added: ["Added", "Added resource"],
    removed: ["Removed", "Removed resource"],
    modified: ["Modified", "Modified resource"],
  };

  return (
    <Box bg="white" padding="12px" borderWidth="1px" borderColor="gray.200" fontSize="sm">
      {Object.entries(CHANGE_STATUS_MSGS).map(([key, [label, tip]]) => {
        const { icon, color } = getIconForChangeStatus(key as any);

        return (
          <Tooltip content={tip} key={key} positioning={{ placement: "right" }}>
            <Flex alignItems="center" gap="6px" marginBottom="2px">
              <Icon color={color} as={icon} /> {label}
            </Flex>
          </Tooltip>
        );
      })}
    </Box>
  );
}
