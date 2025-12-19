import Box from "@mui/material/Box";

export const CURRENT_BAR_COLOR = "#63B3ED";
export const BASE_BAR_COLOR = "#F6AD55";
export const CURRENT_BAR_COLOR_WITH_ALPHA = `${CURRENT_BAR_COLOR}A5`;
export const BASE_BAR_COLOR_WITH_ALPHA = `${BASE_BAR_COLOR}A5`;

export function SquareIcon({ color }: { color: string }) {
  return (
    <Box
      sx={{
        display: "inline-block",
        width: "10px",
        height: "10px",
        bgcolor: color,
        mr: 1,
        borderRadius: "4px",
      }}
    />
  );
}
