import { Box } from "@chakra-ui/react";

export const CURRENT_BAR_COLOR = "#63B3ED";
export const BASE_BAR_COLOR = "#F6AD55";
export const CURRENT_BAR_COLOR_WITH_ALPHA = `${CURRENT_BAR_COLOR}A5`;
export const BASE_BAR_COLOR_WITH_ALPHA = `${BASE_BAR_COLOR}A5`;

export function SquareIcon({ color }: { color: string }) {
  return (
    <Box
      display="inline-block"
      w="10px"
      h="10px"
      bgColor={color}
      mr="2"
      borderRadius="sm"
    ></Box>
  );
}
