"use client";

import Box from "@mui/material/Box";
import { type ComponentType, forwardRef, type SVGProps } from "react";

/**
 * Icon Component - MUI equivalent of Chakra's Icon
 *
 * A simple wrapper that renders an icon component with styling support.
 * Designed to work with react-icons and custom SVG components.
 */

export interface IconProps {
  /** The icon component to render */
  as?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Size of the icon box (Chakra-style) */
  boxSize?: string | number;
  /** Color of the icon */
  color?: string;
  /** Vertical alignment */
  verticalAlign?: string;
  /** Additional className */
  className?: string;
  /** Children (for direct icon children instead of `as` prop) */
  children?: React.ReactNode;
  /** Margin right */
  mr?: number | string;
  /** Margin left */
  ml?: number | string;
  /** Cursor style */
  cursor?: string;
}

export const Icon = forwardRef<HTMLSpanElement, IconProps>(function Icon(
  {
    as: IconComponent,
    boxSize = "1em",
    color,
    verticalAlign,
    className,
    children,
    mr,
    ml,
    cursor,
  },
  ref,
) {
  const commonSx = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: boxSize,
    height: boxSize,
    color,
    verticalAlign,
    ...(mr !== undefined && { mr }),
    ...(ml !== undefined && { ml }),
    ...(cursor && { cursor }),
    "& svg": {
      width: "100%",
      height: "100%",
    },
  };

  // If children are provided directly (e.g., <Icon><SomeIcon /></Icon>)
  if (children && !IconComponent) {
    return (
      <Box component="span" ref={ref} className={className} sx={commonSx}>
        {children}
      </Box>
    );
  }

  // If an icon component is passed via the `as` prop
  if (IconComponent) {
    return (
      <Box component="span" ref={ref} className={className} sx={commonSx}>
        <IconComponent />
      </Box>
    );
  }

  return null;
});

export default Icon;
