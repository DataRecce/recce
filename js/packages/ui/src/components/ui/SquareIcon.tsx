"use client";

import Box from "@mui/material/Box";

export interface SquareIconProps {
  /** The background color of the square icon */
  color: string;
}

/**
 * A small square icon used in chart legends
 */
export function SquareIcon({ color }: SquareIconProps) {
  return (
    <Box
      component="span"
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
