"use client";

import type { BoxProps } from "@mui/material/Box";
import Box from "@mui/material/Box";
import { forwardRef, type ReactNode } from "react";

/**
 * Code Component - MUI equivalent of Chakra's Code
 *
 * Inline code styling component.
 */

export interface CodeProps extends Omit<BoxProps<"code">, "ref" | "component"> {
  /** Content to display */
  children?: ReactNode;
  /** Chakra colorPalette */
  colorPalette?:
    | "iochmara"
    | "blue"
    | "cyan"
    | "green"
    | "amber"
    | "red"
    | "gray";
  /** Cursor style */
  cursor?: string;
  /** Click handler */
  onClick?: () => void;
  /** Font size */
  fontSize?: string;
}

const colorPaletteToBg: Record<string, string> = {
  iochmara: "rgba(49, 130, 206, 0.1)",
  blue: "rgba(49, 130, 206, 0.1)",
  cyan: "rgba(0, 184, 212, 0.1)",
  green: "rgba(56, 161, 105, 0.1)",
  amber: "rgba(237, 137, 54, 0.1)",
  red: "rgba(229, 62, 62, 0.1)",
  gray: "rgba(113, 128, 150, 0.1)",
};

const colorPaletteToColor: Record<string, string> = {
  iochmara: "#3182CE",
  blue: "#3182CE",
  cyan: "#00B8D4",
  green: "#38A169",
  amber: "#ED8936",
  red: "#E53E3E",
  gray: "#718096",
};

export const Code = forwardRef<HTMLElement, CodeProps>(function Code(
  { children, colorPalette = "gray", cursor, onClick, fontSize, sx, ...props },
  ref,
) {
  return (
    <Box
      ref={ref}
      component="code"
      onClick={onClick}
      sx={{
        fontFamily: "monospace",
        fontSize: fontSize || "0.875em",
        px: 1,
        py: 0.5,
        borderRadius: 0.5,
        backgroundColor:
          colorPaletteToBg[colorPalette] || colorPaletteToBg.gray,
        color: colorPaletteToColor[colorPalette] || colorPaletteToColor.gray,
        ...(cursor && { cursor }),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
});

export default Code;
