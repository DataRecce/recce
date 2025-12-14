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
  /** Margin X (horizontal) */
  mx?: number | string;
  /** Cursor style */
  cursor?: string;
  /** Width */
  width?: string | number;
  /** Height */
  height?: string | number;
  /** Display */
  display?: string;
  /** Hover styles */
  _hover?: Record<string, unknown>;
  /** Mouse enter handler */
  onMouseEnter?: () => void;
  /** Mouse leave handler */
  onMouseLeave?: () => void;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
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
    mx,
    cursor,
    width,
    height,
    display,
    _hover,
    onMouseEnter,
    onMouseLeave,
    onClick,
  },
  ref,
) {
  const commonSx = {
    display: display ?? "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: width ?? boxSize,
    height: height ?? boxSize,
    color,
    verticalAlign,
    ...(mr !== undefined && { mr }),
    ...(ml !== undefined && { ml }),
    ...(mx !== undefined && { mx }),
    ...(cursor && { cursor }),
    ...(_hover && { "&:hover": _hover }),
    "& svg": {
      width: "100%",
      height: "100%",
    },
  };

  // If children are provided directly (e.g., <Icon><SomeIcon /></Icon>)
  if (children && !IconComponent) {
    return (
      <Box
        component="span"
        ref={ref}
        className={className}
        sx={commonSx}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        {children}
      </Box>
    );
  }

  // If an icon component is passed via the `as` prop
  if (IconComponent) {
    return (
      <Box
        component="span"
        ref={ref}
        className={className}
        sx={commonSx}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        <IconComponent />
      </Box>
    );
  }

  return null;
});

export default Icon;
