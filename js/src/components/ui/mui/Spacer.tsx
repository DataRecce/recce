"use client";

import type { BoxProps as MuiBoxProps } from "@mui/material/Box";
import MuiBox from "@mui/material/Box";
import { forwardRef } from "react";

/**
 * Spacer Component - MUI equivalent of Chakra's Spacer
 *
 * A flexible spacer component that expands to fill available space.
 * Useful in Flex layouts to push items apart.
 */

export type SpacerProps = Omit<MuiBoxProps, "children" | "ref">;

export const Spacer = forwardRef<HTMLDivElement, SpacerProps>(function Spacer(
  { sx, ...props },
  ref,
) {
  return (
    <MuiBox
      ref={ref}
      sx={{
        flex: 1,
        justifySelf: "stretch",
        alignSelf: "stretch",
        ...sx,
      }}
      {...props}
    />
  );
});

export default Spacer;
