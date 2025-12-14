"use client";

import type { CircularProgressProps as MuiCircularProgressProps } from "@mui/material/CircularProgress";
import MuiCircularProgress from "@mui/material/CircularProgress";
import { forwardRef } from "react";

/**
 * Spinner Component - MUI equivalent of Chakra's Spinner
 *
 * A loading indicator component.
 */

export interface SpinnerProps
  extends Omit<MuiCircularProgressProps, "ref" | "size"> {
  /** Size of the spinner */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /** Chakra colorPalette - maps to MUI color */
  colorPalette?:
    | "iochmara"
    | "blue"
    | "cyan"
    | "green"
    | "amber"
    | "red"
    | "gray";
}

const sizeMap: Record<string, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

const colorPaletteToMui: Record<string, MuiCircularProgressProps["color"]> = {
  iochmara: "primary",
  blue: "primary",
  cyan: "secondary",
  green: "success",
  amber: "warning",
  red: "error",
  gray: "inherit",
};

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(
  function Spinner({ size = "md", colorPalette = "iochmara", ...props }, ref) {
    const pixelSize = typeof size === "number" ? size : sizeMap[size] || 24;
    const muiColor = colorPaletteToMui[colorPalette] || "primary";

    return (
      <MuiCircularProgress
        ref={ref}
        size={pixelSize}
        color={muiColor}
        {...props}
      />
    );
  },
);

export default Spinner;
