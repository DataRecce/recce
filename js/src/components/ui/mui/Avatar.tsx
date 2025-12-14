"use client";

import type { AvatarProps as MuiAvatarProps } from "@mui/material/Avatar";
import MuiAvatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import { forwardRef, type ReactNode } from "react";

/**
 * Avatar Component - MUI equivalent of Chakra's Avatar
 *
 * Displays a user avatar with image, initials, or fallback.
 */

export interface AvatarProps extends Omit<MuiAvatarProps, "ref"> {
  /** Name of the person (used for initials and alt text) */
  name?: string;
  /** Size of the avatar */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Fallback element when no image/name */
  fallback?: ReactNode;
}

const sizeMap: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  "2xl": 96,
};

function getInitials(name?: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { name, size = "md", fallback, src, alt, sx, ...props },
  ref,
) {
  const pixelSize = sizeMap[size] || 40;
  const initials = getInitials(name);

  return (
    <MuiAvatar
      ref={ref}
      src={src}
      alt={alt || name}
      sx={{
        width: pixelSize,
        height: pixelSize,
        fontSize: pixelSize * 0.4,
        ...sx,
      }}
      {...props}
    >
      {!src && (fallback || initials || null)}
    </MuiAvatar>
  );
});

// Export AvatarGroup for convenience
export { AvatarGroup };

export default Avatar;
